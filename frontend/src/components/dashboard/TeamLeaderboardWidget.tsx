import React, { useState } from 'react';
import { Card, Table, Avatar, Space, Typography, Row, Col, Tooltip, Button } from 'antd';
import { TrophyOutlined, AlertOutlined, CrownOutlined, IssuesCloseOutlined, ClockCircleOutlined, InfoCircleOutlined, UpOutlined, DownOutlined } from '@ant-design/icons';
import { useConfigStore } from '../../store/configStore';
import { AggregatedUserActivity } from '../../types';

const { Text, Title } = Typography;

interface Props {
  activities: AggregatedUserActivity[];
  isMinimized?: boolean;
  onMinimizeToggle?: () => void;
}

// Helper to compute leaderboard data
function getLeaderboardData(activities: AggregatedUserActivity[], trackedUsers: any[]) {
  const data = trackedUsers.map(user => {
    const userActivities = activities.filter(a => a.userId === user.accountId);
    const loggedHours = userActivities.reduce((sum, act) => sum + (act.worklogDurationSeconds / 3600), 0);
    const uniqueIssuesSet = new Set<string>();
    userActivities.forEach(act => {
      act.uniqueIssues.forEach(key => uniqueIssuesSet.add(key));
    });
    const uniqueIssuesCount = uniqueIssuesSet.size;

    // Performance Score Formula: (Unique Issues Touched * 5) + Logged Hours
    const performanceScore = parseFloat(((uniqueIssuesCount * 5) + loggedHours).toFixed(1));

    return {
      key: user.accountId,
      user,
      loggedHours: parseFloat(loggedHours.toFixed(1)),
      uniqueIssuesCount,
      performanceScore,
    };
  });

  return [...data].sort((a, b) => b.performanceScore - a.performanceScore);
}

// ─── Component: Performance Highlights (Best/Worst Spotlight) ─────────────────
export function TeamPerformanceHighlights({ activities }: Props) {
  const { trackedUsers } = useConfigStore();
  if (trackedUsers.length === 0) return null;

  const sortedLeaderboard = getLeaderboardData(activities, trackedUsers);
  const bestEmployee = sortedLeaderboard[0] || null;
  const worstEmployee = sortedLeaderboard[sortedLeaderboard.length - 1] || null;

  return (
    <Row gutter={16} className="fade-in">
      <Col span={12}>
        <Card bordered={false} style={{
          background: 'linear-gradient(135deg, rgba(253, 224, 71, 0.05), var(--color-surface))',
          border: '1px solid rgba(253, 224, 71, 0.2)'
        }}>
          {bestEmployee && bestEmployee.performanceScore > 0 ? (
            <Space align="start" size={16}>
              <div style={{
                background: 'rgba(253, 224, 71, 0.1)',
                borderRadius: 12,
                padding: 12,
                fontSize: 24,
                color: '#eab308'
              }}>
                <CrownOutlined />
              </div>
              <div>
                <Text style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Top Contributor (Best Employee)
                </Text>
                <Title level={4} style={{ margin: '4px 0 2px 0', color: 'var(--color-text)' }}>
                  {bestEmployee.user.displayName}
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Score: <strong style={{ color: 'var(--color-success)' }}>{bestEmployee.performanceScore} pts</strong> • Worked on <strong>{bestEmployee.uniqueIssuesCount} tickets</strong> and logged <strong>{bestEmployee.loggedHours} hrs</strong>.
                </Text>
              </div>
            </Space>
          ) : (
            <Space align="center" size={12}>
              <CrownOutlined style={{ fontSize: 24, color: 'var(--color-text-muted)' }} />
              <Text style={{ fontStyle: 'italic', color: 'var(--color-text-muted)' }}>No top contributors identified yet.</Text>
            </Space>
          )}
        </Card>
      </Col>

      <Col span={12}>
        <Card bordered={false} style={{
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05), var(--color-surface))',
          border: '1px solid rgba(239, 68, 68, 0.2)'
        }}>
          {worstEmployee ? (
            <Space align="start" size={16}>
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: 12,
                padding: 12,
                fontSize: 24,
                color: 'var(--color-danger)'
              }}>
                <AlertOutlined />
              </div>
              <div>
                <Text style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Lowest Activity (Worst Employee)
                </Text>
                <Title level={4} style={{ margin: '4px 0 2px 0', color: 'var(--color-text)' }}>
                  {worstEmployee.user.displayName}
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Score: <strong style={{ color: worstEmployee.performanceScore > 0 ? 'var(--color-warning)' : 'var(--color-danger)' }}>{worstEmployee.performanceScore} pts</strong> • Worked on <strong>{worstEmployee.uniqueIssuesCount} tickets</strong> and logged <strong>{worstEmployee.loggedHours} hrs</strong>.
                </Text>
              </div>
            </Space>
          ) : (
            <Space align="center" size={12}>
              <AlertOutlined style={{ fontSize: 24, color: 'var(--color-text-muted)' }} />
              <Text style={{ fontStyle: 'italic', color: 'var(--color-text-muted)' }}>No underperformers identified.</Text>
            </Space>
          )}
        </Card>
      </Col>
    </Row>
  );
}

// ─── Component: Leaderboard Table ─────────────────────────────────────────────
export default function TeamLeaderboardWidget({ activities, isMinimized, onMinimizeToggle }: Props) {
  const { trackedUsers } = useConfigStore();
  const [localMinimized, setLocalMinimized] = useState(false);
  const minimized = isMinimized !== undefined ? isMinimized : localMinimized;
  const toggleMinimized = onMinimizeToggle ? onMinimizeToggle : () => setLocalMinimized(!localMinimized);
  if (trackedUsers.length === 0) return null;

  const sortedLeaderboard = getLeaderboardData(activities, trackedUsers);

  const columns = [
    {
      title: 'Rank',
      key: 'rank',
      width: 80,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => {
        const rank = index + 1;
        let style: React.CSSProperties = {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          borderRadius: '50%',
          fontWeight: 'bold',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
        };

        if (rank === 1) {
          style = { ...style, background: '#ffd700', color: '#000' }; // Gold
        } else if (rank === 2) {
          style = { ...style, background: '#c0c0c0', color: '#000' }; // Silver
        } else if (rank === 3) {
          style = { ...style, background: '#cd7f32', color: '#000' }; // Bronze
        } else {
          style = { ...style, background: 'var(--color-surface-3)', color: 'var(--color-text-muted)' };
        }

        return <span style={style}>{rank}</span>;
      },
    },
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
      title: 'Unique Issues Worked On',
      dataIndex: 'uniqueIssuesCount',
      key: 'uniqueIssuesCount',
      align: 'center' as const,
      render: (val: number) => (
        <Space size={4}>
          <IssuesCloseOutlined style={{ color: 'var(--color-accent)' }} />
          <Text style={{ fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{val}</Text>
        </Space>
      ),
    },
    {
      title: 'Hours Logged',
      dataIndex: 'loggedHours',
      key: 'loggedHours',
      align: 'center' as const,
      render: (val: number) => (
        <Space size={4}>
          <ClockCircleOutlined style={{ color: 'var(--color-warning)' }} />
          <Text style={{ fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{val}h</Text>
        </Space>
      ),
    },
    {
      title: 'Performance Score',
      dataIndex: 'performanceScore',
      key: 'performanceScore',
      align: 'right' as const,
      render: (val: number) => (
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          color: val > 0 ? 'var(--color-success)' : 'var(--color-text-muted)',
          background: val > 0 ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
          padding: '4px 8px',
          borderRadius: 4,
          border: val > 0 ? '1px solid rgba(16, 185, 129, 0.3)' : 'none',
        }}>
          {val} pts
        </span>
      ),
    },
  ];

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <Space size={8}>
            <TrophyOutlined style={{ color: '#ffd700' }} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>
              Team Leaderboard & Performance Ranking
            </span>
          </Space>
          <Tooltip title="Score = (Unique Issues Touched × 5) + (Hours Logged)">
            <Space size={4} style={{ fontSize: 12, color: 'var(--color-text-muted)', cursor: 'help' }}>
              <InfoCircleOutlined />
              <span>Score Formula</span>
            </Space>
          </Tooltip>
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
          dataSource={sortedLeaderboard}
          columns={columns}
          pagination={false}
          size="middle"
          className="fade-in"
        />
      )}
    </Card>
  );
}
