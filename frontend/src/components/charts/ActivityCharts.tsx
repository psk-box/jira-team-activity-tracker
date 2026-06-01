import React from 'react';
import { Row, Col, Typography } from 'antd';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, CartesianGrid, Legend,
} from 'recharts';
import { DashboardSummary, AggregatedUserActivity } from '../../types';

const { Text } = Typography;

const COLORS = {
  status_change: '#3b82f6',
  field_update: '#06b6d4',
  comment: '#10b981',
  worklog: '#f59e0b',
};

const ACTIVITY_LABELS: Record<string, string> = {
  status_change: 'Status Changes',
  field_update: 'Field Updates',
  comment: 'Comments',
  worklog: 'Worklogs',
};

const USER_COLORS = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899'];

const chartStyle = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  padding: '20px 24px',
};

const labelStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  color: 'var(--color-text-muted)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  marginBottom: 16,
  display: 'block',
};

const tooltipStyle = {
  backgroundColor: 'var(--color-surface-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  color: 'var(--color-text)',
};

interface Props {
  summary: DashboardSummary | null | undefined;
  activities?: AggregatedUserActivity[];
}

// ─── Daily Trend Chart ────────────────────────────────────────────────────────

function DailyTrendChart({ data }: { data: { date: string; total: number }[] }) {
  return (
    <div style={chartStyle}>
      <Text style={labelStyle}>Daily Activity Trend</Text>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}
            tickFormatter={(v) => v.slice(5)} // MM-DD
          />
          <YAxis
            tick={{ fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: 'var(--color-text-dim)' }}
            formatter={(val) => [val, 'Activities']}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#areaGrad)"
            dot={{ fill: '#3b82f6', strokeWidth: 0, r: 3 }}
            activeDot={{ r: 5, fill: '#3b82f6' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Activity by User Chart ───────────────────────────────────────────────────

function ActivityByUserChart({ data }: { data: { userId: string; displayName: string; total: number }[] }) {
  const top10 = data.slice(0, 10);
  return (
    <div style={chartStyle}>
      <Text style={labelStyle}>Activity by User</Text>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={top10} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}
          />
          <YAxis
            type="category"
            dataKey="displayName"
            width={100}
            tick={{ fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}
            tickFormatter={(v) => v.split(' ')[0]}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(val) => [val, 'Total Activities']}
          />
          <Bar dataKey="total" radius={[0, 4, 4, 0]}>
            {top10.map((_, idx) => (
              <Cell key={idx} fill={USER_COLORS[idx % USER_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Worklog Duration by User Chart ───────────────────────────────────────────

function WorklogDurationChart({ data }: { data: { userId: string; displayName: string; durationSeconds: number }[] }) {
  const convertToHours = (seconds: number) => (seconds / 3600).toFixed(1);

  const top10 = data.slice(0, 10).map(d => ({
    ...d,
    durationHours: parseFloat(convertToHours(d.durationSeconds)),
  }));

  return (
    <div style={chartStyle}>
      <Text style={labelStyle}>Worklog Duration (Hours)</Text>
      {data.length === 0 ? (
        <div style={{
          height: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
        }}>
          No worklog data
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={top10}
            layout="horizontal"
            margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              type="category"
              dataKey="displayName"
              tick={{ fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}
              tickFormatter={(v) => v.split(' ')[0]}
            />
            <YAxis
              type="number"
              tick={{ fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(val: number) => [`${val.toFixed(1)} hrs`, 'Duration']}
            />
            <Bar dataKey="durationHours" radius={[4, 4, 0, 0]}>
              {top10.map((_, idx) => (
                <Cell key={idx} fill={USER_COLORS[idx % USER_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── Activity Type Distribution ───────────────────────────────────────────────

function ActivityTypeChart({ data }: { data: Record<string, number> }) {
  const pieData = Object.entries(data)
    .filter(([, val]) => val > 0)
    .map(([key, val]) => ({
      name: ACTIVITY_LABELS[key] || key,
      value: val,
      color: COLORS[key as keyof typeof COLORS] || '#64748b',
    }));

  const total = pieData.reduce((s, d) => s + d.value, 0);

  return (
    <div style={chartStyle}>
      <Text style={labelStyle}>Activity Type Distribution</Text>
      {total === 0 ? (
        <div style={{
          height: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
        }}>
          No data
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={pieData}
              cx="40%"
              cy="50%"
              outerRadius={80}
              innerRadius={40}
              dataKey="value"
              paddingAngle={3}
            >
              {pieData.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(val, name) => [`${val} (${Math.round((+val / total) * 100)}%)`, name]}
            />
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              formatter={(val) => (
                <span style={{
                  color: 'var(--color-text-dim)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                }}>
                  {val}
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── Unique Issues by User Chart ──────────────────────────────────────────────

function UniqueIssuesByUserChart({ data }: { data: { userId: string; displayName: string; uniqueCount: number }[] }) {
  const top10 = data.slice(0, 10);

  return (
    <div style={chartStyle}>
      <Text style={labelStyle}>Unique Issues Worked On</Text>
      {data.length === 0 ? (
        <div style={{
          height: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
        }}>
          No issue data
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={top10}
            layout="horizontal"
            margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              type="category"
              dataKey="displayName"
              tick={{ fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}
              tickFormatter={(v) => v.split(' ')[0]}
            />
            <YAxis
              type="number"
              tick={{ fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(val: number) => [`${val} issues`, 'Unique Issues']}
            />
            <Bar dataKey="uniqueCount" radius={[4, 4, 0, 0]}>
              {top10.map((_, idx) => (
                <Cell key={idx} fill={USER_COLORS[(idx + 2) % USER_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── Composed Charts Panel ────────────────────────────────────────────────────

export default function ActivityCharts({ summary, activities = [] }: Props) {
  if (!summary) return null;

  // Group activities by user and collect all unique issue keys across all days
  const userUniqueIssuesMap = new Map<string, { displayName: string; issues: Set<string> }>();

  activities.forEach(act => {
    if (!userUniqueIssuesMap.has(act.userId)) {
      userUniqueIssuesMap.set(act.userId, {
        displayName: act.displayName,
        issues: new Set<string>(),
      });
    }
    act.uniqueIssues.forEach(issue => {
      userUniqueIssuesMap.get(act.userId)!.issues.add(issue);
    });
  });

  const uniqueIssuesData = Array.from(userUniqueIssuesMap.entries()).map(([userId, val]) => ({
    userId,
    displayName: val.displayName,
    uniqueCount: val.issues.size,
  })).sort((a, b) => b.uniqueCount - a.uniqueCount);

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}>
        <DailyTrendChart data={summary.activityByDate} />
      </Col>
      <Col xs={24} lg={12}>
        <ActivityTypeChart data={summary.activityByType} />
      </Col>
      <Col xs={24} lg={8}>
        <ActivityByUserChart data={summary.activityByUser} />
      </Col>
      <Col xs={24} lg={8}>
        <UniqueIssuesByUserChart data={uniqueIssuesData} />
      </Col>
      <Col xs={24} lg={8}>
        <WorklogDurationChart data={summary.worklogByUser} />
      </Col>
    </Row>
  );
}
