'use strict';

const axios = require('axios');
const NodeCache = require('node-cache');
const { logger } = require('./logger');

// ─── Cache ─────────────────────────────────────────────────────────────────────
// 5 min TTL for all cached data
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// ─── JiraService ───────────────────────────────────────────────────────────────

class JiraService {
  /**
   * @param {{ baseUrl: string, email: string, apiToken: string }} config
   */
  constructor(config) {
    this.config = config;
    // v2 is used for Server/Data Center fallback; Cloud always uses v3
    this.apiVersion = '3';

    const baseURL = config.baseUrl.replace(/\/$/, '');

    this.client = axios.create({
      baseURL: `${baseURL}/rest/api/3`,
      auth: {
        username: config.email,
        password: config.apiToken,
      },
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Response interceptor for logging
    this.client.interceptors.response.use(
      response => response,
      error => {
        logger.error('Jira API error', {
          url: error.config && error.config.url,
          status: error.response && error.response.status,
          message: (error.response && error.response.data && error.response.data.errorMessages) || error.message,
        });
        throw error;
      }
    );
  }

  _setApiVersion(version) {
    this.apiVersion = version;
    this.client.defaults.baseURL = `${this.config.baseUrl.replace(/\/$/, '')}/rest/api/${version}`;
  }

  // ─── Validate Connection ─────────────────────────────────────────────────────

  async validateConnection() {
    try {
      const response = await this.client.get('/myself');
      return response.data;
    } catch (err) {
      // 401 on v3 likely means a Server/Data Center instance — retry with v2
      if (err.response && err.response.status === 401 && this.apiVersion === '3') {
        logger.warn('Jira API v3 failed; retrying validation with v2');
        this._setApiVersion('2');
        const response = await this.client.get('/myself');
        return response.data;
      }
      throw err;
    }
  }

  // ─── Search Users ────────────────────────────────────────────────────────────

  async searchUsers(query) {
    const cacheKey = `users_search_${query}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const response = await this.client.get('/user/search', {
      params: { query, maxResults: 50 },
    });

    cache.set(cacheKey, response.data, 300);
    return response.data;
  }

  // ─── Get User by Account ID ──────────────────────────────────────────────────

  async getUser(accountId) {
    const cacheKey = `user_${accountId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const response = await this.client.get('/user', {
      params: { accountId },
    });

    cache.set(cacheKey, response.data, 300);
    return response.data;
  }

  // ─── Fetch Activity for Users and Date Range ─────────────────────────────────

  async fetchUserActivity(userIds, startDate, endDate, projectKeys, startTime, endTime, excludedDays) {
    const startTimeStr = startTime || '00:00';
    const endTimeStr = endTime || '23:59';
    const excludedDaysArr = excludedDays || [0, 6];

    const cacheKeyForQuery = `activity_${startDate}_${startTimeStr}_${endDate}_${endTimeStr}_${(projectKeys || []).join('_')}_excl${excludedDaysArr.join('-')}`;
    const cachedResult = cache.get(cacheKeyForQuery);
    if (cachedResult) {
      logger.info('Returning cached activity result', { startDate, startTime: startTimeStr, endDate, endTime: endTimeStr, cacheKey: cacheKeyForQuery });
      return cachedResult;
    }

    const projectFilter =
      projectKeys && projectKeys.length > 0
        ? ` AND project IN (${projectKeys.map(k => `"${k}"`).join(',')})`
        : '';

    const startDateTime = `${startDate} ${startTimeStr}`;
    const endDateTime = `${endDate} ${endTimeStr}`;
    const jql = `updated >= "${startDateTime}" AND updated <= "${endDateTime}"${projectFilter} ORDER BY updated DESC`;

    logger.info('Fetching Jira issues', { jql, userIds, startTime: startTimeStr, endTime: endTimeStr });

    const allIssues = await this._fetchAllIssues(jql);

    logger.info(`Fetched ${allIssues.length} issues, processing changelogs...`);

    const activityMap = new Map();
    const userSet = new Set(userIds);
    const dateRange = this._getDateRange(startDate, endDate, excludedDaysArr);

    for (const issue of allIssues) {
      this._processIssueActivity(issue, userSet, dateRange, activityMap);
    }

    const relevantIssues = allIssues.filter(
      issue => issue.changelog && issue.changelog.histories && issue.changelog.histories.some(h => userSet.has(h.author.accountId))
    );

    await this._fetchCommentsAndWorklogs(relevantIssues, userSet, dateRange, activityMap);

    cache.set(cacheKeyForQuery, activityMap, 300);
    logger.info('Cached activity result', { startDate, endDate, cacheKey: cacheKeyForQuery });

    return activityMap;
  }

  // ─── Fetch All Issues (paginated) ────────────────────────────────────────────

  async _fetchAllIssues(jql) {
    if (this.apiVersion === '2') {
      return this._fetchAllIssuesV2(jql);
    }
    return this._fetchAllIssuesV3(jql);
  }

  /** Jira Cloud v3: GET /search/jql with cursor-based nextPageToken pagination */
  async _fetchAllIssuesV3(jql) {
    const allIssues = [];
    let nextPageToken;
    const maxResults = 250;

    do {
      const params = {
        jql,
        maxResults,
        fields: 'summary,issuetype,project,status,assignee,priority',
        expand: 'changelog',
      };
      if (nextPageToken) params.nextPageToken = nextPageToken;

      const cacheKey = `issues_v3_${Buffer.from(jql).toString('base64')}_${nextPageToken || 'start'}`;
      let data = cache.get(cacheKey);

      if (!data) {
        try {
          logger.info('Calling Jira GET /search/jql', { jql, page: Math.floor(allIssues.length / maxResults) + 1 });

          const response = await this.client.get('/search/jql', { params });

          logger.info('GET /search/jql success', {
            issuesCount: (response.data.issues || []).length,
            hasNextPage: !!response.data.nextPageToken,
            totalFetched: allIssues.length + (response.data.issues || []).length,
          });

          data = {
            issues: response.data.issues || [],
            nextPageToken: response.data.nextPageToken,
          };

          cache.set(cacheKey, data, 300);
        } catch (err) {
          logger.error('GET /search/jql failed', {
            status: err.response && err.response.status,
            message: err.message,
          });
          throw err;
        }
      }

      allIssues.push(...data.issues);
      nextPageToken = data.nextPageToken;
    } while (nextPageToken);

    return allIssues;
  }

  /** Jira Server / Data Center v2: GET /search with startAt-based pagination */
  async _fetchAllIssuesV2(jql) {
    const allIssues = [];
    let startAt = 0;
    const maxResults = 250;

    while (true) {
      const cacheKey = `issues_v2_${Buffer.from(jql).toString('base64')}_${startAt}`;
      let data = cache.get(cacheKey);

      if (!data) {
        try {
          const response = await this.client.get('/search', {
            params: {
              jql,
              startAt,
              maxResults,
              fields: 'summary,issuetype,project,status,assignee,priority',
              expand: 'changelog',
            },
          });

          data = {
            issues: response.data.issues || [],
            total: response.data.total || (response.data.issues || []).length,
          };

          cache.set(cacheKey, data, 300);
        } catch (err) {
          logger.error('GET /search (v2) failed', {
            jql,
            startAt,
            status: err.response && err.response.status,
            body: err.response && err.response.data,
            message: err.message,
          });
          throw err;
        }
      }

      allIssues.push(...data.issues);

      if (allIssues.length >= data.total || data.issues.length === 0) break;
      startAt += maxResults;
    }

    return allIssues;
  }

  // ─── Process Issue Changelog for User Activity ───────────────────────────────

  _processIssueActivity(issue, userSet, dateRange, activityMap) {
    if (!issue.changelog || !issue.changelog.histories) return;

    let historyCount = 0;
    let matchedCount = 0;

    for (const history of issue.changelog.histories) {
      historyCount++;
      if (!userSet.has(history.author.accountId)) continue;

      const date = this._getLocalDateString(history.created);
      if (!dateRange.has(date)) {
        logger.debug(`Skipping history for ${issue.key}: date ${date} not in range`);
        continue;
      }

      matchedCount++;
      const mapKey = `${history.author.accountId}::${date}`;

      if (!activityMap.has(mapKey)) {
        activityMap.set(mapKey, []);
      }

      for (const item of history.items) {
        const activityType = item.field === 'status' ? 'status_change' : 'field_update';

        const toStringVal =
          item.toString !== null && item.toString !== undefined && typeof item.toString !== 'function'
            ? String(item.toString)
            : '';
        const fromStringVal =
          item.fromString !== null && item.fromString !== undefined && typeof item.fromString !== 'function'
            ? String(item.fromString)
            : '';

        const event = {
          issueKey: issue.key,
          issueSummary: issue.fields.summary,
          issueType: issue.fields.issuetype.name,
          projectKey: issue.fields.project.key,
          activityType,
          timestamp: history.created,
          detail:
            item.field === 'status'
              ? `${fromStringVal || '(empty)'} → ${toStringVal || '(empty)'}`
              : `Updated ${item.field}: ${toStringVal || '(cleared)'}`,
          userId: history.author.accountId,
        };

        activityMap.get(mapKey).push(event);
      }
    }

    if (historyCount > 0) {
      logger.debug(`Issue ${issue.key}: ${historyCount} histories, ${matchedCount} matched`);
    }
  }

  // ─── Fetch Comments and Worklogs ─────────────────────────────────────────────

  async _fetchCommentsAndWorklogs(issues, userSet, dateRange, activityMap) {
    const batchSize = 10;
    for (let i = 0; i < issues.length; i += batchSize) {
      const batch = issues.slice(i, i + batchSize);
      await Promise.all(
        batch.map(issue => this._processCommentsAndWorklogs(issue, userSet, dateRange, activityMap))
      );
    }
  }

  async _processCommentsAndWorklogs(issue, userSet, dateRange, activityMap) {
    const cacheKey = `comments_worklogs_${issue.key}`;

    try {
      let data = cache.get(cacheKey);

      if (!data) {
        const [commentsRes, worklogsRes] = await Promise.all([
          this.client.get(`/issue/${issue.key}/comment`),
          this.client.get(`/issue/${issue.key}/worklog`),
        ]);
        data = {
          comments: commentsRes.data.comments || [],
          worklogs: worklogsRes.data.worklogs || [],
        };
        cache.set(cacheKey, data, 300);
      }

      for (const comment of data.comments) {
        if (!userSet.has(comment.author.accountId)) continue;
        const date = this._getLocalDateString(comment.created);
        if (!dateRange.has(date)) continue;

        const mapKey = `${comment.author.accountId}::${date}`;
        if (!activityMap.has(mapKey)) activityMap.set(mapKey, []);

        activityMap.get(mapKey).push({
          issueKey: issue.key,
          issueSummary: issue.fields.summary,
          issueType: issue.fields.issuetype.name,
          projectKey: issue.fields.project.key,
          activityType: 'comment',
          timestamp: comment.created,
          detail: 'Added comment',
          userId: comment.author.accountId,
        });
      }

      for (const worklog of data.worklogs) {
        if (!userSet.has(worklog.author.accountId)) continue;
        const date = this._getLocalDateString(worklog.started);
        if (!dateRange.has(date)) continue;

        const mapKey = `${worklog.author.accountId}::${date}`;
        if (!activityMap.has(mapKey)) activityMap.set(mapKey, []);

        activityMap.get(mapKey).push({
          issueKey: issue.key,
          issueSummary: issue.fields.summary,
          issueType: issue.fields.issuetype.name,
          projectKey: issue.fields.project.key,
          activityType: 'worklog',
          timestamp: worklog.started,
          detail: `Logged ${Math.round(worklog.timeSpentSeconds / 3600)}h ${Math.round((worklog.timeSpentSeconds % 3600) / 60)}m`,
          userId: worklog.author.accountId,
          worklogDurationSeconds: worklog.timeSpentSeconds,
        });
      }
    } catch (err) {
      logger.warn(`Failed to fetch comments/worklogs for ${issue.key}`, err);
    }
  }

  // ─── Filter Stats ────────────────────────────────────────────────────────────

  async getFilterStats(filterId) {
    try {
      const filterRes = await this.client.get(`/filter/${filterId}`);
      const jql = filterRes.data.jql;

      const allIssues = [];
      let startAt = 0;
      const maxResults = 100;

      const subModuleFieldId = await this._getSubModuleFieldId();
      const fieldsList = ['assignee', 'status', 'components', 'priority', 'issuetype', 'created', 'resolution'];
      if (subModuleFieldId) {
        fieldsList.push(subModuleFieldId);
      }
      const fieldsStr = fieldsList.join(',');

      if (this.apiVersion === '3') {
        let nextPageToken;
        do {
          const params = { jql, maxResults, fields: fieldsStr };
          if (nextPageToken) params.nextPageToken = nextPageToken;
          const res = await this.client.get('/search/jql', { params });
          allIssues.push(...(res.data.issues || []));
          nextPageToken = res.data.nextPageToken;
        } while (nextPageToken);
      } else {
        while (true) {
          const res = await this.client.get('/search', {
            params: { jql, startAt, maxResults, fields: fieldsStr },
          });
          const issues = res.data.issues || [];
          allIssues.push(...issues);
          if (allIssues.length >= (res.data.total || issues.length) || issues.length === 0) break;
          startAt += maxResults;
        }
      }

      const assigneeStats = new Map();
      const statusStats = new Map();
      const componentStats = new Map();
      const subModuleStats = new Map();
      const priorityStats = new Map();
      const issueTypeStats = new Map();
      const ageStats = new Map();

      ageStats.set('New (< 7d)', 0);
      ageStats.set('Recent (7-30d)', 0);
      ageStats.set('Stagnant (30-90d)', 0);
      ageStats.set('Stale (> 90d)', 0);

      const now = new Date();

      for (const issue of allIssues) {
        const assignee = (issue.fields && issue.fields.assignee) || null;
        const accountId = (assignee && assignee.accountId) || 'unassigned';

        if (!assigneeStats.has(accountId)) {
          assigneeStats.set(accountId, { user: assignee, count: 0 });
        }
        assigneeStats.get(accountId).count++;

        const statusName = (issue.fields && issue.fields.status && issue.fields.status.name) || 'Unknown';
        statusStats.set(statusName, (statusStats.get(statusName) || 0) + 1);

        const components = (issue.fields && issue.fields.components) || [];
        if (components.length === 0) {
          componentStats.set('No Component', (componentStats.get('No Component') || 0) + 1);
        } else {
          for (const comp of components) {
            const compName = comp.name || 'Unknown';
            componentStats.set(compName, (componentStats.get(compName) || 0) + 1);
          }
        }

        // Sub Module custom field
        let subModules = [];
        if (subModuleFieldId && issue.fields) {
          const rawVal = issue.fields[subModuleFieldId];
          subModules = this._extractCustomFieldValue(rawVal);
        }
        if (subModules.length === 0) {
          subModuleStats.set('No Sub Module', (subModuleStats.get('No Sub Module') || 0) + 1);
        } else {
          for (const subMod of subModules) {
            subModuleStats.set(subMod, (subModuleStats.get(subMod) || 0) + 1);
          }
        }

        const priorityName = (issue.fields && issue.fields.priority && issue.fields.priority.name) || 'None';
        priorityStats.set(priorityName, (priorityStats.get(priorityName) || 0) + 1);

        const typeName = (issue.fields && issue.fields.issuetype && issue.fields.issuetype.name) || 'Unknown';
        issueTypeStats.set(typeName, (issueTypeStats.get(typeName) || 0) + 1);

        const createdStr = issue.fields && issue.fields.created;
        if (createdStr) {
          const createdDate = new Date(createdStr);
          const diffMs = now.getTime() - createdDate.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          if (diffDays < 7) {
            ageStats.set('New (< 7d)', (ageStats.get('New (< 7d)') || 0) + 1);
          } else if (diffDays < 30) {
            ageStats.set('Recent (7-30d)', (ageStats.get('Recent (7-30d)') || 0) + 1);
          } else if (diffDays < 90) {
            ageStats.set('Stagnant (30-90d)', (ageStats.get('Stagnant (30-90d)') || 0) + 1);
          } else {
            ageStats.set('Stale (> 90d)', (ageStats.get('Stale (> 90d)') || 0) + 1);
          }
        }
      }

      const statsArray = Array.from(assigneeStats.values())
        .map(stat => ({
          assignee: stat.user ? stat.user.displayName : 'Unassigned',
          accountId: stat.user ? stat.user.accountId : 'unassigned',
          email: stat.user ? stat.user.emailAddress : '',
          avatarUrl:
            stat.user && stat.user.avatarUrls
              ? stat.user.avatarUrls['48x48'] || stat.user.avatarUrls['32x32']
              : '',
          count: stat.count,
        }))
        .sort((a, b) => b.count - a.count);

      const statusArray = Array.from(statusStats.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      const componentArray = Array.from(componentStats.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      const subModuleArray = Array.from(subModuleStats.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      const priorityArray = Array.from(priorityStats.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      const issueTypeArray = Array.from(issueTypeStats.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      const ageArray = Array.from(ageStats.entries()).map(([name, count]) => ({ name, count }));

      return {
        filterName: filterRes.data.name,
        jql,
        totalIssues: allIssues.length,
        assigneeStats: statsArray,
        statusStats: statusArray,
        componentStats: componentArray,
        subModuleStats: subModuleArray,
        priorityStats: priorityArray,
        issueTypeStats: issueTypeArray,
        ageStats: ageArray,
      };
    } catch (err) {
      logger.error('Failed to fetch filter stats', { filterId, message: err.message });
      throw err;
    }
  }

  // ─── Get Projects ────────────────────────────────────────────────────────────

  async getProjects() {
    const cacheKey = 'projects_list';
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const response = await this.client.get('/project/search', { params: { maxResults: 100 } });

    const projects = (response.data && response.data.values) || response.data;
    cache.set(cacheKey, projects, 300);
    return projects;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  _extractCustomFieldValue(fieldVal) {
    if (!fieldVal) return [];
    if (typeof fieldVal === 'string') return [fieldVal];
    if (Array.isArray(fieldVal)) {
      return fieldVal.flatMap(item => this._extractCustomFieldValue(item));
    }
    if (typeof fieldVal === 'object') {
      if (fieldVal.value) return [fieldVal.value];
      if (fieldVal.name) return [fieldVal.name];
    }
    return [];
  }

  async _getSubModuleFieldId() {
    const cacheKey = 'sub_module_field_id';
    const cached = cache.get(cacheKey);
    if (cached !== undefined) return cached;

    try {
      logger.info('Fetching fields from Jira to identify Sub Module field ID');
      const res = await this.client.get('/field');
      const fields = res.data || [];

      const targetNames = ['sub module', 'sub-module', 'submodule'];
      const matchedField = fields.find(f => f.name && targetNames.includes(f.name.toLowerCase()));

      const fieldId = matchedField ? matchedField.id : null;
      logger.info('Sub Module field ID resolved', { fieldId, name: matchedField && matchedField.name });
      cache.set(cacheKey, fieldId, 3600);
      return fieldId;
    } catch (err) {
      logger.warn('Failed to fetch fields from Jira to identify Sub Module field ID', { message: err.message });
      return null;
    }
  }

  _getLocalDateString(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return dateStr.substring(0, 10);
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  _getDateRange(startDate, endDate, excludedDays) {
    const excluded = new Set(excludedDays !== undefined ? excludedDays : [0, 6]);

    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

    const current = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);
    const dates = new Set();

    const tzInfo = {
      inputStartDate: startDate,
      inputEndDate: endDate,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      offset: new Date().getTimezoneOffset(),
    };

    console.log('[DEBUG] getDateRange:', JSON.stringify(tzInfo));

    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (!excluded.has(dayOfWeek)) {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const day = String(current.getDate()).padStart(2, '0');
        dates.add(`${year}-${month}-${day}`);
      }
      current.setDate(current.getDate() + 1);
    }

    const result = Array.from(dates);
    console.log('[DEBUG] getDateRange result:', { inputDates: [startDate, endDate], outputDates: result, totalDays: dates.size });

    return dates;
  }

  clearCache() {
    cache.flushAll();
  }
}

// ─── Singleton factory keyed by config hash ───────────────────────────────────

const serviceMap = new Map();

function getJiraService(config) {
  const key = `${config.baseUrl}::${config.email}`;
  if (!serviceMap.has(key)) {
    serviceMap.set(key, new JiraService(config));
  }
  return serviceMap.get(key);
}

module.exports = { JiraService, getJiraService };
