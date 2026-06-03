import axios, { AxiosInstance } from "axios";
import { GitlabConfig, GitlabActivityResponse, TrackedUser } from "../types";

// ─── API Client Factory ───────────────────────────────────────────────────────

function createApiClient(config: GitlabConfig): AxiosInstance {
  const client = axios.create({
    baseURL: "/api/gitlab",
    headers: {
      "Content-Type": "application/json",
      "x-gitlab-base-url": config.baseUrl,
      "x-gitlab-token": config.token,
    },
    timeout: 30000, // 30s timeout
  });

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      const message =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "An unexpected GitLab error occurred";
      throw new Error(message);
    }
  );

  return client;
}

// ─── Service Functions ────────────────────────────────────────────────────────

export async function validateGitlabConnection(config: GitlabConfig): Promise<{ username: string; name: string }> {
  const client = createApiClient(config);
  const response = await client.get<{ user: { username: string; name: string } }>("/validate");
  return response.data.user;
}

export async function fetchGitlabActivity(
  config: GitlabConfig,
  filters: { startDate: string; endDate: string },
  users: TrackedUser[]
): Promise<GitlabActivityResponse> {
  const client = createApiClient(config);
  const response = await client.post<GitlabActivityResponse>("/activity", {
    startDate: filters.startDate,
    endDate: filters.endDate,
    users: users.map(u => ({
      accountId: u.accountId,
      displayName: u.displayName,
      emailAddress: u.emailAddress,
      gitlabUsername: u.gitlabUsername,
      gitlabEmail: u.gitlabEmail,
      avatarUrl: u.avatarUrl,
    })),
  });
  return response.data;
}
