import React, { useState } from 'react';
import { Layout, Tabs, Badge, Space, Typography, Button, Tooltip } from 'antd';
import {
  TeamOutlined,
  BarChartOutlined,
  RocketOutlined,
  FileTextOutlined,
  SettingOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useConfigStore } from '../../store/configStore';
import { useClearCache } from '../../hooks/useJira';
import TeamActivityTab from '../dashboard/TeamActivityTab';
import ConfigModal from '../config/ConfigModal';
import StatusIndicator from '../shared/StatusIndicator';

const { Header, Content } = Layout;
const { Text } = Typography;

// ─── Tab Definitions (extensible for future tabs) ─────────────────────────────

const tabs = [
  {
    key: 'team-activity',
    label: 'Team Activity',
    icon: <TeamOutlined />,
    component: <TeamActivityTab />,
    disabled: false,
  },
  {
    key: 'productivity',
    label: 'Productivity Analytics',
    icon: <BarChartOutlined />,
    component: <ComingSoon title="Productivity Analytics" />,
    disabled: true,
    badge: 'Soon',
  },
  {
    key: 'sprint',
    label: 'Sprint Insights',
    icon: <RocketOutlined />,
    component: <ComingSoon title="Sprint Insights" />,
    disabled: true,
    badge: 'Soon',
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
  const { isConfigured, trackedUsers, jiraConfig } = useConfigStore();
  const clearCache = useClearCache();

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
      }}>
        {/* Logo + Title */}
        <Space size={12} align="center">
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
          <div>
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
              letterSpacing: '0.08em',
            }}>
              TRACKER v1.0
            </div>
          </div>
        </Space>

        {/* Header Actions */}
        <Space size={12}>
          <StatusIndicator
            isConnected={isConfigured}
            baseUrl={jiraConfig?.baseUrl}
            userCount={trackedUsers.length}
          />

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
