/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, theme } from 'antd';
import App from './App';
import './styles/global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

import { useConfigStore } from './store/configStore';

// Ant Design theme configurations
const getAntTheme = (currentTheme: 'light' | 'dark') => ({
  algorithm: currentTheme === 'light' ? theme.defaultAlgorithm : theme.darkAlgorithm,
  token: {
    colorPrimary: '#3b82f6',
    colorBgBase: currentTheme === 'light' ? '#f8fafc' : '#0a0e1a',
    colorBgContainer: currentTheme === 'light' ? '#ffffff' : '#111827',
    colorBgElevated: currentTheme === 'light' ? '#ffffff' : '#1a2235',
    colorBorder: currentTheme === 'light' ? '#cbd5e1' : '#1e3a5f',
    colorText: currentTheme === 'light' ? '#0f172a' : '#e2e8f0',
    colorTextSecondary: currentTheme === 'light' ? '#475569' : '#94a3b8',
    colorTextTertiary: currentTheme === 'light' ? '#64748b' : '#64748b',
    borderRadius: 8,
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 14,
  },
  components: {
    Table: {
      colorBgContainer: 'transparent',
      headerBg: currentTheme === 'light' ? '#f1f5f9' : '#1a2235',
      rowHoverBg: currentTheme === 'light' ? '#f1f5f9' : '#1a2235',
    },
    Modal: {
      contentBg: currentTheme === 'light' ? '#ffffff' : '#111827',
      headerBg: currentTheme === 'light' ? '#ffffff' : '#111827',
    },
  },
});

function AppWrapper() {
  const currentTheme = useConfigStore(state => state.theme);

  React.useEffect(() => {
    const root = document.documentElement;
    if (currentTheme === 'light') {
      root.style.setProperty('--color-bg', '#f8fafc');
      root.style.setProperty('--color-surface', '#ffffff');
      root.style.setProperty('--color-surface-2', '#f1f5f9');
      root.style.setProperty('--color-surface-3', '#e2e8f0');
      root.style.setProperty('--color-border', '#cbd5e1');
      root.style.setProperty('--color-border-light', '#e2e8f0');
      root.style.setProperty('--color-text', '#0f172a');
      root.style.setProperty('--color-text-muted', '#64748b');
      root.style.setProperty('--color-text-dim', '#475569');
    } else {
      root.style.setProperty('--color-bg', '#0a0e1a');
      root.style.setProperty('--color-surface', '#111827');
      root.style.setProperty('--color-surface-2', '#1a2235');
      root.style.setProperty('--color-surface-3', '#1e2d45');
      root.style.setProperty('--color-border', '#1e3a5f');
      root.style.setProperty('--color-border-light', '#243b5e');
      root.style.setProperty('--color-text', '#e2e8f0');
      root.style.setProperty('--color-text-muted', '#64748b');
      root.style.setProperty('--color-text-dim', '#94a3b8');
    }
  }, [currentTheme]);

  return (
    <ConfigProvider theme={getAntTheme(currentTheme)}>
      <App />
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppWrapper />
    </QueryClientProvider>
  </React.StrictMode>
);
