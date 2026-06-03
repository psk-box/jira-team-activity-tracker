import React, { useState } from 'react';
import { Card, Table, Avatar, Space, Typography, Tag, Progress, Button, Tooltip } from 'antd';
import { ClockCircleOutlined, UserOutlined, UpOutlined, DownOutlined, BarChartOutlined } from '@ant-design/icons';
import { useConfigStore } from '../../store/configStore';
import { AggregatedUserActivity } from '../../types';
import dayjs from 'dayjs';

const { Text } = Typography;

interface Props {
  activities: AggregatedUserActivity[];
  isMinimized?: boolean;
  onMinimizeToggle?: () => void;
}

interface UserConsistencyData {
  key: string;
  user: any;
  activeDaysCount: number;
  loggedDaysCount: number;
  totalHours: number;
  maxDayHours: number;
  maxDayDate: string;
  consistencyRate: number;
  bulkRatio: number;
  rating: {
    status: 'consistent' | 'frequent' | 'bulk' | 'none';
    label: string;
    color: string;
    description: string;
  };
}

export default function WorklogConsistencyWidget({ activities, isMinimized, onMinimizeToggle }: Props) {
  const { trackedUsers } = useConfigStore();
  const [localMinimized, setLocalMinimized] = useState(false);
  const minimized = isMinimized !== undefined ? isMinimized : localMinimized;
  const toggleMinimized = onMinimizeToggle ? onMinimizeToggle : () => setLocalMinimized(!localMinimized);

  const tableData: UserConsistencyData[] = trackedUsers.map(user => {
    const userActivities = activities.filter(a => a.userId === user.accountId);

    // Days where there was any activity (comments, changes, or worklogs)
    const activeDates = new Set(userActivities.filter(a => a.totalActivities > 0).map(a => a.date));
    // Days where there were actual worklogs logged
    const loggedDates = new Set(userActivities.filter(a => a.worklogDurationSeconds > 0).map(a => a.date));

    const totalHours = userActivities.reduce((sum, act) => sum + (act.worklogDurationSeconds / 3600), 0);

    let maxDayHours = 0;
    let maxDayDate = '';

    userActivities.forEach(act => {
      const hrs = act.worklogDurationSeconds / 3600;
      if (hrs > maxDayHours) {
        maxDayHours = hrs;
        maxDayDate = act.date;
      }
    });

    const consistencyRate = activeDates.size > 0 
      ? Math.round((loggedDates.size / activeDates.size) * 100)
      : 0;

    const bulkRatio = totalHours > 0 ? (maxDayHours / totalHours) * 100 : 0;

    let rating: UserConsistencyData['rating'] = {
      status: 'none',
      label: 'No Activity',
      color: 'default',
      description: 'No active updates or work logs in Jira for this period.'
    };

    if (activeDates.size > 0) {
      if (totalHours === 0) {
        rating = {
          status: 'none',
          label: 'Incomplete Logs',
          color: 'error',
          description: 'Updates logged in Jira, but 0 hours reported.'
        };
      } else if (consistencyRate >= 80 && bulkRatio < 50) {
        rating = {
          status: 'consistent',
          label: 'Daily Consistent',
          color: 'success',
          description: 'Excellent logging discipline. Logs hours daily on active days.'
        };
      } else if (consistencyRate >= 50 && bulkRatio < 60) {
        rating = {
          status: 'frequent',
          label: 'Frequent',
          color: 'processing',
          description: 'Logs time regularly but misses some active days.'
        };
      } else {
        rating = {
          status: 'bulk',
          label: 'Bulk Logger',
          color: 'warning',
          description: `Logs work infrequently or in large chunks. Single-day represents ${Math.round(bulkRatio)}% of all time.`
        };
      }
    }

    return {
      key: user.accountId,
      user,
      activeDaysCount: activeDates.size,
      loggedDaysCount: loggedDates.size,
      totalHours: parseFloat(totalHours.toFixed(1)),
      maxDayHours: parseFloat(maxDayHours.toFixed(1)),
      maxDayDate,
      consistencyRate,
      bulkRatio,
      rating
    };
  }).sort((a, b) => b.consistencyRate - a.consistencyRate);

  const columns = [
    {
      title: 'Developer',
      key: 'user',
      width: 220,
      render: (_: any, record: UserConsistencyData) => (
        <Space>
          <Avatar src={record.user.avatarUrl} icon={<UserOutlined />}>
            {record.user.displayName[0]}
          </Avatar>
          <Text style={{ fontWeight: 500, color: 'var(--color-text)' }}>
            {record.user.displayName}
          </Text>
        </Space>
      )
    },
    {
      title: 'Worklog Habits Rating',
      dataIndex: 'rating',
      key: 'rating',
      width: 200,
      render: (rating: UserConsistencyData['rating']) => (
        <Tooltip title={rating.description} placement="top">
          <Tag color={rating.color} style={{ fontWeight: 600, padding: '2px 8px', borderRadius: 4, cursor: 'help' }}>
            {rating.label}
          </Tag>
        </Tooltip>
      )
    },
    {
      title: 'Active vs Logged Days',
      key: 'days',
      width: 180,
      render: (_: any, record: UserConsistencyData) => (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--color-text-dim)' }}>
              {record.loggedDaysCount} / {record.activeDaysCount} Days
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
              {record.consistencyRate}%
            </span>
          </div>
          <Progress
            percent={record.consistencyRate}
            showInfo={false}
            strokeColor={{
              '0%': 'var(--color-danger)',
              '100%': 'var(--color-success)'
            }}
            trailColor="var(--color-surface-2)"
            size="small"
          />
        </Space>
      ),
      sorter: (a: UserConsistencyData, b: UserConsistencyData) => a.consistencyRate - b.consistencyRate
    },
    {
      title: 'Total Time Logged',
      dataIndex: 'totalHours',
      key: 'totalHours',
      width: 140,
      align: 'center' as const,
      render: (val: number) => (
        <Text style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{val} hrs</Text>
      ),
      sorter: (a: UserConsistencyData, b: UserConsistencyData) => a.totalHours - b.totalHours
    },
    {
      title: 'Max Single-Day Log',
      key: 'maxLog',
      render: (_: any, record: UserConsistencyData) => {
        if (record.maxDayHours === 0) return <Text type="secondary" style={{ fontStyle: 'italic' }}>—</Text>;
        const dateStr = dayjs(record.maxDayDate).format('MMM DD');

        return (
          <Space direction="vertical" size={0}>
            <Text style={{ fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
              {record.maxDayHours} hrs
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              on {dateStr} ({Math.round(record.bulkRatio)}% of total)
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
          <ClockCircleOutlined style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>
            Worklog Consistency Tracker
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
