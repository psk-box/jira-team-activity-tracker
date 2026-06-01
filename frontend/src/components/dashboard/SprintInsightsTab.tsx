import React from 'react';
import { Row, Col, Card, Statistic, Table, Avatar, Progress, Space, Alert, Typography, Spin } from 'antd';
import {
  CheckCircleOutlined,
  EditOutlined,
  MessageOutlined,
  ClockCircleOutlined,
  RocketOutlined,
  BugOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import { useActivity } from '../../hooks/useJira';
import { ActivityFilters, AggregatedUserActivity, ActivityEvent } from '../../types';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

interface Props {
  filters: ActivityFilters;
}

// ─── Scorecard Table Types ────────────────────────────────────────────────────
interface ContributorData {
  key: string;
  displayName: string;
  avatarUrl: string;
  uniqueIssues: number;
  completedTasks: number;
  commentsCount: number;
  hoursLogged: number;
  sprintScore: number;
}

export default function SprintInsightsTab({ filters }: Props) {
  const { data, isLoading, isFetching } = useActivity(filters);

  const activities: AggregatedUserActivity[] = data?.activities || [];

  // ─── Data Extraction & Metrics Aggregation ───────────────────────────────────

  // 1. Identify completed tasks (transitioned to completed state)
  const isDoneStatus = (detail: string) => {
    const lower = detail.toLowerCase();
    return lower.includes('→ done') ||
           lower.includes('→ resolved') ||
           lower.includes('→ closed') ||
           lower.includes('→ completed') ||
           lower.includes('→ verified');
  };

  let totalCompletedIssuesCount = 0;
  let totalComments = 0;
  let totalRefinements = 0;
  let totalHours = 0;

  const completedIssuesSet = new Set<string>();
  const bugsResolvedSet = new Set<string>();
  const totalBugsTouchedSet = new Set<string>();

  // Map to track daily completions for the burn-up chart
  const completionsByDate = new Map<string, number>();

  // Map to track user scorecard statistics
  const userStats = new Map<string, {
    displayName: string;
    avatarUrl: string;
    issues: Set<string>;
    completed: Set<string>;
    comments: number;
    hours: number;
  }>();

  activities.forEach((act: AggregatedUserActivity) => {
    const userId = act.userId;
    if (!userStats.has(userId)) {
      userStats.set(userId, {
        displayName: act.displayName,
        avatarUrl: act.avatarUrl,
        issues: new Set(),
        completed: new Set(),
        comments: 0,
        hours: 0,
      });
    }

    const stats = userStats.get(userId)!;

    act.events.forEach((event: ActivityEvent) => {
      const dateStr = event.timestamp.substring(0, 10);

      // Check for Bug issue types
      const isBug = event.issueType.toLowerCase() === 'bug';
      if (isBug) {
        totalBugsTouchedSet.add(event.issueKey);
      }

      // Add to unique issues only if it is a status change (status move), comment, or worklog
      // Exclude field updates (updating jira other than status move or commenting)
      if (event.activityType === 'status_change' || event.activityType === 'comment' || event.activityType === 'worklog') {
        stats.issues.add(event.issueKey);
      }

      if (event.activityType === 'status_change') {
        if (isDoneStatus(event.detail)) {
          completedIssuesSet.add(event.issueKey);
          stats.completed.add(event.issueKey);
          if (isBug) {
            bugsResolvedSet.add(event.issueKey);
          }
          // Increment daily completions count
          completionsByDate.set(dateStr, (completionsByDate.get(dateStr) || 0) + 1);
        }
      } else if (event.activityType === 'field_update') {
        totalRefinements++;
      } else if (event.activityType === 'comment') {
        totalComments++;
        stats.comments++;
      } else if (event.activityType === 'worklog') {
        const hours = (event.worklogDurationSeconds || 0) / 3600;
        totalHours += hours;
        stats.hours += hours;
      }
    });
  });

  totalCompletedIssuesCount = completedIssuesSet.size;

  // 2. Generate Burn-up Cumulative Completion Chart Data
  // Generate date list within the selected filters range
  const burnUpData: { date: string; completed: number }[] = [];
  const start = dayjs(filters.startDate);
  const end = dayjs(filters.endDate);
  let cumulativeCount = 0;

  for (let current = start; current.isBefore(end) || current.isSame(end); current = current.add(1, 'day')) {
    const dateFormatted = current.format('YYYY-MM-DD');
    const dayCompletions = completionsByDate.get(dateFormatted) || 0;
    cumulativeCount += dayCompletions;
    burnUpData.push({
      date: current.format('MMM DD'),
      completed: cumulativeCount,
    });
  }

  // 3. Bug resolution calculations
  const totalBugs = totalBugsTouchedSet.size;
  const resolvedBugs = bugsResolvedSet.size;
  const bugResolutionRate = totalBugs > 0 ? Math.round((resolvedBugs / totalBugs) * 100) : 0;

  // 4. Create Contributors Scorecard Table Data
  const contributors: ContributorData[] = Array.from(userStats.entries()).map(([userId, stats]) => {
    const uniqueIssues = stats.issues.size;
    const completedTasks = stats.completed.size;
    const commentsCount = stats.comments;
    const hoursLogged = stats.hours;
    
    // Custom Sprint Impact Score algorithm:
    // Completed issues (x10) + comments (x2) + hours logged (x3) + unique issues touched (x4)
    const sprintScore = Math.round(
      (completedTasks * 10) + (commentsCount * 2) + (hoursLogged * 3) + (uniqueIssues * 4)
    );

    return {
      key: userId,
      displayName: stats.displayName,
      avatarUrl: stats.avatarUrl,
      uniqueIssues,
      completedTasks,
      commentsCount,
      hoursLogged: parseFloat(hoursLogged.toFixed(1)),
      sprintScore,
    };
  }).sort((a, b) => b.sprintScore - a.sprintScore);

  const tableColumns = [
    {
      title: 'Team Member',
      dataIndex: 'displayName',
      key: 'displayName',
      render: (text: string, record: ContributorData) => (
        <Space>
          <Avatar src={record.avatarUrl}>{text[0]}</Avatar>
          <Text style={{ fontWeight: 500, color: 'var(--color-text)' }}>{text}</Text>
        </Space>
      ),
    },
    {
      title: 'Issues Touched',
      dataIndex: 'uniqueIssues',
      key: 'uniqueIssues',
      align: 'center' as const,
    },
    {
      title: 'Tasks Completed',
      dataIndex: 'completedTasks',
      key: 'completedTasks',
      align: 'center' as const,
      render: (val: number) => val > 0 ? <Text style={{ color: 'var(--color-success)', fontWeight: 600 }}>{val}</Text> : val,
    },
    {
      title: 'Comments',
      dataIndex: 'commentsCount',
      key: 'commentsCount',
      align: 'center' as const,
    },
    {
      title: 'Hours Logged',
      dataIndex: 'hoursLogged',
      key: 'hoursLogged',
      align: 'center' as const,
      render: (val: number) => `${val}h`,
    },
    {
      title: 'Sprint Impact Score',
      dataIndex: 'sprintScore',
      key: 'sprintScore',
      align: 'right' as const,
      render: (val: number) => (
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          color: val > 0 ? 'var(--color-accent)' : 'var(--color-text-muted)',
          background: val > 0 ? 'var(--color-primary-dim)' : 'transparent',
          padding: '4px 8px',
          borderRadius: 4,
          border: val > 0 ? '1px solid var(--color-primary)' : 'none',
        }}>
          {val} pts
        </span>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', flexDirection: 'column', gap: 16 }}>
        <Spin size="large" indicator={<LoadingOutlined style={{ fontSize: 32, color: 'var(--color-primary)' }} />} />
        <Text style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>Analyzing sprint activity data...</Text>
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
          Re-analyzing sprint changelogs…
        </div>
      )}

      {/* KPI Cards Row */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: 'var(--color-surface)' }}>
            <Statistic
              title={<span style={{ color: 'var(--color-text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>COMPLETED ISSUES</span>}
              value={totalCompletedIssuesCount}
              valueStyle={{ color: 'var(--color-success)', fontWeight: 700 }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: 'var(--color-surface)' }}>
            <Statistic
              title={<span style={{ color: 'var(--color-text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>SCOPE REFINEMENTS</span>}
              value={totalRefinements}
              valueStyle={{ color: 'var(--color-primary)', fontWeight: 700 }}
              prefix={<EditOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: 'var(--color-surface)' }}>
            <Statistic
              title={<span style={{ color: 'var(--color-text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>COLLABORATIONS</span>}
              value={totalComments}
              valueStyle={{ color: 'var(--color-accent)', fontWeight: 700 }}
              prefix={<MessageOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: 'var(--color-surface)' }}>
            <Statistic
              title={<span style={{ color: 'var(--color-text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>TOTAL EFFORT</span>}
              value={totalHours}
              precision={1}
              valueStyle={{ color: 'var(--color-warning)', fontWeight: 700 }}
              prefix={<ClockCircleOutlined />}
              suffix="hrs"
            />
          </Card>
        </Col>
      </Row>

      {/* Visual Analytics Row */}
      <Row gutter={[16, 16]}>
        {/* Sprint Completion Trend (Burn-up) */}
        <Col xs={24} md={16}>
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
              Sprint Burn-up: Cumulative Completed Tasks
            </Text>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={burnUpData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="sprintGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="date"
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
                  formatter={(val) => [`${val} tasks`, 'Completed Cumulative']}
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  stroke="var(--color-success)"
                  strokeWidth={2}
                  fill="url(#sprintGrad)"
                  dot={{ fill: 'var(--color-success)', strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 5, fill: 'var(--color-success)' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Col>

        {/* Bug Quality Metric Card */}
        <Col xs={24} md={8}>
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            gap: 16,
            textAlign: 'center',
          }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <BugOutlined style={{ color: 'var(--color-danger)', fontSize: 18 }} />
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--color-text-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                Bug Resolution Rate
              </span>
            </div>
            
            {totalBugs === 0 ? (
              <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <RocketOutlined style={{ fontSize: 36, color: 'var(--color-success)' }} />
                <Text style={{ fontWeight: 600, color: 'var(--color-text)' }}>Zero Bugs Touched</Text>
                <Text style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>No bugs were updated or active in this date range.</Text>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <Progress
                  type="circle"
                  percent={bugResolutionRate}
                  strokeColor={{
                    '0%': 'var(--color-danger)',
                    '100%': 'var(--color-success)',
                  }}
                  trailColor="var(--color-surface-2)"
                  width={110}
                />
                <div>
                  <Text style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>
                    {resolvedBugs} of {totalBugs} Bugs Resolved
                  </Text>
                  <Text style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    Bugs closed or done within selected dates.
                  </Text>
                </div>
              </div>
            )}
          </div>
        </Col>
      </Row>

      {/* Contributor Scorecard Table */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RocketOutlined style={{ color: 'var(--color-accent)' }} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--color-text)' }}>
              Sprint Contributor Scorecard
            </span>
          </div>
        }
        bordered={false}
        style={{ background: 'var(--color-surface)' }}
      >
        {contributors.length === 0 ? (
          <Alert
            message="No sprint contributions found"
            description="Add tracked team members and ensure activities exist inside the selected date range."
            type="info"
            showIcon
          />
        ) : (
          <Table
            dataSource={contributors}
            columns={tableColumns}
            pagination={false}
            size="middle"
            className="fade-in"
          />
        )}
      </Card>
    </div>
  );
}
