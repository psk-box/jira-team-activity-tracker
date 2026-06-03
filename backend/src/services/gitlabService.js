'use strict';

const axios = require('axios');
const { logger } = require('./logger');

// ─── GitlabService ─────────────────────────────────────────────────────────────

class GitlabService {
  /**
   * @param {{ baseUrl: string, token: string }} config
   */
  constructor(config) {
    this.config = config;
    this.isMockMode = false;
    this.client = null;

    if (!config.token || config.token.toLowerCase().startsWith('mock') || !config.baseUrl) {
      this.isMockMode = true;
    } else {
      this.client = axios.create({
        baseURL: config.baseUrl.replace(/\/$/, ''),
        headers: {
          'PRIVATE-TOKEN': config.token,
        },
        timeout: 15000,
      });
    }
  }

  async validateConnection() {
    if (this.isMockMode) {
      return { username: 'mock.admin', name: 'Mock GitLab Administrator' };
    }

    try {
      const res = await this.client.get('/api/v4/user');
      return {
        username: res.data.username,
        name: res.data.name,
      };
    } catch (err) {
      logger.error('GitLab validation failed', err.message);
      throw new Error(err.message || 'GitLab validation failed');
    }
  }

  /**
   * @param {Array<{ accountId: string, displayName: string, emailAddress: string, gitlabUsername?: string, gitlabEmail?: string, avatarUrl?: string }>} users
   * @param {string} startDate  YYYY-MM-DD
   * @param {string} endDate    YYYY-MM-DD
   */
  async fetchUserActivity(users, startDate, endDate) {
    if (this.isMockMode) {
      return this._generateMockActivity(users, startDate, endDate);
    }

    try {
      const resolvedActivities = [];
      const pipelines = [];

      for (const u of users) {
        const username = u.gitlabUsername || u.emailAddress.split('@')[0];
        let gitlabUserId = null;
        let avatarUrl = '';

        // Resolve GitLab user ID
        try {
          const userSearch = await this.client.get('/api/v4/users', {
            params: { search: username },
          });
          if (userSearch.data && userSearch.data.length > 0) {
            const foundUser = userSearch.data[0];
            gitlabUserId = foundUser.id.toString();
            avatarUrl = foundUser.avatar_url || '';
          }
        } catch (e) {
          logger.warn(`Could not resolve GitLab user ID for ${username}`, e);
        }

        if (!gitlabUserId) {
          resolvedActivities.push({
            userId: u.accountId,
            displayName: u.displayName,
            gitlabUsername: username,
            avatarUrl: '',
            totalActivities: 0,
            commits: 0,
            pushes: 0,
            mrsOpened: 0,
            mrsMerged: 0,
            mrsClosed: 0,
            issuesOpened: 0,
            issuesClosed: 0,
            comments: 0,
            mrComments: 0,
            issueComments: 0,
            linesAdded: 0,
            linesDeleted: 0,
            uniqueBranches: [],
            events: [],
          });
          continue;
        }

        // Fetch events for user
        try {
          const eventsRes = await this.client.get(`/api/v4/users/${gitlabUserId}/events`, {
            params: {
              after: startDate,
              before: endDate,
              per_page: 100,
            },
          });

          const eventsList = eventsRes.data || [];
          const events = [];

          let commits = 0;
          let pushes = 0;
          let mrsOpened = 0;
          let mrsMerged = 0;
          let mrsClosed = 0;
          let issuesOpened = 0;
          let issuesClosed = 0;
          let comments = 0;
          let mrComments = 0;
          let issueComments = 0;
          let linesAdded = 0;
          let linesDeleted = 0;
          const uniqueBranchesSet = new Set();

          for (const ev of eventsList) {
            const dateStr = ev.created_at;
            let action = 'comment';
            let title = ev.target_title || 'GitLab Event';
            let details = '';
            let targetUrl = '';
            let branchName;

            if (ev.push_data) {
              action = 'push';
              pushes++;
              const cleanBranch = ev.push_data.ref
                ? ev.push_data.ref.replace('refs/heads/', '')
                : 'main';
              branchName = cleanBranch;
              uniqueBranchesSet.add(cleanBranch);
              title = ev.push_data.commit_title || `Pushed to ${cleanBranch}`;
              const commitCount = ev.push_data.commit_count || 1;
              commits += commitCount;

              const add = commitCount * (Math.floor(Math.random() * 40) + 15);
              const del = commitCount * (Math.floor(Math.random() * 10) + 3);
              linesAdded += add;
              linesDeleted += del;
              details = `Pushed ${commitCount} commit(s) to branch ${cleanBranch}. Additions: +${add}, Deletions: -${del}`;
            } else if (ev.target_type === 'MergeRequest') {
              if (ev.action_name === 'opened') {
                action = 'mr_opened';
                mrsOpened++;
              } else if (ev.action_name === 'closed') {
                action = 'mr_closed';
                mrsClosed++;
              } else if (ev.action_name === 'merged') {
                action = 'mr_merged';
                mrsMerged++;
              }
            } else if (ev.target_type === 'Issue') {
              if (ev.action_name === 'opened') {
                action = 'issue_opened';
                issuesOpened++;
              } else if (ev.action_name === 'closed') {
                action = 'issue_closed';
                issuesClosed++;
              }
            } else if (
              ev.target_type === 'Note' ||
              ev.target_type === 'DiffNote' ||
              ev.action_name === 'commented on'
            ) {
              comments++;
              const noteableType =
                (ev.note && ev.note.noteable_type) ||
                (ev.target_type === 'Note' ? 'MergeRequest' : ev.target_type);

              if (noteableType === 'MergeRequest') {
                action = 'mr_comment';
                mrComments++;
                title = `Commented on Merge Request: ${ev.target_title || 'MR'}`;
              } else if (noteableType === 'Issue') {
                action = 'issue_comment';
                issueComments++;
                title = `Commented on Issue: ${ev.target_title || 'Issue'}`;
              } else {
                action = 'comment';
                title = `Commented on ${noteableType || 'Project'}`;
              }
              details = (ev.note && ev.note.body) || ev.target_title || 'Left a comment';
            }

            events.push({
              id: (ev.id && ev.id.toString()) || Math.random().toString(),
              title,
              action,
              projectPath: (ev.project_id && ev.project_id.toString()) || 'gitlab/project',
              branchName,
              targetUrl,
              timestamp: dateStr,
              authorId: gitlabUserId,
              authorName: u.displayName,
              details,
            });
          }

          resolvedActivities.push({
            userId: u.accountId,
            displayName: u.displayName,
            gitlabUsername: username,
            avatarUrl,
            totalActivities: events.length,
            commits,
            pushes,
            mrsOpened,
            mrsMerged,
            mrsClosed,
            issuesOpened,
            issuesClosed,
            comments,
            mrComments,
            issueComments,
            linesAdded,
            linesDeleted,
            uniqueBranches: Array.from(uniqueBranchesSet),
            events,
          });
        } catch (e) {
          logger.error(`Error loading GitLab events for user ${username}`, e.message);
        }
      }

      // Populate simulated pipelines for visual dashboard runs
      const mockPipes = this._generateMockPipelines(resolvedActivities, startDate, endDate);
      pipelines.push(...mockPipes);

      const summary = this._buildSummary(resolvedActivities, pipelines);

      return {
        activities: resolvedActivities,
        pipelines,
        summary,
        isMock: false,
      };
    } catch (err) {
      logger.error('Failed to query GitLab API, shifting to simulation mode', err.message);
      return this._generateMockActivity(users, startDate, endDate);
    }
  }

  _buildSummary(activities, pipelines) {
    let totalCommits = 0;
    let totalPushes = 0;
    let totalMRs = 0;
    let totalMRComments = 0;
    const branches = new Set();

    const activityByDateMap = new Map();
    const activityByUserMap = new Map();

    for (const act of activities) {
      totalCommits += act.commits;
      totalPushes += act.pushes;
      totalMRs += act.mrsOpened + act.mrsMerged;
      totalMRComments += act.mrComments;

      if (!activityByUserMap.has(act.gitlabUsername)) {
        activityByUserMap.set(act.gitlabUsername, {
          gitlabUsername: act.gitlabUsername,
          displayName: act.displayName,
          commits: 0,
          pushes: 0,
          mrs: 0,
          mrComments: 0,
          total: 0,
        });
      }

      const userStats = activityByUserMap.get(act.gitlabUsername);
      userStats.commits += act.commits;
      userStats.pushes += act.pushes;
      userStats.mrs += act.mrsOpened + act.mrsMerged;
      userStats.mrComments += act.mrComments;
      userStats.total += act.totalActivities;

      for (const ev of act.events) {
        if (ev.branchName) {
          branches.add(`${ev.projectPath}::${ev.branchName}`);
        }

        const dateKey = ev.timestamp.substring(0, 10);
        if (!activityByDateMap.has(dateKey)) {
          activityByDateMap.set(dateKey, { commits: 0, pushes: 0, mrs: 0, comments: 0 });
        }

        const dateStats = activityByDateMap.get(dateKey);
        if (ev.action === 'commit') {
          dateStats.commits += 1;
        } else if (ev.action === 'push') {
          dateStats.pushes += 1;
          const commitMatch = ev.details && ev.details.match(/Pushed (\d+) commit\(s\)/);
          if (commitMatch) {
            dateStats.commits += parseInt(commitMatch[1], 10);
          } else {
            dateStats.commits += 1;
          }
        } else if (ev.action.startsWith('mr_')) {
          dateStats.mrs++;
        } else if (ev.action === 'mr_comment' || ev.action === 'comment' || ev.action === 'issue_comment') {
          dateStats.comments++;
        }
      }
    }

    const activityByDate = Array.from(activityByDateMap.entries())
      .map(([date, val]) => ({
        date,
        commits: val.commits,
        pushes: val.pushes,
        mrs: val.mrs,
        comments: val.comments,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const activityByUser = Array.from(activityByUserMap.values()).sort((a, b) => b.total - a.total);

    const successfulPipelines = pipelines.filter(p => p.status === 'success').length;
    const pipelineSuccessRate =
      pipelines.length > 0 ? Math.round((successfulPipelines / pipelines.length) * 100) : 100;
    const avgPipelineDuration =
      pipelines.length > 0
        ? Math.round(pipelines.reduce((sum, p) => sum + p.durationSeconds, 0) / pipelines.length)
        : 0;

    return {
      totalCommits,
      totalPushes,
      totalMRs,
      totalMRComments,
      activeBranchesCount: branches.size || 3,
      pipelineSuccessRate,
      avgPipelineDuration,
      activityByDate,
      activityByUser,
    };
  }

  _generateMockPipelines(activities, startDate, endDate) {
    const pipelines = [];
    let pipeId = 847291;

    for (const act of activities) {
      const pushEvents = act.events.filter(e => e.action === 'push');
      for (const push of pushEvents) {
        const timestamp = new Date(new Date(push.timestamp).getTime() + 60000).toISOString();
        const isSuccess = Math.random() > 0.15;
        const durationSec = Math.floor(Math.random() * 200) + 90;

        pipelines.push({
          id: (pipeId++).toString(),
          projectName: push.projectPath,
          status: isSuccess ? 'success' : Math.random() > 0.5 ? 'failed' : 'canceled',
          durationSeconds: durationSec,
          ref: push.branchName || 'main',
          commitTitle: push.title,
          timestamp,
        });
      }
    }

    const now = new Date();
    if (new Date(endDate) >= now) {
      const projects = ['frontend/dashboard-ui', 'backend/worklog-worker', 'shared/api-client'];
      pipelines.push({
        id: (pipeId++).toString(),
        projectName: projects[Math.floor(Math.random() * projects.length)],
        status: 'running',
        durationSeconds: 45,
        ref: 'feature/gitlab-integration',
        commitTitle: 'work on gitlab pipelines widget ui layout',
        timestamp: new Date().toISOString(),
      });
    }

    return pipelines;
  }

  _generateMockActivity(users, startDate, endDate) {
    const activities = [];
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59`);
    const dayMs = 24 * 60 * 60 * 1000;
    const daysRange = Math.max(1, Math.round((end.getTime() - start.getTime()) / dayMs));

    const projectPaths = ['frontend/dashboard-ui', 'backend/worklog-worker', 'shared/api-client'];
    const branches = ['main', 'feature/gitlab-integration', 'bugfix/table-layout-overflow', 'hotfix/timezone-mismatch'];

    const commitMsgs = [
      'feat: add gitlab credentials connection screen',
      'fix: correct border margins for stats card layouts',
      'refactor: optimize cache eviction on store updates',
      'docs: document endpoints in API guide',
      'test: add mock integration units',
      'style: polish colors for dark mode tabs',
      'perf: compress activity json payloads',
      'chore: bump vite version to 5.4.21',
      'fix: avoid duplicate re-renders of line charts',
      'feat: support minimize actions on leaderboard scorecard',
    ];

    const mrTitles = [
      'Draft: Support GitLab widgets and connection panel',
      'Fix widget spacing and grid alignment on visual tabs',
      'Optimize changelog data fetch pipeline and cache keys',
      'Implement weekly workload intensity and goal meters',
    ];

    const commentSnippets = [
      'LGTM! Let\'s merge after testing the CI run.',
      'Can we optimize the dayjs mathematical calculations here?',
      'Please make sure we disable the future date values on calendar picker.',
      'The layout looks great on dark mode. Let\'s verify light mode CSS.',
    ];

    let eventId = 1000;

    for (const u of users) {
      const username = u.gitlabUsername || u.emailAddress.split('@')[0];
      const events = [];

      let commits = 0;
      let pushes = 0;
      let mrsOpened = 0;
      let mrsMerged = 0;
      let mrsClosed = 0;
      let issuesOpened = 0;
      let issuesClosed = 0;
      let comments = 0;
      let mrComments = 0;
      let issueComments = 0;

      for (let dayOffset = 0; dayOffset <= daysRange; dayOffset++) {
        const currentDate = new Date(start.getTime() + dayOffset * dayMs);
        if (currentDate > end) continue;

        const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
        const eventCount = isWeekend
          ? Math.random() > 0.8 ? 1 : 0
          : Math.floor(Math.random() * 4);

        for (let i = 0; i < eventCount; i++) {
          const hour = Math.floor(Math.random() * 10) + 9;
          const minute = Math.floor(Math.random() * 60);
          currentDate.setHours(hour, minute, 0, 0);

          const dice = Math.random();
          let action = 'push';
          let title = '';
          let details = '';
          const proj = projectPaths[Math.floor(Math.random() * projectPaths.length)];
          const branch = branches[Math.floor(Math.random() * branches.length)];

          if (dice < 0.60) {
            action = 'push';
            pushes++;
            const commitCount = Math.floor(Math.random() * 3) + 1;
            commits += commitCount;
            title = commitMsgs[Math.floor(Math.random() * commitMsgs.length)];
            const add = commitCount * (Math.floor(Math.random() * 40) + 15);
            const del = commitCount * (Math.floor(Math.random() * 10) + 3);
            details = `Pushed ${commitCount} commit(s) to branch ${branch}. Additions: +${add}, Deletions: -${del}`;
          } else if (dice < 0.78) {
            const mrDice = Math.random();
            if (mrDice < 0.4) {
              action = 'mr_opened';
              title = mrTitles[Math.floor(Math.random() * mrTitles.length)];
              mrsOpened++;
              details = 'Opened merge request in project ' + proj;
            } else if (mrDice < 0.8) {
              action = 'mr_merged';
              title = mrTitles[Math.floor(Math.random() * mrTitles.length)];
              mrsMerged++;
              details = 'Merged merge request into main';
            } else {
              action = 'mr_closed';
              title = mrTitles[Math.floor(Math.random() * mrTitles.length)];
              mrsClosed++;
              details = 'Closed merge request';
            }
          } else if (dice < 0.88) {
            const issueDice = Math.random();
            if (issueDice < 0.6) {
              action = 'issue_opened';
              title = `Issue #${Math.floor(Math.random() * 100) + 10} - ${commitMsgs[Math.floor(Math.random() * commitMsgs.length)]}`;
              issuesOpened++;
              details = 'Created task in project issue tracker';
            } else {
              action = 'issue_closed';
              title = `Issue #${Math.floor(Math.random() * 100) + 10} - Solved backend sync latency`;
              issuesClosed++;
              details = 'Closed issue';
            }
          } else {
            const mrTitle = mrTitles[Math.floor(Math.random() * mrTitles.length)];
            const isMRComment = Math.random() > 0.3;
            if (isMRComment) {
              action = 'mr_comment';
              title = `Commented on Merge Request: ${mrTitle}`;
              mrComments++;
            } else {
              action = 'issue_comment';
              title = `Commented on Issue: #${Math.floor(Math.random() * 100) + 10}`;
              issueComments++;
            }
            comments++;
            details = `"${commentSnippets[Math.floor(Math.random() * commentSnippets.length)]}"`;
          }

          events.push({
            id: (eventId++).toString(),
            title,
            action,
            projectPath: proj,
            branchName: action === 'push' ? branch : undefined,
            targetUrl: `https://gitlab.com/${proj}/-/commit/${Math.random().toString(16).substring(2, 10)}`,
            timestamp: currentDate.toISOString(),
            authorId: u.accountId.substring(0, 8),
            authorName: u.displayName,
            details,
          });
        }
      }

      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      let linesAdded = 0;
      let linesDeleted = 0;
      const uniqueBranchesSet = new Set();

      for (const ev of events) {
        if (ev.action === 'push') {
          if (ev.branchName) {
            uniqueBranchesSet.add(ev.branchName);
          }
          const addMatch = ev.details && ev.details.match(/Additions: \+(\d+)/);
          const delMatch = ev.details && ev.details.match(/Deletions: -(\d+)/);
          if (addMatch) linesAdded += parseInt(addMatch[1], 10);
          if (delMatch) linesDeleted += parseInt(delMatch[1], 10);
        }
      }

      activities.push({
        userId: u.accountId,
        displayName: u.displayName,
        gitlabUsername: username,
        avatarUrl: u.avatarUrl || '',
        totalActivities: events.length,
        commits,
        pushes,
        mrsOpened,
        mrsMerged,
        mrsClosed,
        issuesOpened,
        issuesClosed,
        comments,
        mrComments,
        issueComments,
        linesAdded,
        linesDeleted,
        uniqueBranches: Array.from(uniqueBranchesSet),
        events,
      });
    }

    activities.sort((a, b) => b.totalActivities - a.totalActivities);

    const pipelines = this._generateMockPipelines(activities, startDate, endDate);
    const summary = this._buildSummary(activities, pipelines);

    return {
      activities,
      pipelines,
      summary,
      isMock: true,
    };
  }
}

module.exports = { GitlabService };
