import React, { useState } from 'react';
import { Card, Table, Avatar, Space, Typography, Tag, Button } from 'antd';
import { UserOutlined, UpOutlined, DownOutlined, ProfileOutlined } from '@ant-design/icons';
import { useConfigStore } from '../../store/configStore';
import { AggregatedUserActivity } from '../../types';

const { Text } = Typography;

interface Props {
  activities: AggregatedUserActivity[];
  isMinimized?: boolean;
  onMinimizeToggle?: () => void;
}

export default function DeveloperProfilesWidget({ activities, isMinimized, onMinimizeToggle }: Props) {
  const { trackedUsers } = useConfigStore();
  const [localMinimized, setLocalMinimized] = useState(false);
  const minimized = isMinimized !== undefined ? isMinimized : localMinimized;
  const toggleMinimized = onMinimizeToggle ? onMinimizeToggle : () => setLocalMinimized(!localMinimized);

  const tableData = trackedUsers.map(user => {
    const userActivities = activities.filter(a => a.userId === user.accountId);
    
    // Group events of this user by issue type
    const typeCounts = new Map<string, { issues: Set<string>; events: number }>();
    let totalEvents = 0;
    
    userActivities.forEach(act => {
      act.events.forEach(event => {
        const type = event.issueType || 'Unknown';
        if (!typeCounts.has(type)) {
          typeCounts.set(type, { issues: new Set(), events: 0 });
        }
        const tStat = typeCounts.get(type)!;
        tStat.issues.add(event.issueKey);
        tStat.events++;
        totalEvents++;
      });
    });

    // Sort issue types by unique issues count descending
    const sortedTypes = Array.from(typeCounts.entries()).map(([type, stats]) => ({
      type,
      ticketsCount: stats.issues.size,
      eventCount: stats.events,
    })).sort((a, b) => b.ticketsCount - a.ticketsCount);

    return {
      key: user.accountId,
      user,
      issueTypes: sortedTypes,
      totalEvents,
      uniqueTicketsCount: userActivities.reduce((sum, act) => sum + act.uniqueIssues.length, 0),
    };
  }).sort((a, b) => b.totalEvents - a.totalEvents);

  const columns = [
    {
      title: 'Developer',
      key: 'user',
      width: 220,
      render: (_: any, record: any) => (
        <Space>
          <Avatar src={record.user.avatarUrl} icon={<UserOutlined />}>
            {record.user.displayName[0]}
          </Avatar>
          <Text style={{ fontWeight: 500, color: 'var(--color-text)' }}>
            {record.user.displayName}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Issue Types Distribution (Tickets Touched)',
      key: 'issueTypes',
      render: (_: any, record: any) => (
        <Space size={[4, 8]} wrap>
          {record.issueTypes.length === 0 ? (
            <Text type="secondary" style={{ fontStyle: 'italic', fontSize: 12 }}>No activity recorded</Text>
          ) : (
            record.issueTypes.map((item: any) => {
              let color = 'default';
              const lowerType = item.type.toLowerCase();
              if (lowerType === 'bug') color = 'error';
              else if (lowerType === 'story') color = 'success';
              else if (lowerType === 'task') color = 'processing';
              else if (lowerType === 'epic') color = 'warning';

              return (
                <Tag
                  key={item.type}
                  color={color}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '2px 8px',
                    borderRadius: 4,
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{item.type}</span>
                  <span style={{ marginLeft: 4, fontWeight: 'bold', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                    ({item.ticketsCount})
                  </span>
                </Tag>
              );
            })
          )}
        </Space>
      ),
    },
    {
      title: 'Tickets Touched',
      dataIndex: 'uniqueTicketsCount',
      key: 'tickets',
      width: 140,
      align: 'center' as const,
      render: (val: number) => (
        <Text style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{val}</Text>
      ),
    },
    {
      title: 'Total Activity Events',
      dataIndex: 'totalEvents',
      key: 'events',
      width: 150,
      align: 'right' as const,
      render: (val: number) => (
        <Text style={{ fontFamily: 'var(--font-mono)' }}>{val} updates</Text>
      ),
    },
  ];

  if (trackedUsers.length === 0) return null;

  return (
    <Card
      title={
        <Space size={8}>
          <ProfileOutlined style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>
            Developer Issue Type Breakdown
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
          dataSource={tableData}
          columns={columns}
          pagination={false}
          size="middle"
          className="fade-in"
        />
      )}
    </Card>
  );
}
