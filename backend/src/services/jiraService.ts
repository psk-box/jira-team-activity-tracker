import axios, { AxiosInstance } from "axios";
import NodeCache from "node-cache";
import { logger } from "./logger";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress: string;
  avatarUrls: Record<string, string>;
  active: boolean;
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    issuetype: { name: string; iconUrl: string };
    project: { key: string; name: string };
    status: { name: string };
    assignee: JiraUser | null;
    priority: { name: string } | null;
  };
  changelog?: {
    histories: ChangelogHistory[];
  };
}

export interface ChangelogHistory {
  id: string;
  author: JiraUser;
  created: string;
  items: ChangelogItem[];
}

export interface ChangelogItem {
  field: string;
  fieldtype: string;
  from: string | null;
  fromString: string | null;
  to: string | null;
  toString: string | null;
}

export interface JiraComment {
  id: string;
  author: JiraUser;
  body: string;
  created: string;
  updated: string;
}

export interface JiraWorklog {
  id: string;
  author: JiraUser;
  comment: string;
  started: string;
  timeSpentSeconds: number;
}

export interface ActivityEvent {
  issueKey: string;
  issueSummary: string;
  issueType: string;
  projectKey: string;
  activityType: "status_change" | "field_update" | "comment" | "worklog";
  timestamp: string;
  detail: string;
  userId: string;
  worklogDurationSeconds?: number;
}

export interface UserDailyActivity {
  userId: string;
  displayName: string;
  emailAddress: string;
  avatarUrl: string;
  date: string;
  uniqueIssues: Set<string>;
  totalActivities: number;
  statusChanges: number;
  fieldUpdates: number;
  comments: number;
  worklogs: number;
  events: ActivityEvent[];
}

// ─── Cache ────────────────────────────────────────────────────────────────────

// Cache: 5 min for search results, 15 min for user lookups
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// ─── Service ──────────────────────────────────────────────────────────────────

export class JiraService {
  private client: AxiosInstance;
  private config: JiraConfig;
  // v2 is only used for Server/Data Center fallback; Cloud always uses v3
  private apiVersion: "2" | "3" = "3";

  constructor(config: JiraConfig) {
    this.config = config;
    const baseURL = config.baseUrl.replace(/\/$/, "");

    this.client = axios.create({
      baseURL: `${baseURL}/rest/api/3`,
      auth: {
        username: config.email,
        password: config.apiToken,
      },
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    this.setApiVersion("3");

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error("Jira API error", {
          url: error.config?.url,
          status: error.response?.status,
          message: error.response?.data?.errorMessages || error.message,
        });
        throw error;
      },
    );
  }

  private setApiVersion(version: "2" | "3"): void {
    this.apiVersion = version;
    this.client.defaults.baseURL = `${this.config.baseUrl.replace(/\/$/, "")}/rest/api/${version}`;
  }

  // ─── Validate Connection ────────────────────────────────────────────────────

  async validateConnection(): Promise<JiraUser> {
    try {
      const response = await this.client.get<JiraUser>("/myself");
      return response.data;
    } catch (err: any) {
      // 401 on v3 likely means a Server/Data Center instance — retry with v2
      if (err.response?.status === 401 && this.apiVersion === "3") {
        logger.warn("Jira API v3 failed; retrying validation with v2");
        this.setApiVersion("2");
        const response = await this.client.get<JiraUser>("/myself");
        return response.data;
      }
      throw err;
    }
  }

  // ─── Search Users ───────────────────────────────────────────────────────────

  async searchUsers(query: string): Promise<JiraUser[]> {
    const cacheKey = `users_search_${query}`;
    const cached = cache.get<JiraUser[]>(cacheKey);
    if (cached) return cached;

    const response = await this.client.get<JiraUser[]>("/user/search", {
      params: { query, maxResults: 50 },
    });

    cache.set(cacheKey, response.data, 300); // 5 min
    return response.data;
  }

  // ─── Get User by Account ID ─────────────────────────────────────────────────

  async getUser(accountId: string): Promise<JiraUser> {
    const cacheKey = `user_${accountId}`;
    const cached = cache.get<JiraUser>(cacheKey);
    if (cached) return cached;

    const response = await this.client.get<JiraUser>("/user", {
      params: { accountId },
    });

    cache.set(cacheKey, response.data, 300); // 5 min
    return response.data;
  }

  // ─── Fetch Activity for Users and Date Range ────────────────────────────────

  async fetchUserActivity(
    userIds: string[],
    startDate: string,
    endDate: string,
    projectKeys?: string[],
    startTime?: string,
    endTime?: string,
  ): Promise<Map<string, ActivityEvent[]>> {
    // Default times to 00:00 and 23:59 if not provided
    const startTimeStr = startTime || '00:00';
    const endTimeStr = endTime || '23:59';
    
    const cacheKeyForQuery = `activity_${startDate}_${startTimeStr}_${endDate}_${endTimeStr}_${(projectKeys || []).join("_")}`;
    const cachedResult = cache.get<Map<string, ActivityEvent[]>>(cacheKeyForQuery);
    if (cachedResult) {
      logger.info("Returning cached activity result", { startDate, startTime: startTimeStr, endDate, endTime: endTimeStr, cacheKey: cacheKeyForQuery });
      return cachedResult;
    }

    const projectFilter =
      projectKeys && projectKeys.length > 0
        ? ` AND project IN (${projectKeys.map((k) => `"${k}"`).join(",")})`
        : "";

    // Construct JQL with timestamps using space format (Jira-compatible)
    // Format: "YYYY-MM-DD HH:MM:SS" instead of "YYYY-MM-DDTHH:MM:SS"
    const startDateTime = `${startDate} ${startTimeStr}`;
    const endDateTime = `${endDate} ${endTimeStr}`;
    const jql = `updated >= "${startDateTime}" AND updated <= "${endDateTime}"${projectFilter} ORDER BY updated DESC`;

    logger.info("Fetching Jira issues", { jql, userIds, startTime: startTimeStr, endTime: endTimeStr });

    const allIssues = await this.fetchAllIssues(jql);

    logger.info(`Fetched ${allIssues.length} issues, processing changelogs...`);

    const activityMap = new Map<string, ActivityEvent[]>();
    const userSet = new Set(userIds);
    const dateRange = this.getDateRange(startDate, endDate);

    for (const issue of allIssues) {
      await this.processIssueActivity(issue, userSet, dateRange, activityMap);
    }

    const relevantIssues = allIssues.filter((issue) =>
      issue.changelog?.histories?.some((h) => userSet.has(h.author.accountId)),
    );

    await this.fetchCommentsAndWorklogs(
      relevantIssues,
      userSet,
      dateRange,
      activityMap,
    );

    cache.set(cacheKeyForQuery, activityMap, 300);
    logger.info("Cached activity result", { startDate, endDate, cacheKey: cacheKeyForQuery });

    return activityMap;
  }

  // ─── Fetch All Issues (paginated) ─────────────────────────────────────────
  //
  // Migration note (CHANGE-2046):
  //   • GET /rest/api/3/search  → REMOVED (returns 410)
  //   • POST /rest/api/3/search → REMOVED (returns 410)
  //   • New canonical endpoint:  GET /rest/api/3/search/jql
  //   • Pagination token:        nextPageToken (replaces startAt on v3)
  //   • Server/DC v2 still uses  GET /rest/api/2/search with startAt
  //
  private async fetchAllIssues(jql: string): Promise<JiraIssue[]> {
    if (this.apiVersion === "2") {
      return this.fetchAllIssuesV2(jql);
    }
    return this.fetchAllIssuesV3(jql);
  }

  /** Jira Cloud v3: GET /search/jql with cursor-based nextPageToken pagination (page size: 250) */
  private async fetchAllIssuesV3(jql: string): Promise<JiraIssue[]> {
    const allIssues: JiraIssue[] = [];
    let nextPageToken: string | undefined;
    const maxResults = 250;  // Increased from 100 to reduce API calls by ~60%

    do {
      const params: Record<string, any> = {
        jql,
        maxResults,
        fields: "summary,issuetype,project,status,assignee,priority",
        expand: "changelog",
        ...(nextPageToken ? { nextPageToken } : {}),
      };

      const cacheKey = `issues_v3_${Buffer.from(jql).toString("base64")}_${nextPageToken ?? "start"}`;
      let data = cache.get<{ issues: JiraIssue[]; nextPageToken?: string }>(
        cacheKey,
      );

      if (!data) {
        try {
          logger.info("Calling Jira GET /search/jql", { jql, page: allIssues.length / maxResults + 1 });

          const response = await this.client.get("/search/jql", { params });

          logger.info("GET /search/jql success", {
            issuesCount: response.data.issues?.length ?? 0,
            nextPageToken: !!response.data.nextPageToken,
            totalFetched: allIssues.length + (response.data.issues?.length ?? 0),
          });

          data = {
            issues: response.data.issues ?? [],
            nextPageToken: response.data.nextPageToken,
          };

          cache.set(cacheKey, data, 300);
        } catch (err: any) {
          logger.error("GET /search/jql failed", {
            status: err.response?.status,
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

  /** Jira Server / Data Center v2: GET /search with startAt-based pagination (page size: 250) */
  private async fetchAllIssuesV2(jql: string): Promise<JiraIssue[]> {
    const allIssues: JiraIssue[] = [];
    let startAt = 0;
    const maxResults = 250;  // Increased from 100 to reduce API calls by ~60%

    while (true) {
      const cacheKey = `issues_v2_${Buffer.from(jql).toString("base64")}_${startAt}`;
      let data = cache.get<{ issues: JiraIssue[]; total: number }>(cacheKey);

      if (!data) {
        try {
          const response = await this.client.get("/search", {
            params: {
              jql,
              startAt,
              maxResults,
              fields: "summary,issuetype,project,status,assignee,priority",
              expand: "changelog",
            },
          });

          data = {
            issues: response.data.issues ?? [],
            total: response.data.total ?? (response.data.issues ?? []).length,
          };

          cache.set(cacheKey, data, 300);
        } catch (err: any) {
          logger.error("GET /search (v2) failed", {
            jql,
            startAt,
            status: err.response?.status,
            body: err.response?.data,
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

  // ─── Process Issue Changelog for User Activity ──────────────────────────────

  private processIssueActivity(
    issue: JiraIssue,
    userSet: Set<string>,
    dateRange: Set<string>,
    activityMap: Map<string, ActivityEvent[]>,
  ): void {
    if (!issue.changelog?.histories) return;

    let historyCount = 0;
    let matchedCount = 0;

    for (const history of issue.changelog.histories) {
      historyCount++;
      if (!userSet.has(history.author.accountId)) continue;

      const date = this.getLocalDateString(history.created);
      if (!dateRange.has(date)) {
        logger.debug(`Skipping history for ${issue.key}: date ${date} not in range`, {
          issueKey: issue.key,
          dateRange: Array.from(dateRange),
        });
        continue;
      }

      matchedCount++;
      const mapKey = `${history.author.accountId}::${date}`;

      if (!activityMap.has(mapKey)) {
        activityMap.set(mapKey, []);
      }

      for (const item of history.items) {
        const activityType =
          item.field === "status" ? "status_change" : "field_update";

        const toStringVal = (item.toString !== null && item.toString !== undefined && typeof item.toString !== "function") ? String(item.toString) : "";
        const fromStringVal = (item.fromString !== null && item.fromString !== undefined && typeof item.fromString !== "function") ? String(item.fromString) : "";

        const event: ActivityEvent = {
          issueKey: issue.key,
          issueSummary: issue.fields.summary,
          issueType: issue.fields.issuetype.name,
          projectKey: issue.fields.project.key,
          activityType,
          timestamp: history.created,
          detail:
            item.field === "status"
              ? `${fromStringVal || "(empty)"} → ${toStringVal || "(empty)"}`
              : `Updated ${item.field}: ${toStringVal || "(cleared)"}`,
          userId: history.author.accountId,
        };

        activityMap.get(mapKey)!.push(event);
      }
    }

    if (historyCount > 0) {
      logger.debug(`Issue ${issue.key}: ${historyCount} histories, ${matchedCount} matched`, {
        issueKey: issue.key,
      });
    }
  }

  // ─── Fetch Comments and Worklogs ────────────────────────────────────────────

  private async fetchCommentsAndWorklogs(
    issues: JiraIssue[],
    userSet: Set<string>,
    dateRange: Set<string>,
    activityMap: Map<string, ActivityEvent[]>,
  ): Promise<void> {
    const batchSize = 10;
    for (let i = 0; i < issues.length; i += batchSize) {
      const batch = issues.slice(i, i + batchSize);
      await Promise.all(
        batch.map((issue) =>
          this.processCommentsAndWorklogs(
            issue,
            userSet,
            dateRange,
            activityMap,
          ),
        ),
      );
    }
  }

  private async processCommentsAndWorklogs(
    issue: JiraIssue,
    userSet: Set<string>,
    dateRange: Set<string>,
    activityMap: Map<string, ActivityEvent[]>,
  ): Promise<void> {
    const cacheKey = `comments_worklogs_${issue.key}`;

    try {
      let data = cache.get<{
        comments: JiraComment[];
        worklogs: JiraWorklog[];
      }>(cacheKey);

      if (!data) {
        const [commentsRes, worklogsRes] = await Promise.all([
          this.client.get<{ comments: JiraComment[] }>(
            `/issue/${issue.key}/comment`,
          ),
          this.client.get<{ worklogs: JiraWorklog[] }>(
            `/issue/${issue.key}/worklog`,
          ),
        ]);
        data = {
          comments: commentsRes.data.comments || [],
          worklogs: worklogsRes.data.worklogs || [],
        };
        cache.set(cacheKey, data, 300);
      }

      for (const comment of data.comments) {
        if (!userSet.has(comment.author.accountId)) continue;
        const date = this.getLocalDateString(comment.created);
        if (!dateRange.has(date)) continue;

        const mapKey = `${comment.author.accountId}::${date}`;
        if (!activityMap.has(mapKey)) activityMap.set(mapKey, []);

        (activityMap.get(mapKey) as any[]).push({
          issueKey: issue.key,
          issueSummary: issue.fields.summary,
          issueType: issue.fields.issuetype.name,
          projectKey: issue.fields.project.key,
          activityType: "comment",
          timestamp: comment.created,
          detail: `Added comment`,
          userId: comment.author.accountId,
        } as ActivityEvent);
      }

      for (const worklog of data.worklogs) {
        if (!userSet.has(worklog.author.accountId)) continue;
        const date = this.getLocalDateString(worklog.started);
        if (!dateRange.has(date)) continue;

        const mapKey = `${worklog.author.accountId}::${date}`;
        if (!activityMap.has(mapKey)) activityMap.set(mapKey, []);

        (activityMap.get(mapKey) as any[]).push({
          issueKey: issue.key,
          issueSummary: issue.fields.summary,
          issueType: issue.fields.issuetype.name,
          projectKey: issue.fields.project.key,
          activityType: "worklog",
          timestamp: worklog.started,
          detail: `Logged ${Math.round(worklog.timeSpentSeconds / 3600)}h ${Math.round((worklog.timeSpentSeconds % 3600) / 60)}m`,
          userId: worklog.author.accountId,
          worklogDurationSeconds: worklog.timeSpentSeconds,
        } as ActivityEvent);
      }
    } catch (err) {
      logger.warn(`Failed to fetch comments/worklogs for ${issue.key}`, err);
    }
  }

  // ─── Filter Stats ───────────────────────────────────────────────────────────

  async getFilterStats(filterId: string): Promise<any> {
    try {
      const filterRes = await this.client.get(`/filter/${filterId}`);
      const jql = filterRes.data.jql;

      const allIssues: any[] = [];
      let startAt = 0;
      const maxResults = 100;

      const subModuleFieldId = await this.getSubModuleFieldId();
      const fieldsList = ["assignee", "status", "components", "priority", "issuetype", "created", "resolution"];
      if (subModuleFieldId) {
        fieldsList.push(subModuleFieldId);
      }
      const fieldsStr = fieldsList.join(",");

      if (this.apiVersion === "3") {
         let nextPageToken: string | undefined;
         do {
            const params: any = { jql, maxResults, fields: fieldsStr };
            if (nextPageToken) params.nextPageToken = nextPageToken;
            const res = await this.client.get("/search/jql", { params });
            allIssues.push(...(res.data.issues || []));
            nextPageToken = res.data.nextPageToken;
         } while (nextPageToken);
      } else {
         while (true) {
            const res = await this.client.get("/search", {
               params: { jql, startAt, maxResults, fields: fieldsStr }
            });
            const issues = res.data.issues || [];
            allIssues.push(...issues);
            if (allIssues.length >= (res.data.total || issues.length) || issues.length === 0) break;
            startAt += maxResults;
         }
      }

      const assigneeStats = new Map<string, { user: JiraUser | null, count: number }>();
      const statusStats = new Map<string, number>();
      const componentStats = new Map<string, number>();
      const subModuleStats = new Map<string, number>();
      const priorityStats = new Map<string, number>();
      const issueTypeStats = new Map<string, number>();
      const ageStats = new Map<string, number>();

      // Initialize age categories to maintain display order
      ageStats.set("New (< 7d)", 0);
      ageStats.set("Recent (7-30d)", 0);
      ageStats.set("Stagnant (30-90d)", 0);
      ageStats.set("Stale (> 90d)", 0);

      const now = new Date();

      for (const issue of allIssues) {
        const assignee = issue.fields?.assignee || null;
        const accountId = assignee?.accountId || 'unassigned';

        if (!assigneeStats.has(accountId)) {
          assigneeStats.set(accountId, { user: assignee, count: 0 });
        }
        assigneeStats.get(accountId)!.count++;

        const statusName = issue.fields?.status?.name || 'Unknown';
        statusStats.set(statusName, (statusStats.get(statusName) || 0) + 1);

        const components = issue.fields?.components || [];
        if (components.length === 0) {
          componentStats.set('No Component', (componentStats.get('No Component') || 0) + 1);
        } else {
          for (const comp of components) {
            const compName = comp.name || 'Unknown';
            componentStats.set(compName, (componentStats.get(compName) || 0) + 1);
          }
        }

        // Sub Module custom field
        let subModules: string[] = [];
        if (subModuleFieldId && issue.fields) {
          const rawVal = issue.fields[subModuleFieldId];
          subModules = this.extractCustomFieldValue(rawVal);
        }
        if (subModules.length === 0) {
          subModuleStats.set('No Sub Module', (subModuleStats.get('No Sub Module') || 0) + 1);
        } else {
          for (const subMod of subModules) {
            subModuleStats.set(subMod, (subModuleStats.get(subMod) || 0) + 1);
          }
        }

        // Priority
        const priorityName = issue.fields?.priority?.name || 'None';
        priorityStats.set(priorityName, (priorityStats.get(priorityName) || 0) + 1);

        // Issue Type
        const typeName = issue.fields?.issuetype?.name || 'Unknown';
        issueTypeStats.set(typeName, (issueTypeStats.get(typeName) || 0) + 1);

        // Issue Age
        const createdStr = issue.fields?.created;
        if (createdStr) {
          const createdDate = new Date(createdStr);
          const diffMs = now.getTime() - createdDate.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          if (diffDays < 7) {
            ageStats.set("New (< 7d)", (ageStats.get("New (< 7d)") || 0) + 1);
          } else if (diffDays < 30) {
            ageStats.set("Recent (7-30d)", (ageStats.get("Recent (7-30d)") || 0) + 1);
          } else if (diffDays < 90) {
            ageStats.set("Stagnant (30-90d)", (ageStats.get("Stagnant (30-90d)") || 0) + 1);
          } else {
            ageStats.set("Stale (> 90d)", (ageStats.get("Stale (> 90d)") || 0) + 1);
          }
        }
      }

      const statsArray = Array.from(assigneeStats.values()).map(stat => ({
        assignee: stat.user ? stat.user.displayName : 'Unassigned',
        accountId: stat.user ? stat.user.accountId : 'unassigned',
        email: stat.user ? stat.user.emailAddress : '',
        avatarUrl: stat.user && stat.user.avatarUrls ? stat.user.avatarUrls['48x48'] || stat.user.avatarUrls['32x32'] : '',
        count: stat.count
      })).sort((a, b) => b.count - a.count);

      const statusArray = Array.from(statusStats.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
      const componentArray = Array.from(componentStats.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
      const subModuleArray = Array.from(subModuleStats.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
      const priorityArray = Array.from(priorityStats.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
      const issueTypeArray = Array.from(issueTypeStats.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
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
        ageStats: ageArray
      };
    } catch (err: any) {
      logger.error("Failed to fetch filter stats", { filterId, message: err.message });
      throw err;
    }
  }

  // ─── Get Projects ───────────────────────────────────────────────────────────

  async getProjects(): Promise<{ key: string; name: string; id: string }[]> {
    const cacheKey = "projects_list";
    const cached =
      cache.get<{ key: string; name: string; id: string }[]>(cacheKey);
    if (cached) return cached;

    const response = await this.client.get<
      { key: string; name: string; id: string }[]
    >("/project/search", { params: { maxResults: 100 } });

    const projects = (response.data as any).values || response.data;
    cache.set(cacheKey, projects, 300); // 5 min
    return projects;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private extractCustomFieldValue(fieldVal: any): string[] {
    if (!fieldVal) return [];
    if (typeof fieldVal === 'string') return [fieldVal];
    if (Array.isArray(fieldVal)) {
      return fieldVal.flatMap(item => this.extractCustomFieldValue(item));
    }
    if (typeof fieldVal === 'object') {
      if (fieldVal.value) return [fieldVal.value];
      if (fieldVal.name) return [fieldVal.name];
    }
    return [];
  }

  private async getSubModuleFieldId(): Promise<string | null> {
    const cacheKey = "sub_module_field_id";
    const cached = cache.get<string | null>(cacheKey);
    if (cached !== undefined) return cached;

    try {
      logger.info("Fetching fields from Jira to identify Sub Module field ID");
      const res = await this.client.get<any[]>("/field");
      const fields = res.data || [];
      
      const targetNames = ["sub module", "sub-module", "submodule"];
      const matchedField = fields.find(f => 
        f.name && targetNames.includes(f.name.toLowerCase())
      );
      
      const fieldId = matchedField ? matchedField.id : null;
      logger.info("Sub Module field ID resolved", { fieldId, name: matchedField?.name });
      cache.set(cacheKey, fieldId, 3600); // cache for 1 hour
      return fieldId;
    } catch (err: any) {
      logger.warn("Failed to fetch fields from Jira to identify Sub Module field ID", { message: err.message });
      return null;
    }
  }

  private getLocalDateString(dateStr: string): string {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return dateStr.substring(0, 10);
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getDateRange(startDate: string, endDate: string): Set<string> {
    const dates = new Set<string>();
    
    // Parse dates in LOCAL timezone, not UTC
    // Input: "2026-06-01" should create June 1 in local timezone, not as UTC
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    
    const current = new Date(startYear, startMonth - 1, startDay);  // Creates in local TZ
    const end = new Date(endYear, endMonth - 1, endDay);            // Creates in local TZ
    
    const tzInfo = {
      inputStartDate: startDate,
      inputEndDate: endDate,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      offset: new Date().getTimezoneOffset(),
    };
    
    console.log('[DEBUG] getDateRange:', JSON.stringify(tzInfo));

    while (current <= end) {
      // Format as YYYY-MM-DD in local timezone
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      dates.add(`${year}-${month}-${day}`);
      current.setDate(current.getDate() + 1);
    }

    const result = Array.from(dates);
    console.log('[DEBUG] getDateRange result:', { inputDates: [startDate, endDate], outputDates: result, totalDays: dates.size });

    return dates;
  }

  clearCache(): void {
    cache.flushAll();
  }
}

// Singleton factory keyed by config hash
const serviceMap = new Map<string, JiraService>();

export function getJiraService(config: JiraConfig): JiraService {
  const key = `${config.baseUrl}::${config.email}`;
  if (!serviceMap.has(key)) {
    serviceMap.set(key, new JiraService(config));
  }
  return serviceMap.get(key)!;
}
