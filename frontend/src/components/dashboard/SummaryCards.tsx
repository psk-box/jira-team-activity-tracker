import React from 'react';
import { Row, Col, Typography, Skeleton } from 'antd';
import {
  TeamOutlined, BranchesOutlined, ThunderboltOutlined, TrophyOutlined,
} from '@ant-design/icons';
import { DashboardSummary } from '../../types';

const { Text } = Typography;

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  sub?: string;
  loading?: boolean;
  delay?: number;
}

function StatCard({ label, value, icon, color, sub, loading, delay = 0 }: StatCardProps) {
  return (
    <div
      className="stat-card"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        position: 'relative',
        overflow: 'hidden',
        animationDelay: `${delay}ms`,
        cursor: 'default',
        transition: 'border-color 0.2s, transform 0.2s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = color;
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
      }}
    >
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        top: -20,
        right: -20,
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: `${color}18`,
        filter: 'blur(20px)',
        pointerEvents: 'none',
      }} />

      {/* Icon */}
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: `${color}18`,
        border: `1px solid ${color}40`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        color,
        marginBottom: 14,
      }}>
        {icon}
      </div>

      {/* Value */}
      {loading ? (
        <Skeleton.Input active size="small" style={{ width: 80, marginBottom: 6, display: 'block' }} />
      ) : (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 32,
          fontWeight: 700,
          color: 'var(--color-text)',
          lineHeight: 1,
          marginBottom: 6,
        }}>
          {value}
        </div>
      )}

      {/* Label */}
      <Text style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--color-text-muted)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        display: 'block',
      }}>
        {label}
      </Text>

      {/* Sub text */}
      {sub && (
        <Text style={{
          fontSize: 12,
          color,
          display: 'block',
          marginTop: 6,
          fontWeight: 500,
        }}>
          {sub}
        </Text>
      )}
    </div>
  );
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

interface Props {
  summary: DashboardSummary | null | undefined;
  loading: boolean;
}

export default function SummaryCards({ summary, loading }: Props) {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          label="Active Today"
          value={loading ? '-' : (summary?.totalUsers ?? 0)}
          icon={<TeamOutlined />}
          color="var(--color-primary)"
          sub={summary?.totalUsers ? `of tracked users` : undefined}
          loading={loading}
          delay={0}
        />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          label="Issues Worked On"
          value={loading ? '-' : (summary?.totalUniqueIssues ?? 0)}
          icon={<BranchesOutlined />}
          color="var(--color-accent)"
          sub="unique today"
          loading={loading}
          delay={80}
        />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          label="Total Activities"
          value={loading ? '-' : (summary?.totalActivities ?? 0)}
          icon={<ThunderboltOutlined />}
          color="var(--color-warning)"
          sub="today"
          loading={loading}
          delay={160}
        />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          label="Most Active"
          value={loading ? '-' : (summary?.mostActiveUser?.count ?? 0)}
          icon={<TrophyOutlined />}
          color="var(--color-success)"
          sub={summary?.mostActiveUser?.displayName}
          loading={loading}
          delay={240}
        />
      </Col>
    </Row>
  );
}
