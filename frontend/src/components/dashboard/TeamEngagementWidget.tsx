import React, { useState } from 'react';
import { Card, Table, Avatar, Space, Typography, Tag, Tooltip, Button } from 'antd';
import { CheckCircleOutlined, AlertOutlined, CloseCircleOutlined, HeatMapOutlined, ClockCircleOutlined, UpOutlined, DownOutlined } from '@ant-design/icons';
import { useConfigStore } from '../../store/configStore';
import { AggregatedUserActivity } from '../../types';
import dayjs from 'dayjs';

const { Text } = Typography;

interface Props {
  activities: AggregatedUserActivity[];
  startDate: string;
  endDate: string;
  isMinimized?: boolean;
  onMinimizeToggle?: () => void;
}

export default function TeamEngagementWidget({ activities, startDate, endDate, isMinimized, onMinimizeToggle }: Props) {
  const { trackedUsers, worklogGoalHours } = useConfigStore();
  const [localMinimized, setLocalMinimized] = useState(false);
  const minimized = isMinimized !== undefined ? isMinimized : localMinimized;
  const toggleMinimized = onMinimizeToggle ? onMinimizeToggle : () => setLocalMinimized(!localMinimized);

  // Calculate number of days in selected filter range
  const getDatesCount = (startStr: string, endStr: string) => {
    let current = dayjs(startStr);
    const end = dayjs(endStr);
    let count = 0;
    while (current.isBefore(end) || current.isSame(end)) {
      count++;
      current = current.add(1, 'day');
    }
    return count || 1;
  };

  const numDays = getDatesCount(startDate, endDate);
  const expectedHours = numDays * worklogGoalHours;

  const data = trackedUsers.map(user => {
    const userActivities = activities.filter(a => a.userId === user.accountId);
    
    // Aggregate metrics
    const totalHours = userActivities.reduce((sum, act) => sum + (act.worklogDurationSeconds / 3600), 0);
    const totalEvents = userActivities.reduce((sum, act) => sum + act.totalActivities, 0);
    
    const uniqueIssuesSet = new Set<string>();
    userActivities.forEach(act => {
      act.uniqueIssues.forEach(key => uniqueIssuesSet.add(key));
    });
    const uniqueIssuesCount = uniqueIssuesSet.size;

    // Get last active event
    const allEvents = userActivities.flatMap(a => a.events);
    const sortedEvents = [...allEvents].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const lastEvent = sortedEvents[0] || null;

    // Classification Logic
    let status: 'active' | 'low' | 'inactive' = 'active';
    if (totalEvents === 0 && totalHours === 0) {
      status = 'inactive';
    } else if (totalHours < expectedHours * 0.5) {
      status = 'low';
    }

    return {
      key: user.accountId,
      user,
      totalHours: parseFloat(totalHours.toFixed(1)),
      totalEvents,
      uniqueIssuesCount,
      status,
      lastEvent,
    };
  });

  // Sort by status priority (Inactive first, then Low, then Active) or by active hours
  const sortedData = [...data].sort((a, b) => {
    const statusWeight = { inactive: 0, low: 1, active: 2 };
    if (statusWeight[a.status] !== statusWeight[b.status]) {
      return statusWeight[a.status] - statusWeight[b.status]; // inactive and low first
    }
    return b.totalHours - a.totalHours;
  });

  const columns = [
    {
      title: 'Team Member',
      key: 'user',
      render: (_: any, record: any) => (
        <Space>
          <Avatar src={record.user.avatarUrl}>
            {record.user.displayName[0]}
          </Avatar>
          <Text style={{ fontWeight: 500, color: 'var(--color-text)' }}>
            {record.user.displayName}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Activity Status',
      dataIndex: 'status',
      key: 'status',
      width: 180,
      render: (status: 'active' | 'low' | 'inactive') => {
        if (status === 'inactive') {
          return (
            <Tag
              color="error"
              icon={<CloseCircleOutlined />}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                borderColor: 'rgba(239, 68, 68, 0.3)',
                color: 'var(--color-danger)',
                fontWeight: 600,
                borderRadius: 4,
              }}
            >
              No Activity (Not Working)
            </Tag>
          );
        }
        if (status === 'low') {
          return (
            <Tag
              color="warning"
              icon={<AlertOutlined />}
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                borderColor: 'rgba(245, 158, 11, 0.3)',
                color: 'var(--color-warning)',
                fontWeight: 600,
                borderRadius: 4,
              }}
            >
              Low Engagement
            </Tag>
          );
        }
        return (
          <Tag
            color="success"
            icon={<CheckCircleOutlined />}
            style={{
              background: 'rgba(16, 185, 129, 0.1)',
              borderColor: 'rgba(16, 185, 129, 0.3)',
              color: 'var(--color-success)',
              fontWeight: 600,
              borderRadius: 4,
            }}
          >
            Working Properly
          </Tag>
        );
      },
    },
    {
      title: 'Logged Hours',
      key: 'hours',
      render: (_: any, record: any) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
            {record.totalHours}h / {expectedHours}h
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            Goal: {worklogGoalHours}h × {numDays}d
          </Text>
        </Space>
      ),
    },
    {
      title: 'Total Activities',
      key: 'activities',
      render: (_: any, record: any) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
            {record.totalEvents} events
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            Across {record.uniqueIssuesCount} tickets
          </Text>
        </Space>
      ),
    },
    {
      title: 'Last Active Event',
      key: 'lastSeen',
      render: (_: any, record: any) => {
        if (!record.lastEvent) {
          return <Text type="secondary" style={{ fontStyle: 'italic', fontSize: 12 }}>No activity recorded</Text>;
        }

        const dateStr = dayjs(record.lastEvent.timestamp).format('MMM DD, HH:mm');
        
        let typeLabel = 'Activity';
        if (record.lastEvent.activityType === 'status_change') typeLabel = 'Status Move';
        if (record.lastEvent.activityType === 'comment') typeLabel = 'Comment';
        if (record.lastEvent.activityType === 'worklog') typeLabel = 'Logged Time';
        if (record.lastEvent.activityType === 'field_update') typeLabel = 'Update';

        return (
          <Space direction="vertical" size={0}>
            <Tooltip title={record.lastEvent.detail}>
              <Text strong style={{ fontSize: 12, color: 'var(--color-text-dim)', maxWidth: 280 }} ellipsis>
                {record.lastEvent.issueKey}: {record.lastEvent.detail}
              </Text>
            </Tooltip>
            <Text type="secondary" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              <ClockCircleOutlined style={{ fontSize: 10 }} />
              {dateStr} • <span style={{ textTransform: 'capitalize' }}>{typeLabel}</span>
            </Text>
          </Space>
        );
      },
    },
  ];

  if (trackedUsers.length === 0) return null;

  return (
    <Card
      title={
        <Space size={8}>
          <HeatMapOutlined style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>
            Team Engagement & Activity Status
          </span>
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
        <Table
          dataSource={sortedData}
          columns={columns}
          pagination={false}
          size="middle"
          className="fade-in"
        />
      )}
    </Card>
  );
}
