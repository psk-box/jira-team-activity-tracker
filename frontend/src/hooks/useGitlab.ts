import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { message } from "antd";
import { validateGitlabConnection, fetchGitlabActivity } from "../services/gitlabApi";
import { useConfigStore } from "../store/configStore";
import { ActivityFilters } from "../types";

// ─── Hook: Validate GitLab Connection ───────────────────────────────────────

export function useValidateGitlabConnection() {
  const { setGitlabConfig } = useConfigStore();

  return useMutation({
    mutationFn: async (config: { baseUrl: string; token: string }) => {
      const user = await validateGitlabConnection(config);
      setGitlabConfig(config);
      return user;
    },
    onSuccess: (user) => {
      message.success(`Connected to GitLab as ${user.name || user.username}`);
    },
    onError: (err: Error) => {
      message.error(`GitLab connection failed: ${err.message}`);
    },
  });
}

// ─── Hook: GitLab Activity Fetching ──────────────────────────────────────────

export function useGitlabActivity(filters: ActivityFilters) {
  const { gitlabConfig, trackedUsers, isGitlabConfigured } = useConfigStore();

  // Filter tracked users to only include those in userIds (if active)
  const filteredUsers = filters.userIds.length > 0
    ? trackedUsers.filter(u => filters.userIds.includes(u.accountId))
    : trackedUsers;

  return useQuery({
    queryKey: [
      "gitlab-activity",
      filteredUsers.map(u => u.accountId),
      filters.startDate,
      filters.endDate,
    ],
    queryFn: () =>
      fetchGitlabActivity(
        gitlabConfig || { baseUrl: "https://gitlab.com", token: "mock" },
        { startDate: filters.startDate, endDate: filters.endDate },
        filteredUsers
      ),
    // Query is enabled if we either have gitlab credentials or if we have tracked users to simulate
    enabled: filteredUsers.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
  });
}
