// ─── Jira Types ────────────────────────────────────────────────────────────────

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress: string;
  avatarUrls: Record<string, string>;
  active: boolean;
}

export interface ActivityEvent {
  issueKey: string;
  issueSummary: string;
  issueType: string;
  projectKey: string;
  activityType: 'status_change' | 'field_update' | 'comment' | 'worklog';
  timestamp: string;
  detail: string;
  userId: string;
  worklogDurationSeconds?: number;
}

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

export interface ActivityResponse {
  activities: AggregatedUserActivity[];
  summary: DashboardSummary | null;
}

// ─── Config Types ─────────────────────────────────────────────────────────────

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface TrackedUser {
  accountId: string;
  displayName: string;
  emailAddress: string;
  avatarUrl: string;
  gitlabUsername?: string;
  gitlabEmail?: string;
}

export interface AppConfig {
  jiraConfig: JiraConfig | null;
  trackedUsers: TrackedUser[];
  isConfigured: boolean;
}

// ─── Filter Types ─────────────────────────────────────────────────────────────

export interface ActivityFilters {
  startDate: string;
  endDate: string;
  startTime: string;  // HH:MM format
  endTime: string;    // HH:MM format
  userIds: string[];
  projectKeys: string[];
  issueTypes: string[];
  activityTypes: string[];
  search?: string;
}

export interface CachedActivityData {
  timestamp: number;
  data: ActivityResponse;
  dateRange: { startDate: string; endDate: string };
}

// ─── Tab Types ────────────────────────────────────────────────────────────────

export interface AppTab {
  key: string;
  label: string;
  icon: string;
  component: React.ComponentType;
  disabled?: boolean;
  badge?: string;
}

// ─── GitLab Types ─────────────────────────────────────────────────────────────

export interface GitlabConfig {
  baseUrl: string;
  token: string;
}

export interface GitlabActivityEvent {
  id: string;
  title: string;
  action: 'commit' | 'push' | 'mr_opened' | 'mr_merged' | 'mr_closed' | 'issue_opened' | 'issue_closed' | 'comment' | 'mr_comment' | 'issue_comment';
  projectPath: string;
  branchName?: string;
  targetUrl?: string;
  timestamp: string;
  authorId: string;
  authorName: string;
  details?: string;
}

export interface GitlabPipelineRun {
  id: string;
  projectName: string;
  status: 'success' | 'failed' | 'running' | 'canceled';
  durationSeconds: number;
  ref: string;
  commitTitle: string;
  timestamp: string;
}

export interface GitlabUserActivity {
  userId: string;
  displayName: string;
  gitlabUsername: string;
  avatarUrl: string;
  totalActivities: number;
  commits: number;
  pushes: number;
  mrsOpened: number;
  mrsMerged: number;
  mrsClosed: number;
  issuesOpened: number;
  issuesClosed: number;
  comments: number;
  mrComments: number;
  issueComments: number;
  events: GitlabActivityEvent[];
}

export interface GitlabSummary {
  totalCommits: number;
  totalPushes: number;
  totalMRs: number;
  totalMRComments: number;
  activeBranchesCount: number;
  pipelineSuccessRate: number;
  avgPipelineDuration: number;
  activityByDate: { date: string; commits: number; pushes: number; mrs: number; comments: number }[];
  activityByUser: {
    gitlabUsername: string;
    displayName: string;
    commits: number;
    pushes: number;
    mrs: number;
    mrComments: number;
    total: number;
  }[];
}

export interface GitlabActivityResponse {
  activities: GitlabUserActivity[];
  pipelines: GitlabPipelineRun[];
  summary: GitlabSummary;
  isMock: boolean;
}
