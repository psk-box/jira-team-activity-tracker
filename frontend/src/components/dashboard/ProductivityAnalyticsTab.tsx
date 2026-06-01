import React from 'react';
import { Row, Col, Card, Statistic, Table, Typography, Spin, Tag, Progress, Space } from 'antd';
import {
  ClockCircleOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  FieldTimeOutlined,
  FireOutlined,
} from '@ant-design/icons';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  Legend,
} from 'recharts';
import { useActivity } from '../../hooks/useJira';
import { ActivityFilters, AggregatedUserActivity, ActivityEvent } from '../../types';
import dayjs from 'dayjs';

const { Text } = Typography;

interface Props {
  filters: ActivityFilters;
}

// ─── Types for Internal Calculations ───────────────────────────────────────────
interface IssueCycleDetail {
  key: string;
  issueKey: string;
  summary: string;
  developer: string;
  avatarUrl?: string;
  startTime?: string;
  endTime?: string;
  durationHours?: number;
  commentsCount: number;
  worklogHours: number;
}

const USER_COLORS = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899'];

export default function ProductivityAnalyticsTab({ filters }: Props) {
  const { data, isLoading, isFetching } = useActivity(filters);

  const activities: AggregatedUserActivity[] = data?.activities || [];

  // Helper functions for status checking
  const isActiveStatus = (detail: string) => {
    const lower = detail.toLowerCase();
    return lower.includes('→ in progress') ||
           lower.includes('→ in development') ||
           lower.includes('→ in dev') ||
           lower.includes('→ active') ||
           lower.includes('→ testing') ||
           lower.includes('→ review') ||
           lower.includes('→ ongoing');
  };

  const isDoneStatus = (detail: string) => {
    const lower = detail.toLowerCase();
    return lower.includes('→ done') ||
           lower.includes('→ resolved') ||
           lower.includes('→ closed') ||
           lower.includes('→ completed') ||
           lower.includes('→ verified');
  };

  // ─── 1. Productivity calculations ──────────────────────────────────────────
  
  // Maps to aggregate cycles
  const issueEventsMap = new Map<string, { events: ActivityEvent[]; summary: string; developer: string; avatarUrl?: string }>();
  
  // Aggregate hourly (0-23) and weekly (Mon-Sun) data
  const hourlyCounts = Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, '0')}:00`,
    activities: 0,
  }));

  const weekdayMap: Record<string, number> = {
    'Monday': 0, 'Tuesday': 0, 'Wednesday': 0, 'Thursday': 0, 'Friday': 0, 'Saturday': 0, 'Sunday': 0,
  };

  let totalComments = 0;
  let totalStatusMoves = 0;
  let totalHours = 0;

  // Track WIP vs Completed per user
  const userWipCompletedMap = new Map<string, { displayName: string; completed: Set<string>; activeIssues: Set<string> }>();

  activities.forEach((act: AggregatedUserActivity) => {
    const userId = act.userId;
    if (!userWipCompletedMap.has(userId)) {
      userWipCompletedMap.set(userId, {
        displayName: act.displayName,
        completed: new Set(),
        activeIssues: new Set(),
      });
    }
    const userWip = userWipCompletedMap.get(userId)!;

    act.events.forEach((event: ActivityEvent) => {
      // Hour aggregation
      const hour = dayjs(event.timestamp).hour();
      if (hour >= 0 && hour < 24) {
        hourlyCounts[hour].activities++;
      }

      // Weekday aggregation
      const weekday = dayjs(event.timestamp).format('dddd');
      if (weekday in weekdayMap) {
        weekdayMap[weekday]++;
      }

      // General counts
      if (event.activityType === 'comment') {
        totalComments++;
      } else if (event.activityType === 'status_change') {
        totalStatusMoves++;
        if (isDoneStatus(event.detail)) {
          userWip.completed.add(event.issueKey);
        } else if (isActiveStatus(event.detail)) {
          userWip.activeIssues.add(event.issueKey);
        }
      } else if (event.activityType === 'worklog') {
        totalHours += (event.worklogDurationSeconds || 0) / 3600;
      }

      // Group events by issue key for cycle time calculation
      if (!issueEventsMap.has(event.issueKey)) {
        issueEventsMap.set(event.issueKey, {
          events: [],
          summary: event.issueSummary,
          developer: act.displayName,
          avatarUrl: act.avatarUrl,
        });
      }
      issueEventsMap.get(event.issueKey)!.events.push(event);
    });
  });

  // Calculate cycle times for completed issues
  const completedCycleDetails: IssueCycleDetail[] = [];
  issueEventsMap.forEach((val, issueKey) => {
    // Sort events for this issue chronologically
    const sortedEvents = [...val.events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let startTimestamp: string | undefined;
    let endTimestamp: string | undefined;
    let commentsCount = 0;
    let worklogDurationSec = 0;

    sortedEvents.forEach(e => {
      if (e.activityType === 'comment') {
        commentsCount++;
      } else if (e.activityType === 'worklog') {
        worklogDurationSec += e.worklogDurationSeconds || 0;
      } else if (e.activityType === 'status_change') {
        if (isActiveStatus(e.detail) && !startTimestamp) {
          startTimestamp = e.timestamp;
        }
        if (isDoneStatus(e.detail)) {
          endTimestamp = e.timestamp;
        }
      }
    });

    // Fallbacks: If we see it completed but didn't catch the start transition in the window,
    // we use the earliest event timestamp as start fallback
    if (endTimestamp) {
      const actualStart = startTimestamp || sortedEvents[0].timestamp;
      const durationHrs = dayjs(endTimestamp).diff(dayjs(actualStart), 'hour', true);

      completedCycleDetails.push({
        key: issueKey,
        issueKey,
        summary: val.summary,
        developer: val.developer,
        avatarUrl: val.avatarUrl,
        startTime: dayjs(actualStart).format('MMM DD, HH:mm'),
        endTime: dayjs(endTimestamp).format('MMM DD, HH:mm'),
        durationHours: parseFloat(durationHrs.toFixed(1)),
        commentsCount,
        worklogHours: parseFloat((worklogDurationSec / 3600).toFixed(1)),
      });
    }
  });

  // KPI calculations
  const totalCompleted = completedCycleDetails.length;
  const avgCycleTime = totalCompleted > 0
    ? parseFloat((completedCycleDetails.reduce((sum, item) => sum + (item.durationHours || 0), 0) / totalCompleted).toFixed(1))
    : 0;

  const focusIntensity = totalStatusMoves > 0
    ? parseFloat(((totalComments + (totalHours * 2)) / totalStatusMoves).toFixed(1))
    : 0;

  const timeToValue = totalCompleted > 0
    ? parseFloat((totalHours / totalCompleted).toFixed(1))
    : 0;

  // Active WIP count (issues touched but not completed)
  let activeWipCount = 0;
  issueEventsMap.forEach((val, issueKey) => {
    let completed = false;
    val.events.forEach(e => {
      if (e.activityType === 'status_change' && isDoneStatus(e.detail)) {
        completed = true;
      }
    });
    if (!completed) {
      activeWipCount++;
    }
  });

  // Weekday data formatting
  const weeklyData = [
    { day: 'Mon', activities: weekdayMap['Monday'] },
    { day: 'Tue', activities: weekdayMap['Tuesday'] },
    { day: 'Wed', activities: weekdayMap['Wednesday'] },
    { day: 'Thu', activities: weekdayMap['Thursday'] },
    { day: 'Fri', activities: weekdayMap['Friday'] },
    { day: 'Sat', activities: weekdayMap['Saturday'] },
    { day: 'Sun', activities: weekdayMap['Sunday'] },
  ];

  // WIP vs Completed data formatting
  const wipCompletedData = Array.from(userWipCompletedMap.entries()).map(([userId, val]) => {
    // WIP are issues where the user had active/other events, but they are not marked completed
    const activeCount = val.activeIssues.size;
    const completedCount = val.completed.size;

    return {
      userId,
      name: val.displayName.split(' ')[0],
      activeWip: activeCount,
      completed: completedCount,
    };
  });

  // Table columns for Cycle Time
  const tableColumns = [
    {
      title: 'Issue',
      dataIndex: 'issueKey',
      key: 'issueKey',
      render: (text: string, record: IssueCycleDetail) => (
        <Space direction="vertical" size={2}>
          <Text style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{text}</Text>
          <Text style={{ fontSize: 12, color: 'var(--color-text-dim)' }} ellipsis>{record.summary}</Text>
        </Space>
      ),
      width: '35%',
    },
    {
      title: 'Developer',
      dataIndex: 'developer',
      key: 'developer',
      render: (text: string) => <Text style={{ fontSize: 13, color: 'var(--color-text)' }}>{text}</Text>,
      width: '20%',
    },
    {
      title: 'Active Period',
      key: 'period',
      render: (_: any, record: IssueCycleDetail) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
            Start: {record.startTime}
          </Text>
          <Text style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
            End: {record.endTime}
          </Text>
        </Space>
      ),
      width: '25%',
    },
    {
      title: 'Cycle Time',
      dataIndex: 'durationHours',
      key: 'durationHours',
      align: 'right' as const,
      render: (val: number) => (
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          color: val < 24 ? 'var(--color-success)' : val < 72 ? 'var(--color-warning)' : 'var(--color-danger)',
          background: 'var(--color-surface-2)',
          padding: '4px 8px',
          borderRadius: 4,
          border: '1px solid var(--color-border)',
        }}>
          {val >= 24 ? `${(val / 24).toFixed(1)} days` : `${val} hrs`}
        </span>
      ),
      width: '20%',
    },
  ];

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', flexDirection: 'column', gap: 16 }}>
        <Spin size="large" indicator={<LoadingOutlined style={{ fontSize: 32, color: 'var(--color-primary)' }} />} />
        <Text style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>Calculating productivity insights...</Text>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {isFetching && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
        }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 12, color: 'var(--color-primary)' }} />} />
          Re-analyzing productivity logs…
        </div>
      )}

      {/* KPI Row */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: 'var(--color-surface)' }}>
            <Statistic
              title={<span style={{ color: 'var(--color-text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>AVG CYCLE TIME</span>}
              value={avgCycleTime >= 24 ? parseFloat((avgCycleTime / 24).toFixed(1)) : avgCycleTime}
              valueStyle={{ color: 'var(--color-accent)', fontWeight: 700 }}
              prefix={<ClockCircleOutlined />}
              suffix={avgCycleTime >= 24 ? 'days' : 'hrs'}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: 'var(--color-surface)' }}>
            <Statistic
              title={<span style={{ color: 'var(--color-text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>FOCUS INTENSITY</span>}
              value={focusIntensity}
              valueStyle={{ color: 'var(--color-primary)', fontWeight: 700 }}
              prefix={<ThunderboltOutlined />}
              suffix="index"
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: 'var(--color-surface)' }}>
            <Statistic
              title={<span style={{ color: 'var(--color-text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>TIME TO VALUE</span>}
              value={timeToValue}
              valueStyle={{ color: 'var(--color-success)', fontWeight: 700 }}
              prefix={<FieldTimeOutlined />}
              suffix="hrs/task"
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: 'var(--color-surface)' }}>
            <Statistic
              title={<span style={{ color: 'var(--color-text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>ACTIVE WIP</span>}
              value={activeWipCount}
              valueStyle={{ color: 'var(--color-warning)', fontWeight: 700 }}
              prefix={<FireOutlined />}
              suffix="issues"
            />
          </Card>
        </Col>
      </Row>

      {/* Visual Analytics Row */}
      <Row gutter={[16, 16]}>
        {/* Hourly Activity Distribution */}
        <Col xs={24} lg={12}>
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px 24px',
          }}>
            <Text style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--color-text-muted)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 16,
              display: 'block',
            }}>
              Hourly Activity Volume (Peak Hour Analysis)
            </Text>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={hourlyCounts} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="hourGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}
                />
                <YAxis
                  tick={{ fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: 'var(--color-text)',
                  }}
                  labelStyle={{ color: 'var(--color-text-dim)' }}
                />
                <Area
                  type="monotone"
                  dataKey="activities"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  fill="url(#hourGrad)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Col>

        {/* Weekly Day Distribution */}
        <Col xs={24} lg={12}>
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px 24px',
          }}>
            <Text style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--color-text-muted)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 16,
              display: 'block',
            }}>
              Weekly Workload Intensity
            </Text>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}
                />
                <YAxis
                  tick={{ fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: 'var(--color-text)',
                  }}
                />
                <Bar dataKey="activities" fill="var(--color-primary)" radius={[4, 4, 0, 0]}>
                  {weeklyData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={USER_COLORS[index % USER_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* WIP vs Completed Chart */}
        <Col xs={24} lg={10}>
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px 24px',
            height: '100%',
          }}>
            <Text style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--color-text-muted)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 16,
              display: 'block',
            }}>
              WIP vs Completed tasks per User
            </Text>
            {wipCompletedData.length === 0 ? (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                No active task data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={wipCompletedData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}
                  />
                  <YAxis
                    tick={{ fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      color: 'var(--color-text)',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-mono)', paddingTop: 10 }}
                  />
                  <Bar dataKey="activeWip" name="Active WIP" fill="var(--color-warning)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed" name="Completed" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Col>

        {/* Detailed Cycle Time Table */}
        <Col xs={24} lg={14}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircleOutlined style={{ color: 'var(--color-success)' }} />
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>
                  Issue Cycle Time Detail
                </span>
              </div>
            }
            bordered={false}
            style={{ background: 'var(--color-surface)', height: '100%' }}
            bodyStyle={{ padding: '0 24px 24px 24px' }}
          >
            <Table
              dataSource={completedCycleDetails}
              columns={tableColumns}
              pagination={{ pageSize: 4, size: 'small' }}
              size="middle"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
