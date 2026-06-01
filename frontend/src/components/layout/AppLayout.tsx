import React, { useState } from 'react';
import { Layout, Tabs, Badge, Space, Typography, Button, Tooltip } from 'antd';
import {
  TeamOutlined,
  BarChartOutlined,
  RocketOutlined,
  FileTextOutlined,
  SettingOutlined,
  ReloadOutlined,
  SunOutlined,
  MoonOutlined,
} from '@ant-design/icons';
import { useConfigStore } from '../../store/configStore';
import { useClearCache } from '../../hooks/useJira';
import TeamActivityTab from '../dashboard/TeamActivityTab';
import SprintInsightsTab from '../dashboard/SprintInsightsTab';
import ProductivityAnalyticsTab from '../dashboard/ProductivityAnalyticsTab';
import ConfigModal from '../config/ConfigModal';
import StatusIndicator from '../shared/StatusIndicator';
import { ActivityFilters } from '../../types';
import dayjs from 'dayjs';

const { Header, Content } = Layout;
const { Text } = Typography;

function ComingSoon({ title }: { title: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '50vh',
      flexDirection: 'column',
      gap: 16,
      color: 'var(--color-text-muted)',
    }}>
      <div style={{ fontSize: 48 }}>🚧</div>
      <Text style={{ color: 'var(--color-text-muted)', fontSize: 18 }}>{title} — Coming Soon</Text>
    </div>
  );
}

// ─── Main Layout ──────────────────────────────────────────────────────────────

export default function AppLayout() {
  const [activeTab, setActiveTab] = useState('team-activity');
  const [configOpen, setConfigOpen] = useState(false);
  const { isConfigured, trackedUsers, jiraConfig, theme, setTheme } = useConfigStore();
  const clearCache = useClearCache();

  // Lifted Activity Filters state (defaulting to today/current date only)
  const [filters, setFilters] = useState<ActivityFilters>(() => {
    const today = dayjs().format('YYYY-MM-DD');
    return {
      startDate: today,
      endDate: today,
      startTime: '00:00',
      endTime: '23:59',
      userIds: [],
      projectKeys: [],
      issueTypes: [],
      activityTypes: [],
    };
  });

  const tabs = [
    {
      key: 'team-activity',
      label: 'Team Activity',
      icon: <TeamOutlined />,
      component: <TeamActivityTab filters={filters} setFilters={setFilters} />,
      disabled: false,
    },
    {
      key: 'sprint',
      label: 'Sprint Insights',
      icon: <RocketOutlined />,
      component: <SprintInsightsTab filters={filters} />,
      disabled: false,
    },
    {
      key: 'productivity',
      label: 'Productivity Analytics',
      icon: <BarChartOutlined />,
      component: <ProductivityAnalyticsTab filters={filters} />,
      disabled: false,
    },
    {
      key: 'reports',
      label: 'Custom Reports',
      icon: <FileTextOutlined />,
      component: <ComingSoon title="Custom Reports" />,
      disabled: true,
      badge: 'Soon',
    },
  ];

  const tabItems = tabs.map(tab => ({
    key: tab.key,
    label: (
      <Space size={6}>
        {tab.icon}
        <span>{tab.label}</span>
        {tab.badge && (
          <Badge
            count={tab.badge}
            style={{
              backgroundColor: 'var(--color-surface-3)',
              color: 'var(--color-text-muted)',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
            }}
          />
        )}
      </Space>
    ),
    children: tab.component,
    disabled: tab.disabled,
  }));

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        height: 56,
        lineHeight: '56px', // Align text vertically
      }}>
        {/* Logo + Title */}
        <Space size={12} align="center" style={{ height: '100%', display: 'flex', alignItems: 'center' }}>
          <div style={{
            width: 32,
            height: 32,
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 700,
            color: '#fff',
            fontFamily: 'var(--font-mono)',
          }}>
            J
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 15,
              color: 'var(--color-text)',
              lineHeight: 1.2,
            }}>
              Jira Team Activity
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--color-text-muted)',
              lineHeight: 1.0,
              letterSpacing: '0.08em',
              marginTop: 2,
            }}>
              TRACKER v1.0
            </div>
          </div>
        </Space>

        {/* Header Actions */}
        <Space size={12} align="center" style={{ height: '100%', display: 'flex', alignItems: 'center' }}>
          <StatusIndicator
            isConnected={isConfigured}
            baseUrl={jiraConfig?.baseUrl}
            userCount={trackedUsers.length}
          />

          {/* Theme Selection Toggle */}
          <Tooltip title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}>
            <Button
              icon={theme === 'light' ? <MoonOutlined /> : <SunOutlined />}
              size="small"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
          </Tooltip>

          {isConfigured && (
            <Tooltip title="Refresh data (clear cache)">
              <Button
                icon={<ReloadOutlined />}
                size="small"
                onClick={() => clearCache.mutate()}
                loading={clearCache.isPending}
                style={{
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            </Tooltip>
          )}

          <Button
            icon={<SettingOutlined />}
            onClick={() => setConfigOpen(true)}
            style={{
              background: isConfigured ? 'var(--color-primary-dim)' : 'var(--color-surface-2)',
              border: `1px solid ${isConfigured ? 'var(--color-primary)' : 'var(--color-border)'}`,
              color: isConfigured ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {isConfigured ? 'Settings' : 'Configure'}
          </Button>
        </Space>
      </Header>

      <Content style={{ padding: '0' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          style={{ height: '100%' }}
          tabBarStyle={{
            padding: '0 24px',
            marginBottom: 0,
            background: 'var(--color-surface)',
            fontFamily: 'var(--font-display)',
          }}
          tabBarGutter={32}
        />
      </Content>

      <ConfigModal open={configOpen} onClose={() => setConfigOpen(false)} />
    </Layout>
  );
}
