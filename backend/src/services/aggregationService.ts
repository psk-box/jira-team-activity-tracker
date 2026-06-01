import { ActivityEvent, JiraUser } from './jiraService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AggregatedUserActivity {
  userId: string;
  displayName: string;
  emailAddress: string;
  avatarUrl: string;
  date: string;
  uniqueIssues: string[];
  totalActivities: number;
  statusChanges: number;
  fieldUpdates: number;
  comments: number;
  worklogs: number;
  worklogDurationSeconds: number;
  events: ActivityEvent[];
}

export interface DashboardSummary {
  totalUsers: number;
  totalUniqueIssues: number;
  totalActivities: number;
  mostActiveUser: { userId: string; displayName: string; count: number } | null;
  activityByType: Record<string, number>;
  activityByDate: { date: string; total: number }[];
  activityByUser: { userId: string; displayName: string; total: number }[];
  worklogByUser: { userId: string; displayName: string; durationSeconds: number }[];
}

// ─── Aggregation Logic ────────────────────────────────────────────────────────

/**
 * Aggregates raw activity events (from changelog + comments + worklogs)
 * into per-user, per-day activity summaries.
 */
export function aggregateActivities(
  activityMap: Map<string, ActivityEvent[]>,
  userMap: Map<string, JiraUser>
): AggregatedUserActivity[] {
  const results: AggregatedUserActivity[] = [];

  for (const [key, events] of activityMap.entries()) {
    const [userId, date] = key.split('::');
    const user = userMap.get(userId);

    if (!user) continue;

    // Deduplicate events by issueKey + activityType + timestamp
    const seen = new Set<string>();
    const deduped: ActivityEvent[] = [];
    for (const event of events) {
      const dedupKey = `${event.issueKey}::${event.activityType}::${event.timestamp}::${event.detail}`;
      if (!seen.has(dedupKey)) {
        seen.add(dedupKey);
        deduped.push(event);
      }
    }

    // Count unique issues (excluding field updates, i.e. updates other than status moves or comments)
    const uniqueIssueSet = new Set(
      deduped
        .filter(e => e.activityType !== 'field_update')
        .map(e => e.issueKey)
    );

    // Count by type
    const statusChanges = deduped.filter(e => e.activityType === 'status_change').length;
    const fieldUpdates = deduped.filter(e => e.activityType === 'field_update').length;
    const comments = deduped.filter(e => e.activityType === 'comment').length;
    const worklogEvents = deduped.filter(e => e.activityType === 'worklog');
    const worklogs = worklogEvents.length;
    const worklogDurationSeconds = worklogEvents.reduce((sum, e) => sum + (e.worklogDurationSeconds || 0), 0);

    // Sort events by timestamp
    deduped.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    results.push({
      userId,
      displayName: user.displayName,
      emailAddress: user.emailAddress,
      avatarUrl: user.avatarUrls?.['48x48'] || '',
      date,
      uniqueIssues: Array.from(uniqueIssueSet),
      totalActivities: deduped.length,
      statusChanges,
      fieldUpdates,
      comments,
      worklogs,
      worklogDurationSeconds,
      events: deduped,
    });
  }

  // Sort by date desc, then by total activities desc
  results.sort((a, b) => {
    const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateDiff !== 0) return dateDiff;
    return b.totalActivities - a.totalActivities;
  });

  return results;
}

/**
 * Builds dashboard summary statistics from aggregated activity data.
 */
export function buildDashboardSummary(
  activities: AggregatedUserActivity[],
  targetDate?: string
): DashboardSummary {
  const today = targetDate || new Date().toISOString().substring(0, 10);
  const todayActivities = activities.filter(a => a.date === today);

  // Unique issues across all users today
  const allIssues = new Set(todayActivities.flatMap(a => a.uniqueIssues));

  // Most active user
  let mostActive: { userId: string; displayName: string; count: number } | null = null;
  for (const activity of todayActivities) {
    if (!mostActive || activity.totalActivities > mostActive.count) {
      mostActive = {
        userId: activity.userId,
        displayName: activity.displayName,
        count: activity.totalActivities,
      };
    }
  }

  // Activity by type (all dates)
  const activityByType: Record<string, number> = {
    status_change: 0,
    field_update: 0,
    comment: 0,
    worklog: 0,
  };
  for (const activity of activities) {
    activityByType.status_change += activity.statusChanges;
    activityByType.field_update += activity.fieldUpdates;
    activityByType.comment += activity.comments;
    activityByType.worklog += activity.worklogs;
  }

  // Activity by date
  const dateMap = new Map<string, number>();
  for (const activity of activities) {
    dateMap.set(activity.date, (dateMap.get(activity.date) || 0) + activity.totalActivities);
  }
  const activityByDate = Array.from(dateMap.entries())
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Activity by user (all dates)
  const userMap = new Map<string, { userId: string; displayName: string; total: number }>();
  for (const activity of activities) {
    if (!userMap.has(activity.userId)) {
      userMap.set(activity.userId, {
        userId: activity.userId,
        displayName: activity.displayName,
        total: 0,
      });
    }
    userMap.get(activity.userId)!.total += activity.totalActivities;
  }
  const activityByUser = Array.from(userMap.values())
    .sort((a, b) => b.total - a.total);

  // Worklog duration by user (all dates)
  const worklogMap = new Map<string, { userId: string; displayName: string; durationSeconds: number }>();
  for (const activity of activities) {
    if (!worklogMap.has(activity.userId)) {
      worklogMap.set(activity.userId, {
        userId: activity.userId,
        displayName: activity.displayName,
        durationSeconds: 0,
      });
    }
    worklogMap.get(activity.userId)!.durationSeconds += activity.worklogDurationSeconds;
  }
  const worklogByUser = Array.from(worklogMap.values())
    .filter(w => w.durationSeconds > 0)
    .sort((a, b) => b.durationSeconds - a.durationSeconds);

  return {
    totalUsers: new Set(todayActivities.map(a => a.userId)).size,
    totalUniqueIssues: allIssues.size,
    totalActivities: todayActivities.reduce((sum, a) => sum + a.totalActivities, 0),
    mostActiveUser: mostActive,
    activityByType,
    activityByDate,
    activityByUser,
    worklogByUser,
  };
}

/**
 * Filters aggregated activities based on given criteria.
 */
export function filterActivities(
  activities: AggregatedUserActivity[],
  filters: {
    userIds?: string[];
    projectKeys?: string[];
    issueTypes?: string[];
    activityTypes?: string[];
    startDate?: string;
    endDate?: string;
  }
): AggregatedUserActivity[] {
  return activities
    .map(activity => {
      // Filter events within this activity
      let events = activity.events;

      if (filters.projectKeys?.length) {
        events = events.filter(e => filters.projectKeys!.includes(e.projectKey));
      }
      if (filters.issueTypes?.length) {
        events = events.filter(e => filters.issueTypes!.includes(e.issueType));
      }
      if (filters.activityTypes?.length) {
        events = events.filter(e => filters.activityTypes!.includes(e.activityType));
      }

      if (events.length === 0) return null;

      // Recalculate counts (excluding field updates)
      const uniqueIssues = [
        ...new Set(
          events
            .filter(e => e.activityType !== 'field_update')
            .map(e => e.issueKey)
        )
      ];
      return {
        ...activity,
        events,
        uniqueIssues,
        totalActivities: events.length,
        statusChanges: events.filter(e => e.activityType === 'status_change').length,
        fieldUpdates: events.filter(e => e.activityType === 'field_update').length,
        comments: events.filter(e => e.activityType === 'comment').length,
        worklogs: events.filter(e => e.activityType === 'worklog').length,
      };
    })
    .filter((a): a is AggregatedUserActivity => {
      if (!a) return false;
      if (filters.userIds?.length && !filters.userIds.includes(a.userId)) return false;
      if (filters.startDate && a.date < filters.startDate) return false;
      if (filters.endDate && a.date > filters.endDate) return false;
      return true;
    });
}
