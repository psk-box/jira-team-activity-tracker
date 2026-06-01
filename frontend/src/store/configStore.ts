import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { JiraConfig, TrackedUser } from '../types';

interface ConfigStore {
  jiraConfig: JiraConfig | null;
  trackedUsers: TrackedUser[];
  isConfigured: boolean;
  theme: 'light' | 'dark';

  setJiraConfig: (config: JiraConfig) => void;
  clearJiraConfig: () => void;
  addTrackedUser: (user: TrackedUser) => void;
  removeTrackedUser: (accountId: string) => void;
  updateTrackedUser: (accountId: string, updates: Partial<TrackedUser>) => void;
  setTrackedUsers: (users: TrackedUser[]) => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useConfigStore = create<ConfigStore>()(
  persist(
    (set, get) => ({
      jiraConfig: null,
      trackedUsers: [],
      isConfigured: false,
      theme: 'dark',

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

      setTheme: (theme) => {
        set({ theme });
      },
    }),
    {
      name: 'jira-tracker-config',
      // Persist the token and theme, as well as configured status
      partialize: (state) => ({
        jiraConfig: state.jiraConfig,
        trackedUsers: state.trackedUsers,
        isConfigured: state.isConfigured,
        theme: state.theme,
      }),
    }
  )
);
