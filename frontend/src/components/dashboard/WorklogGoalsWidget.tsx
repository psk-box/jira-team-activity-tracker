import React, { useState } from 'react';
import { Card, Table, Progress, Avatar, Space, Typography, Tag, Button } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, TrophyOutlined, UpOutlined, DownOutlined } from '@ant-design/icons';
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

export default function WorklogGoalsWidget({ activities, startDate, endDate, isMinimized, onMinimizeToggle }: Props) {
  const { trackedUsers, worklogGoalHours } = useConfigStore();
  const [localMinimized, setLocalMinimized] = useState(false);
  const minimized = isMinimized !== undefined ? isMinimized : localMinimized;
  const toggleMinimized = onMinimizeToggle ? onMinimizeToggle : () => setLocalMinimized(!localMinimized);

  // 1. Generate dates in range, latest first
  const getDatesInRange = (startStr: string, endStr: string) => {
    const dates = [];
    let current = dayjs(startStr);
    const end = dayjs(endStr);
    
    while (current.isBefore(end) || current.isSame(end)) {
      dates.push(current.format('YYYY-MM-DD'));
      current = current.add(1, 'day');
    }
    return dates.reverse();
  };

  const dates = getDatesInRange(startDate, endDate);

  // 2. Build rows for the table
  const tableData = dates.map(date => {
    const metList: { user: typeof trackedUsers[0]; hours: number }[] = [];
    const missedList: { user: typeof trackedUsers[0]; hours: number }[] = [];

    // Group activities for this date
    const dateActivities = activities.filter(a => a.date === date);

    trackedUsers.forEach(user => {
      const userAct = dateActivities.find(a => a.userId === user.accountId);
      const hoursLogged = userAct ? (userAct.worklogDurationSeconds / 3600) : 0;
      const formattedHours = parseFloat(hoursLogged.toFixed(1));

      if (hoursLogged >= worklogGoalHours) {
        metList.push({ user, hours: formattedHours });
      } else {
        missedList.push({ user, hours: formattedHours });
      }
    });

    const totalUsers = trackedUsers.length;
    const metCount = metList.length;
    const progressPercent = totalUsers > 0 ? Math.round((metCount / totalUsers) * 100) : 0;

    return {
      key: date,
      date,
      metList,
      missedList,
      metCount,
      totalUsers,
      progressPercent,
    };
  });

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 150,
      render: (text: string) => (
        <Text style={{ fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
          {dayjs(text).format('ddd, MMM DD')}
        </Text>
      ),
    },
    {
      title: 'Goal Status',
      key: 'status',
      width: 180,
      render: (_: any, record: any) => (
        <Space direction="vertical" style={{ width: '100%' }} size={2}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--color-text-dim)', fontWeight: 500 }}>
              {record.metCount} / {record.totalUsers} Met
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
              {record.progressPercent}%
            </span>
          </div>
          <Progress
            percent={record.progressPercent}
            showInfo={false}
            strokeColor={{
              '0%': 'var(--color-warning)',
              '100%': 'var(--color-success)',
            }}
            trailColor="var(--color-surface-2)"
            size="small"
          />
        </Space>
      ),
    },
    {
      title: `Met Goal (>= ${worklogGoalHours}h)`,
      key: 'met',
      render: (_: any, record: any) => (
        <Space size={[4, 8]} wrap>
          {record.metList.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>None</Text>
          ) : (
            record.metList.map((item: any) => (
              <Tag
                key={item.user.accountId}
                color="success"
                icon={<CheckCircleOutlined />}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: 'rgba(16, 185, 129, 0.1)',
                  borderColor: 'rgba(16, 185, 129, 0.3)',
                  color: 'var(--color-success)',
                  padding: '2px 8px',
                  borderRadius: 4,
                }}
              >
                <Space size={4}>
                  <Avatar size={16} src={item.user.avatarUrl}>
                    {item.user.displayName[0]}
                  </Avatar>
                  <span>{item.user.displayName}</span>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', opacity: 0.85 }}>
                    ({item.hours}h)
                  </span>
                </Space>
              </Tag>
            ))
          )}
        </Space>
      ),
    },
    {
      title: `Missed Goal (< ${worklogGoalHours}h)`,
      key: 'missed',
      render: (_: any, record: any) => (
        <Space size={[4, 8]} wrap>
          {record.missedList.length === 0 ? (
            <Tag
              color="processing"
              icon={<TrophyOutlined />}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'rgba(59, 130, 246, 0.1)',
                borderColor: 'rgba(59, 130, 246, 0.3)',
                color: 'var(--color-primary)',
                padding: '2px 8px',
                borderRadius: 4,
              }}
            >
              All Met Goal!
            </Tag>
          ) : (
            record.missedList.map((item: any) => (
              <Tag
                key={item.user.accountId}
                color="error"
                icon={<CloseCircleOutlined />}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  color: 'var(--color-danger)',
                  padding: '2px 8px',
                  borderRadius: 4,
                }}
              >
                <Space size={4}>
                  <Avatar size={16} src={item.user.avatarUrl}>
                    {item.user.displayName[0]}
                  </Avatar>
                  <span>{item.user.displayName}</span>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', opacity: 0.85 }}>
                    ({item.hours}h)
                  </span>
                </Space>
              </Tag>
            ))
          )}
        </Space>
      ),
    },
  ];

  if (trackedUsers.length === 0) return null;

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <Space size={8}>
            <TrophyOutlined style={{ color: 'var(--color-warning)' }} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>
              Daily Worklog Goals Tracker
            </span>
          </Space>
          <Text style={{ fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
            Goal: {worklogGoalHours} hrs / day
          </Text>
        </div>
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
          pagination={{ pageSize: 5 }}
          size="middle"
          className="fade-in"
        />
      )}
    </Card>
  );
}
