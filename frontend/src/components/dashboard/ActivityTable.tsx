import React, { useState } from 'react';
import { Table, Avatar, Space, Tag, Typography, Timeline, Button, Tooltip, Input, Row, Col } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SwapOutlined, EditOutlined, CommentOutlined, ClockCircleOutlined,
  DownloadOutlined, FileExcelOutlined, SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { AggregatedUserActivity, ActivityEvent, ActivityFilters } from '../../types';
import { exportToCSV, exportToExcel } from '../../utils/exportUtils';

const { Text } = Typography;

// ─── Activity Type Config ─────────────────────────────────────────────────────

const ACTIVITY_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  status_change: { color: '#3b82f6', icon: <SwapOutlined />, label: 'Status' },
  field_update: { color: '#06b6d4', icon: <EditOutlined />, label: 'Update' },
  comment: { color: '#10b981', icon: <CommentOutlined />, label: 'Comment' },
  worklog: { color: '#f59e0b', icon: <ClockCircleOutlined />, label: 'Worklog' },
};

// ─── Search Filter Logic ──────────────────────────────────────────────────────

function filterBySearch(data: AggregatedUserActivity[], searchText: string): AggregatedUserActivity[] {
  if (!searchText.trim()) return data;
  
  const query = searchText.toLowerCase();
  return data.filter(item => {
    // Search by user name, email, or issue keys in events
    const matchesUser = 
      item.displayName.toLowerCase().includes(query) ||
      item.emailAddress.toLowerCase().includes(query);
    
    const matchesIssues = item.uniqueIssues.some(issue => 
      issue.toLowerCase().includes(query)
    );
    
    return matchesUser || matchesIssues;
  });
}

// ─── Expandable Row: User Group Details ───────────────────────────────────────

function UserGroupDetails({ record }: { readonly record: GroupedUserData }) {
  const activities = record.activities.sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div style={{ padding: '12px 16px 12px 60px' }}>
      <div style={{ marginBottom: 16 }}>
        <Text style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--color-text-muted)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          Daily Breakdown
        </Text>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 12,
      }}>
        {activities.map((activity) => (
          <div key={`${activity.userId}::${activity.date}`} style={{
            padding: 12,
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}>
              <Text style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--color-text)',
              }}>
                {activity.date}
              </Text>
              <Tag style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                background: 'var(--color-primary-dim)',
                border: '1px solid var(--color-primary)',
                color: 'var(--color-primary)',
              }}>
                {activity.totalActivities} activities
              </Tag>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 8,
              fontSize: 11,
            }}>
              <div>
                <Text style={{ color: 'var(--color-text-muted)' }}>Issues:</Text>
                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text)', fontWeight: 600 }}>
                  {activity.uniqueIssues.length}
                </div>
              </div>
              <div>
                <Text style={{ color: 'var(--color-text-muted)' }}>Status Δ:</Text>
                <div style={{ fontFamily: 'var(--font-mono)', color: '#3b82f6', fontWeight: 600 }}>
                  {activity.statusChanges || '—'}
                </div>
              </div>
              <div>
                <Text style={{ color: 'var(--color-text-muted)' }}>Updates:</Text>
                <div style={{ fontFamily: 'var(--font-mono)', color: '#06b6d4', fontWeight: 600 }}>
                  {activity.fieldUpdates || '—'}
                </div>
              </div>
              <div>
                <Text style={{ color: 'var(--color-text-muted)' }}>Comments:</Text>
                <div style={{ fontFamily: 'var(--font-mono)', color: '#10b981', fontWeight: 600 }}>
                  {activity.comments || '—'}
                </div>
              </div>
              <div>
                <Text style={{ color: 'var(--color-text-muted)' }}>Worklogs:</Text>
                <div style={{ fontFamily: 'var(--font-mono)', color: '#f59e0b', fontWeight: 600 }}>
                  {activity.worklogs || '—'}
                </div>
              </div>
              <div>
                <Text style={{ color: 'var(--color-text-muted)' }}>Hours:</Text>
                <div style={{ fontFamily: 'var(--font-mono)', color: '#f59e0b', fontWeight: 600 }}>
                  {activity.worklogDurationSeconds ? `${(activity.worklogDurationSeconds / 3600).toFixed(1)}h` : '—'}
                </div>
              </div>
            </div>

            {activity.events.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
                <Collapsible title={`Events (${activity.events.length})`} activity={activity} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Collapsible Events Helper ─────────────────────────────────────────────────

function Collapsible({ title, activity }: { readonly title: string; readonly activity: AggregatedUserActivity }) {
  const [expanded, setExpanded] = React.useState(false);

  const byIssue = activity.events.reduce<Record<string, ActivityEvent[]>>((acc, event) => {
    if (!acc[event.issueKey]) acc[event.issueKey] = [];
    acc[event.issueKey].push(event);
    return acc;
  }, {});

  return (
    <div>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--color-primary)',
          userSelect: 'none',
        }}
      >
        {expanded ? '▼' : '▶'} {title}
      </div>
      {expanded && (
        <div style={{ marginTop: 8, fontSize: 10 }}>
          {Object.entries(byIssue).map(([issueKey, events]) => (
            <div key={issueKey} style={{ marginBottom: 8, paddingLeft: 12, borderLeft: '1px solid var(--color-border)' }}>
              <Tag style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                background: 'var(--color-primary-dim)',
                border: '1px solid var(--color-primary)',
                color: 'var(--color-primary)',
                marginBottom: 4,
              }}>
                {issueKey}
              </Tag>
              {events.map((event, idx) => {
                const config = ACTIVITY_CONFIG[event.activityType] || ACTIVITY_CONFIG.field_update;
                return (
                  <div key={idx} style={{
                    display: 'flex',
                    gap: 6,
                    alignItems: 'flex-start',
                    marginBottom: 4,
                    color: 'var(--color-text-dim)',
                  }}>
                    <span style={{ color: config.color, marginTop: 2 }}>{config.icon}</span>
                    <span>{event.detail}</span>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 9 }}>
                      {dayjs(event.timestamp).format('HH:mm')}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stat Cell ────────────────────────────────────────────────────────────────

function StatCell({ value, color }: { value: number; color: string }) {
  if (value === 0) {
    return <Text style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>—</Text>;
  }
  return (
    <Text style={{ color, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
      {value}
    </Text>
  );
}

// ─── Group Data by User ───────────────────────────────────────────────────────

interface GroupedUserData {
  userId: string;
  displayName: string;
  emailAddress: string;
  avatarUrl: string;
  activities: AggregatedUserActivity[];
  totalActivities: number;
  totalDays: number;
  totalIssues: Set<string>;
  totalStatusChanges: number;
  totalFieldUpdates: number;
  totalComments: number;
  totalWorklogs: number;
  totalWorklogDurationSeconds: number;
}

function groupByUser(data: AggregatedUserActivity[]): GroupedUserData[] {
  const userMap = new Map<string, GroupedUserData>();

  for (const activity of data) {
    if (!userMap.has(activity.userId)) {
      userMap.set(activity.userId, {
        userId: activity.userId,
        displayName: activity.displayName,
        emailAddress: activity.emailAddress,
        avatarUrl: activity.avatarUrl,
        activities: [],
        totalActivities: 0,
        totalDays: 0,
        totalIssues: new Set(),
        totalStatusChanges: 0,
        totalFieldUpdates: 0,
        totalComments: 0,
        totalWorklogs: 0,
        totalWorklogDurationSeconds: 0,
      });
    }

    const group = userMap.get(activity.userId)!;
    group.activities.push(activity);
    group.totalActivities += activity.totalActivities;
    group.totalDays += 1;
    activity.uniqueIssues.forEach(issue => group.totalIssues.add(issue));
    group.totalStatusChanges += activity.statusChanges;
    group.totalFieldUpdates += activity.fieldUpdates;
    group.totalComments += activity.comments;
    group.totalWorklogs += activity.worklogs;
    group.totalWorklogDurationSeconds += activity.worklogDurationSeconds;
  }

  // Sort by total activities descending
  return Array.from(userMap.values()).sort((a, b) => b.totalActivities - a.totalActivities);
}

// ─── Main Table ───────────────────────────────────────────────────────────────

interface Props {
  data: AggregatedUserActivity[];
  loading: boolean;
  filters: ActivityFilters;
}

export default function ActivityTable({ data, loading, filters }: Props) {
  const [searchText, setSearchText] = useState('');

  // Filter data by search text
  const filteredData = filterBySearch(data, searchText);
  
  // Group filtered data by user
  const groupedData = groupByUser(filteredData);

  const columns: ColumnsType<GroupedUserData> = [
    {
      title: 'User',
      dataIndex: 'displayName',
      key: 'user',
      width: 220,
      fixed: 'left',
      render: (_, record) => (
        <Space size={10}>
          <Avatar
            src={record.avatarUrl}
            size={32}
            style={{ background: 'var(--color-primary)', flexShrink: 0 }}
          >
            {record.displayName[0]}
          </Avatar>
          <div>
            <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--color-text)' }}>
              {record.displayName}
            </div>
            <div style={{
              fontSize: 11,
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-mono)',
            }}>
              {record.emailAddress}
            </div>
          </div>
        </Space>
      ),
      sorter: (a, b) => a.displayName.localeCompare(b.displayName),
    },
    {
      title: 'Days Active',
      dataIndex: 'totalDays',
      key: 'days',
      width: 100,
      render: (val) => (
        <Text style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-text)' }}>
          {val}
        </Text>
      ),
      sorter: (a, b) => b.totalDays - a.totalDays,
    },
    {
      title: 'Issues',
      dataIndex: 'totalIssues',
      key: 'issues',
      width: 90,
      render: (issues: Set<string>) => (
        <Tooltip title={Array.from(issues).join(', ')} placement="top">
          <Text style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            fontSize: 18,
            color: 'var(--color-primary)',
            cursor: 'default',
          }}>
            {issues.size}
          </Text>
        </Tooltip>
      ),
      sorter: (a, b) => b.totalIssues.size - a.totalIssues.size,
    },
    {
      title: 'Total',
      dataIndex: 'totalActivities',
      key: 'total',
      width: 80,
      render: (val) => (
        <Text style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-text)' }}>
          {val}
        </Text>
      ),
      sorter: (a, b) => b.totalActivities - a.totalActivities,
    },
    {
      title: 'Status Δ',
      dataIndex: 'totalStatusChanges',
      key: 'status',
      width: 90,
      render: (val) => <StatCell value={val} color="#3b82f6" />,
      sorter: (a, b) => b.totalStatusChanges - a.totalStatusChanges,
    },
    {
      title: 'Updates',
      dataIndex: 'totalFieldUpdates',
      key: 'updates',
      width: 90,
      render: (val) => <StatCell value={val} color="#06b6d4" />,
      sorter: (a, b) => b.totalFieldUpdates - a.totalFieldUpdates,
    },
    {
      title: 'Comments',
      dataIndex: 'totalComments',
      key: 'comments',
      width: 100,
      render: (val) => <StatCell value={val} color="#10b981" />,
      sorter: (a, b) => b.totalComments - a.totalComments,
    },
    {
      title: 'Worklogs',
      dataIndex: 'totalWorklogs',
      key: 'worklogs',
      width: 100,
      render: (val) => <StatCell value={val} color="#f59e0b" />,
      sorter: (a, b) => b.totalWorklogs - a.totalWorklogs,
    },
    {
      title: 'Hours',
      dataIndex: 'totalWorklogDurationSeconds',
      key: 'worklogHours',
      width: 80,
      render: (seconds: number) => {
        if (seconds === 0) {
          return <Text style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>—</Text>;
        }
        const hours = (seconds / 3600).toFixed(1);
        return (
          <Text style={{ color: '#f59e0b', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            {hours}h
          </Text>
        );
      },
      sorter: (a, b) => b.totalWorklogDurationSeconds - a.totalWorklogDurationSeconds,
    },
  ];

  const expandable = {
    expandedRowRender: (record: GroupedUserData) => <UserGroupDetails record={record} />,
    rowExpandable: (record: GroupedUserData) => record.activities.length > 0,
    expandRowByClick: false,
  };

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      {/* Table header with search and export */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <Row gutter={[16, 12]} align="middle">
          <Col flex="auto">
            <Space size={6} style={{ width: '100%' }}>
              <Text style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--color-text-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                User Activity
              </Text>
              <Tag style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                background: 'var(--color-primary-dim)',
                border: '1px solid var(--color-primary)',
                color: 'var(--color-primary)',
              }}>
                {groupedData.length} users · {filteredData.length} of {data.length} records
              </Tag>
            </Space>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Search users, emails, or issues..."
              size="small"
              prefix={<SearchOutlined style={{ color: 'var(--color-text-muted)' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
              }}
              allowClear
            />
          </Col>
          <Col flex="none">
            <Space size={8}>
              <Button
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => exportToCSV(filteredData, filters)}
                disabled={filteredData.length === 0}
                style={{
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-muted)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                }}
              >
                CSV
              </Button>
              <Button
                size="small"
                icon={<FileExcelOutlined />}
                onClick={() => exportToExcel(filteredData, filters)}
                disabled={filteredData.length === 0}
                style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#10b981',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                }}
              >
                Excel
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      <Table<GroupedUserData>
        dataSource={groupedData}
        columns={columns}
        expandable={expandable}
        rowKey={(r) => r.userId}
        loading={loading}
        scroll={{ x: 860 }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total) => (
            <Text style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--color-text-muted)',
            }}>
              {total} records
            </Text>
          ),
          style: { padding: '12px 20px' },
        }}
        locale={{
          emptyText: (
            <div style={{
              padding: '48px 0',
              textAlign: 'center',
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-mono)',
            }}>
              {loading ? 'Fetching changelog data from Jira…' : 'No activity found for the selected filters.'}
            </div>
          ),
        }}
      />
    </div>
  );
}
