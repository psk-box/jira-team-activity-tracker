import axios, { AxiosInstance } from 'axios';
import { JiraConfig, JiraUser, ActivityResponse, ActivityFilters } from '../types';

// ─── API Client Factory ───────────────────────────────────────────────────────

function createApiClient(config: JiraConfig): AxiosInstance {
  const client = axios.create({
    baseURL: '/api/jira',
    headers: {
      'Content-Type': 'application/json',
      // Pass Jira config via headers — never in URL or body where logs might capture it
      'x-jira-base-url': config.baseUrl,
      'x-jira-email': config.email,
      'x-jira-token': config.apiToken,
    },
    timeout: 60000, // 60s for large data fetches
  });

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      const message =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        'An unexpected error occurred';
      throw new Error(message);
    }
  );

  return client;
}

// ─── Service Functions ────────────────────────────────────────────────────────

export async function validateJiraConnection(config: JiraConfig): Promise<JiraUser> {
  const client = createApiClient(config);
  const response = await client.get<{ user: JiraUser }>('/validate');
  return response.data.user;
}

export async function searchJiraUsers(config: JiraConfig, query: string): Promise<JiraUser[]> {
  const client = createApiClient(config);
  const response = await client.get<JiraUser[]>('/users/search', {
    params: { query },
  });
  return response.data;
}

export async function getJiraProjects(
  config: JiraConfig
): Promise<{ key: string; name: string; id: string }[]> {
  const client = createApiClient(config);
  const response = await client.get('/projects');
  return response.data;
}

export async function fetchActivity(
  config: JiraConfig,
  filters: ActivityFilters & { targetDate?: string }
): Promise<ActivityResponse> {
  const client = createApiClient(config);
  const response = await client.get<ActivityResponse>('/activity', {
    params: {
      userIds: filters.userIds.join(','),
      startDate: filters.startDate,
      endDate: filters.endDate,
      startTime: filters.startTime,
      endTime: filters.endTime,
      projectKeys: filters.projectKeys?.join(',') || '',
      issueTypes: filters.issueTypes?.join(',') || '',
      activityTypes: filters.activityTypes?.join(',') || '',
      targetDate: filters.targetDate,
    },
  });
  return response.data;
}

export async function clearJiraCache(config: JiraConfig): Promise<void> {
  const client = createApiClient(config);
  await client.post('/cache/clear');
}
