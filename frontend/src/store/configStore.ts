import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { JiraConfig, TrackedUser } from '../types';

interface ConfigStore {
  jiraConfig: JiraConfig | null;
  trackedUsers: TrackedUser[];
  isConfigured: boolean;

  setJiraConfig: (config: JiraConfig) => void;
  clearJiraConfig: () => void;
  addTrackedUser: (user: TrackedUser) => void;
  removeTrackedUser: (accountId: string) => void;
  updateTrackedUser: (accountId: string, updates: Partial<TrackedUser>) => void;
  setTrackedUsers: (users: TrackedUser[]) => void;
}

export const useConfigStore = create<ConfigStore>()(
  persist(
    (set, get) => ({
      jiraConfig: null,
      trackedUsers: [],
      isConfigured: false,

      setJiraConfig: (config) => {
        set({ jiraConfig: config, isConfigured: true });
      },

      clearJiraConfig: () => {
        set({ jiraConfig: null, isConfigured: false });
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
    }),
    {
      name: 'jira-tracker-config',
      // Never persist the API token for security - always re-enter
      partialize: (state) => ({
        jiraConfig: state.jiraConfig ? {
          baseUrl: state.jiraConfig.baseUrl,
          email: state.jiraConfig.email,
          apiToken: '', // Don't persist the token
        } : null,
        trackedUsers: state.trackedUsers,
        isConfigured: false, // Always require re-validation
      }),
    }
  )
);
