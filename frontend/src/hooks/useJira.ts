import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import dayjs from 'dayjs';
import {
  validateJiraConnection,
  searchJiraUsers,
  getJiraProjects,
  fetchActivity,
  clearJiraCache,
} from '../services/jiraApi';
import { useConfigStore } from '../store/configStore';
import { ActivityFilters } from '../types';

// ─── Hook: Validate Jira Connection ──────────────────────────────────────────

export function useValidateConnection() {
  const { jiraConfig, setJiraConfig } = useConfigStore();

  return useMutation({
    mutationFn: async (config: { baseUrl: string; email: string; apiToken: string }) => {
      const user = await validateJiraConnection(config);
      setJiraConfig(config);
      return user;
    },
    onSuccess: (user) => {
      message.success(`Connected as ${user.displayName}`);
    },
    onError: (err: Error) => {
      message.error(`Connection failed: ${err.message}`);
    },
  });
}

// ─── Hook: Search Users ───────────────────────────────────────────────────────

export function useSearchUsers(query: string, enabled = true) {
  const { jiraConfig } = useConfigStore();

  return useQuery({
    queryKey: ['users', 'search', query],
    queryFn: () => searchJiraUsers(jiraConfig!, query),
    enabled: !!jiraConfig?.apiToken && enabled && query.length >= 2,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Hook: Projects ───────────────────────────────────────────────────────────

export function useProjects() {
  const { jiraConfig } = useConfigStore();

  return useQuery({
    queryKey: ['projects'],
    queryFn: () => getJiraProjects(jiraConfig!),
    enabled: !!jiraConfig?.apiToken,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Hook: Activity Data with Smart Caching ──────────────────────────────────

// Cache for storing data by date range
const activityDataCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(startDate: string, endDate: string, startTime: string, endTime: string, userIds: string[]): string {
  return `${startDate}::${startTime}::${endDate}::${endTime}::${userIds.join(',')}`;
}

function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_TTL;
}

export function useActivity(filters: ActivityFilters) {
  const { jiraConfig, trackedUsers } = useConfigStore();

  const userIds = filters.userIds.length > 0
    ? filters.userIds
    : trackedUsers.map(u => u.accountId);

  const today = dayjs().format('YYYY-MM-DD');
  const cacheKey = getCacheKey(filters.startDate, filters.endDate, filters.startTime, filters.endTime, userIds);
  const cachedData = activityDataCache.get(cacheKey);
  const hasCachedData = cachedData && isCacheValid(cachedData.timestamp);

  const query = useQuery({
    queryKey: ['activity', userIds, filters.startDate, filters.endDate,
      filters.startTime, filters.endTime,
      filters.projectKeys, filters.issueTypes, filters.activityTypes],
    queryFn: () => fetchActivity(jiraConfig!, {
      ...filters,
      userIds,
      targetDate: today,
    }),
    enabled: !!jiraConfig?.apiToken && userIds.length > 0,
    staleTime: CACHE_TTL,
    refetchOnWindowFocus: false,
    initialData: hasCachedData ? cachedData.data : undefined,
  });

  // Cache the data when successfully fetched
  React.useEffect(() => {
    if (query.data) {
      activityDataCache.set(cacheKey, {
        timestamp: Date.now(),
        data: query.data,
      });
    }
  }, [query.data, cacheKey]);

  return query;
}

// ─── Hook: Clear Cache ────────────────────────────────────────────────────────

export function useClearCache() {
  const { jiraConfig } = useConfigStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => clearJiraCache(jiraConfig!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity'] });
      message.success('Cache cleared, data will refresh');
    },
    onError: (err: Error) => {
      message.error(`Failed to clear cache: ${err.message}`);
    },
  });
}
