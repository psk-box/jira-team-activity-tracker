import React, { useState } from 'react';
import { Card, Table, Avatar, Space, Typography, Tag, Tooltip, Button } from 'antd';
import { AppstoreOutlined, UserOutlined, UpOutlined, DownOutlined } from '@ant-design/icons';
import { useConfigStore } from '../../store/configStore';
import { AggregatedUserActivity } from '../../types';

const { Text } = Typography;

interface Props {
  activities: AggregatedUserActivity[];
  isMinimized?: boolean;
  onMinimizeToggle?: () => void;
}

export default function IssueTypeContributorsWidget({ activities, isMinimized, onMinimizeToggle }: Props) {
  const { trackedUsers } = useConfigStore();
  const [localMinimized, setLocalMinimized] = useState(false);
  const minimized = isMinimized !== undefined ? isMinimized : localMinimized;
  const toggleMinimized = onMinimizeToggle ? onMinimizeToggle : () => setLocalMinimized(!localMinimized);

  // 1. Extract and group events by issue type
  const issueTypeGroups = new Map<string, {
    issueKeys: Set<string>;
    userIds: Set<string>;
    eventCount: number;
  }>();

  activities.forEach(act => {
    act.events.forEach(event => {
      const type = event.issueType || 'Unknown';
      
      if (!issueTypeGroups.has(type)) {
        issueTypeGroups.set(type, {
          issueKeys: new Set(),
          userIds: new Set(),
          eventCount: 0,
        });
      }

      const group = issueTypeGroups.get(type)!;
      group.issueKeys.add(event.issueKey);
      group.userIds.add(event.userId);
      group.eventCount++;
    });
  });

  // 2. Build rows for the table
  const tableData = Array.from(issueTypeGroups.entries()).map(([type, stats]) => {
    const contributors = Array.from(stats.userIds).map(uid => {
      const user = trackedUsers.find(u => u.accountId === uid);
      return user || { accountId: uid, displayName: 'Unknown User', avatarUrl: '' };
    });

    return {
      key: type,
      issueType: type,
      ticketsCount: stats.issueKeys.size,
      eventCount: stats.eventCount,
      contributors,
    };
  }).sort((a, b) => b.eventCount - a.eventCount);

  const columns = [
    {
      title: 'Issue Type',
      dataIndex: 'issueType',
      key: 'issueType',
      width: 180,
      render: (text: string) => {
        let color = 'default';
        if (text.toLowerCase() === 'bug') color = 'error';
        else if (text.toLowerCase() === 'story') color = 'success';
        else if (text.toLowerCase() === 'task') color = 'processing';
        else if (text.toLowerCase() === 'epic') color = 'warning';

        return (
          <Tag color={color} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
            {text}
          </Tag>
        );
      },
    },
    {
      title: 'Contributors',
      key: 'contributors',
      render: (_: any, record: any) => (
        <Avatar.Group max={{ count: 5, style: { color: '#f56a00', backgroundColor: '#fde3cf' } }}>
          {record.contributors.map((user: any) => (
            <Tooltip title={user.displayName} key={user.accountId}>
              <Avatar src={user.avatarUrl} icon={<UserOutlined />}>
                {user.displayName[0]}
              </Avatar>
            </Tooltip>
          ))}
        </Avatar.Group>
      ),
    },
    {
      title: 'Tickets Worked On',
      dataIndex: 'ticketsCount',
      key: 'ticketsCount',
      align: 'center' as const,
      render: (val: number) => (
        <Text style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
          {val} {val === 1 ? 'ticket' : 'tickets'}
        </Text>
      ),
    },
    {
      title: 'Total Activity Events',
      dataIndex: 'eventCount',
      key: 'eventCount',
      align: 'right' as const,
      render: (val: number) => (
        <Text style={{ fontFamily: 'var(--font-mono)' }}>
          {val} updates
        </Text>
      ),
    },
  ];

  if (trackedUsers.length === 0) return null;

  return (
    <Card
      title={
        <Space size={8}>
          <AppstoreOutlined style={{ color: 'var(--color-accent)' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>
            Issue Type Contributors Scorecard
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
        tableData.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '20px 0' }}>
            No events recorded in this date range.
          </div>
        ) : (
          <Table
            dataSource={tableData}
            columns={columns}
            pagination={false}
            size="middle"
            className="fade-in"
          />
        )
      )}
    </Card>
  );
}
