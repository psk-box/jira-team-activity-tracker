import React, { useState } from 'react';
import { Card, Table, Avatar, Space, Typography, Tag, Button, Tooltip } from 'antd';
import { AlertOutlined, UserOutlined, UpOutlined, DownOutlined, ClockCircleOutlined, LinkOutlined } from '@ant-design/icons';
import { useConfigStore } from '../../store/configStore';
import { AggregatedUserActivity, ActivityEvent } from '../../types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text } = Typography;

interface Props {
  activities: AggregatedUserActivity[];
  isMinimized?: boolean;
  onMinimizeToggle?: () => void;
}

interface StaleIssue {
  key: string;
  issueKey: string;
  summary: string;
  projectKey: string;
  issueType: string;
  status: string;
  daysStale: number;
  lastEvent: ActivityEvent;
  lastContributor: {
    displayName: string;
    avatarUrl: string;
    accountId: string;
  };
}

export default function StaleTicketsWidget({ activities, isMinimized, onMinimizeToggle }: Props) {
  const { trackedUsers, jiraConfig } = useConfigStore();
  const [localMinimized, setLocalMinimized] = useState(false);
  const minimized = isMinimized !== undefined ? isMinimized : localMinimized;
  const toggleMinimized = onMinimizeToggle ? onMinimizeToggle : () => setLocalMinimized(!localMinimized);

  // Group all events by issue key
  const issueEventsMap = new Map<string, ActivityEvent[]>();

  activities.forEach(act => {
    act.events.forEach(event => {
      if (!issueEventsMap.has(event.issueKey)) {
        issueEventsMap.set(event.issueKey, []);
      }
      issueEventsMap.get(event.issueKey)!.push(event);
    });
  });

  const isDoneStatus = (detail: string) => {
    const lower = detail.toLowerCase();
    return lower.includes('→ done') ||
           lower.includes('→ resolved') ||
           lower.includes('→ closed') ||
           lower.includes('→ completed') ||
           lower.includes('→ verified');
  };

  const now = Date.now();
  const staleIssues: StaleIssue[] = [];

  issueEventsMap.forEach((events, issueKey) => {
    // Sort events chronologically
    const sorted = [...events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const latestEvent = sorted[sorted.length - 1];

    // Determine current status and if done
    const statusChanges = sorted.filter(e => e.activityType === 'status_change');
    let currentStatus = 'Active';
    let isDone = false;

    if (statusChanges.length > 0) {
      const lastChange = statusChanges[statusChanges.length - 1];
      isDone = isDoneStatus(lastChange.detail);
      
      const parts = lastChange.detail.split('→');
      if (parts.length > 1) {
        currentStatus = parts[parts.length - 1].trim();
      }
    }

    if (!isDone) {
      const lastEventTime = new Date(latestEvent.timestamp).getTime();
      const diffMs = now - lastEventTime;
      const daysStale = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (daysStale >= 3) {
        // Find last contributor info
        const contributor = trackedUsers.find(u => u.accountId === latestEvent.userId) || {
          displayName: 'Unknown User',
          avatarUrl: '',
          accountId: latestEvent.userId
        };

        staleIssues.push({
          key: issueKey,
          issueKey,
          summary: latestEvent.issueSummary,
          projectKey: latestEvent.projectKey,
          issueType: latestEvent.issueType,
          status: currentStatus,
          daysStale,
          lastEvent: latestEvent,
          lastContributor: {
            displayName: contributor.displayName,
            avatarUrl: contributor.avatarUrl,
            accountId: contributor.accountId
          }
        });
      }
    }
  });

  // Sort by days stale descending
  const sortedStaleIssues = staleIssues.sort((a, b) => b.daysStale - a.daysStale);

  const columns = [
    {
      title: 'Issue',
      dataIndex: 'issueKey',
      key: 'issueKey',
      width: 140,
      render: (text: string) => {
        const issueUrl = jiraConfig?.baseUrl
          ? `${jiraConfig.baseUrl.replace(/\/$/, '')}/browse/${text}`
          : null;

        return (
          <Space>
            {issueUrl ? (
              <a href={issueUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                {text} <LinkOutlined style={{ fontSize: 10 }} />
              </a>
            ) : (
              <Text style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{text}</Text>
            )}
          </Space>
        );
      }
    },
    {
      title: 'Summary',
      dataIndex: 'summary',
      key: 'summary',
      render: (text: string, record: StaleIssue) => (
        <Space direction="vertical" size={2}>
          <Text style={{ fontWeight: 500, color: 'var(--color-text)' }} ellipsis={{ tooltip: text }}>
            {text}
          </Text>
          <Space size={4}>
            <Tag style={{ fontSize: 10 }}>{record.issueType}</Tag>
            <Tag color="processing" style={{ fontSize: 10 }}>{record.status}</Tag>
          </Space>
        </Space>
      )
    },
    {
      title: 'Stale Duration',
      dataIndex: 'daysStale',
      key: 'daysStale',
      width: 150,
      render: (val: number) => {
        const color = val > 5 ? 'error' : 'warning';
        const label = val > 5 ? 'Critical' : 'Stale';
        return (
          <Tag color={color} style={{ fontWeight: 600, borderRadius: 4 }}>
            {val} days ({label})
          </Tag>
        );
      },
      sorter: (a: StaleIssue, b: StaleIssue) => a.daysStale - b.daysStale
    },
    {
      title: 'Last Contributor',
      key: 'contributor',
      width: 180,
      render: (_: any, record: StaleIssue) => (
        <Space>
          <Avatar size={20} src={record.lastContributor.avatarUrl} icon={<UserOutlined />}>
            {record.lastContributor.displayName[0]}
          </Avatar>
          <Text style={{ fontSize: 12, color: 'var(--color-text)' }}>
            {record.lastContributor.displayName}
          </Text>
        </Space>
      )
    },
    {
      title: 'Last Activity',
      key: 'lastActivity',
      width: 250,
      render: (_: any, record: StaleIssue) => {
        let actType = record.lastEvent.activityType.replace('_', ' ');
        const dateStr = dayjs(record.lastEvent.timestamp).fromNow();

        return (
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: 12, color: 'var(--color-text-dim)' }} ellipsis={{ tooltip: record.lastEvent.detail }}>
              {record.lastEvent.detail}
            </Text>
            <Text type="secondary" style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
              <ClockCircleOutlined style={{ fontSize: 9 }} />
              <span style={{ textTransform: 'capitalize' }}>{actType}</span> • {dateStr}
            </Text>
          </Space>
        );
      }
    }
  ];

  if (trackedUsers.length === 0) return null;

  return (
    <Card
      title={
        <Space size={8}>
          <AlertOutlined style={{ color: staleIssues.length > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>
            Stale & Blocked Tickets Detector
          </span>
          {staleIssues.length > 0 && (
            <Tag color="error" style={{ borderRadius: 10, marginLeft: 8 }}>
              {staleIssues.length} Warning{staleIssues.length > 1 ? 's' : ''}
            </Tag>
          )}
        </Space>
      }
      extra={
        <Button
          type="text"
          size="small"
          onClick={toggleMinimized}
          icon={minimized ? <DownOutlined /> : <UpOutlined />}
          style={{ color: 'var(--color-text-muted)' }}
        />
      }
      bordered={false}
      style={{ background: 'var(--color-surface)' }}
    >
      {!minimized && (
        sortedStaleIssues.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '24px 0' }}>
            🎉 No stale active tickets found! Everything is moving smoothly.
          </div>
        ) : (
          <Table
            dataSource={sortedStaleIssues}
            columns={columns}
            pagination={{ pageSize: 5 }}
            size="middle"
            className="fade-in"
          />
        )
      )}
    </Card>
  );
}
