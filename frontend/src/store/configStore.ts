import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { JiraConfig, TrackedUser, GitlabConfig } from '../types';

interface ConfigStore {
  jiraConfig: JiraConfig | null;
  gitlabConfig: GitlabConfig | null;
  trackedUsers: TrackedUser[];
  isConfigured: boolean;
  isGitlabConfigured: boolean;
  theme: 'light' | 'dark';
  worklogGoalHours: number;

  setJiraConfig: (config: JiraConfig) => void;
  clearJiraConfig: () => void;
  setGitlabConfig: (config: GitlabConfig) => void;
  clearGitlabConfig: () => void;
  addTrackedUser: (user: TrackedUser) => void;
  removeTrackedUser: (accountId: string) => void;
  updateTrackedUser: (accountId: string, updates: Partial<TrackedUser>) => void;
  setTrackedUsers: (users: TrackedUser[]) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setWorklogGoalHours: (hours: number) => void;
}

export const useConfigStore = create<ConfigStore>()(
  persist(
    (set, get) => ({
      jiraConfig: null,
      gitlabConfig: null,
      trackedUsers: [],
      isConfigured: false,
      isGitlabConfigured: false,
      theme: 'dark',
      worklogGoalHours: 8,

      setJiraConfig: (config) => {
        set({ jiraConfig: config, isConfigured: true });
      },

      clearJiraConfig: () => {
        set({ jiraConfig: null, isConfigured: false });
      },

      setGitlabConfig: (config) => {
        set({ gitlabConfig: config, isGitlabConfigured: true });
      },

      clearGitlabConfig: () => {
        set({ gitlabConfig: null, isGitlabConfigured: false });
      },

      addTrackedUser: (user) => {
        const existing = get().trackedUsers.find(u => u.accountId === user.accountId);
        if (!existing) {
          set(state => ({ trackedUsers: [...state.trackedUsers, user] }));
        }
      },

      removeTrackedUser: (accountId) => {
        set(state => ({
          trackedUsers: state.trackedUsers.filter(u => u.accountId !== accountId),
        }));
      },

      updateTrackedUser: (accountId, updates) => {
        set(state => ({
          trackedUsers: state.trackedUsers.map(u =>
            u.accountId === accountId ? { ...u, ...updates } : u
          ),
        }));
      },

      setTrackedUsers: (users) => {
        set({ trackedUsers: users });
      },

      setTheme: (theme) => {
        set({ theme });
      },

      setWorklogGoalHours: (hours) => {
        set({ worklogGoalHours: hours });
      },
    }),
    {
      name: 'jira-tracker-config',
      // Persist the token, theme, and goals, as well as configured status
      partialize: (state) => ({
        jiraConfig: state.jiraConfig,
        gitlabConfig: state.gitlabConfig,
        trackedUsers: state.trackedUsers,
        isConfigured: state.isConfigured,
        isGitlabConfigured: state.isGitlabConfigured,
        theme: state.theme,
        worklogGoalHours: state.worklogGoalHours,
      }),
    }
  )
);
