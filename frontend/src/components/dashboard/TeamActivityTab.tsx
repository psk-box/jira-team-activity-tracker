import React, { useState } from 'react';
import { Space, Typography, Alert, Button, Spin } from 'antd';
import { SettingOutlined, LoadingOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useConfigStore } from '../../store/configStore';
import { useActivity } from '../../hooks/useJira';
import { ActivityFilters } from '../../types';
import SummaryCards from './SummaryCards';
import ActivityCharts from '../charts/ActivityCharts';
import ActivityTable from './ActivityTable';
import FiltersBar from './FiltersBar';
import WorklogGoalsWidget from './WorklogGoalsWidget';
import TeamEngagementWidget from './TeamEngagementWidget';
import TeamLeaderboardWidget, { TeamPerformanceHighlights } from './TeamLeaderboardWidget';
import IssueTypeContributorsWidget from './IssueTypeContributorsWidget';
import DeveloperProfilesWidget from './DeveloperProfilesWidget';
import StaleTicketsWidget from './StaleTicketsWidget';
import WorklogConsistencyWidget from './WorklogConsistencyWidget';
import PeerCollaborationWidget from './PeerCollaborationWidget';

const { Text } = Typography;

// ─── Default Filters: Today ───────────────────────────────────────────────────

function getDefaultFilters(): ActivityFilters {
  const today = dayjs();
  const dayOfWeek = today.day();
  const monday = today.subtract(dayOfWeek === 0 ? 6 : dayOfWeek - 1, 'day').format('YYYY-MM-DD');
  const todayStr = today.format('YYYY-MM-DD');
  return {
    startDate: monday,
    endDate: todayStr,
    startTime: '00:00',
    endTime: today.format('HH:mm'),
    userIds: [],
    projectKeys: [],
    issueTypes: [],
    activityTypes: [],
  };
}

// ─── Not-configured State ─────────────────────────────────────────────────────

function NotConfigured({ onOpenConfig }: { onOpenConfig: () => void }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '80px 24px',
      gap: 24,
      textAlign: 'center',
    }}>
      <div style={{
        width: 80,
        height: 80,
        borderRadius: 20,
        background: 'linear-gradient(135deg, var(--color-primary-dim), rgba(6, 182, 212, 0.1))',
        border: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 36,
      }}>
        📊
      </div>
      <div>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 24,
          fontWeight: 600,
          color: 'var(--color-text)',
          marginBottom: 8,
        }}>
          Jira Team Activity Tracker
        </div>
        <Text style={{ color: 'var(--color-text-muted)', fontSize: 15, maxWidth: 400, display: 'block' }}>
          Connect your Jira workspace to start tracking daily team activity using changelog analysis.
        </Text>
      </div>
      <Button
        type="primary"
        icon={<SettingOutlined />}
        size="large"
        onClick={onOpenConfig}
        style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}
      >
        Configure Jira Connection
      </Button>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        maxWidth: 560,
        marginTop: 8,
      }}>
        {[
          { icon: '🔍', label: 'Changelog Analysis', desc: 'Track actual work via Jira history' },
          { icon: '📅', label: 'Daily Metrics', desc: 'Per-user, per-day breakdowns' },
          { icon: '📤', label: 'Export Data', desc: 'CSV and Excel export' },
        ].map(f => (
          <div key={f.label} style={{
            padding: '14px 16px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            textAlign: 'left',
          }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{f.icon}</div>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text)', marginBottom: 2 }}>
              {f.label}
            </div>
            <Text style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{f.desc}</Text>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Props {
  filters: ActivityFilters;
  setFilters: React.Dispatch<React.SetStateAction<ActivityFilters>>;
}

export default function TeamActivityTab({ filters, setFilters }: Props) {
  const { isConfigured, trackedUsers } = useConfigStore();
  const [configOpen, setConfigOpen] = useState(false);

  // Lazily import ConfigModal to avoid circular dep
  const ConfigModal = React.lazy(() => import('../config/ConfigModal'));

  const { data, isLoading, error, isFetching } = useActivity(filters);

  const [minimizedStates, setMinimizedStates] = useState<Record<string, boolean>>({
    goals: false,
    engagement: false,
    leaderboard: false,
    contributors: false,
    profiles: false,
    stale: false,
    consistency: false,
    collaboration: false,
    activityTable: false,
  });

  const handleExpandAll = () => {
    setMinimizedStates({
      goals: false,
      engagement: false,
      leaderboard: false,
      contributors: false,
      profiles: false,
      stale: false,
      consistency: false,
      collaboration: false,
      activityTable: false,
    });
  };

  const handleCollapseAll = () => {
    setMinimizedStates({
      goals: true,
      engagement: true,
      leaderboard: true,
      contributors: true,
      profiles: true,
      stale: true,
      consistency: true,
      collaboration: true,
      activityTable: true,
    });
  };

  const toggleWidget = (key: string) => {
    setMinimizedStates(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (!isConfigured) {
    return (
      <>
        <NotConfigured onOpenConfig={() => setConfigOpen(true)} />
        <React.Suspense fallback={null}>
          {configOpen && (
            <ConfigModal open={configOpen} onClose={() => setConfigOpen(false)} />
          )}
        </React.Suspense>
      </>
    );
  }

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* No users warning */}
      {trackedUsers.length === 0 && (
        <Alert
          type="warning"
          showIcon
          message="No team members configured"
          description="Add team members in Settings → Team Members to start tracking activity."
          action={
            <Button size="small" onClick={() => setConfigOpen(true)}>
              Add Users
            </Button>
          }
        />
      )}

      {/* Error */}
      {error && (
        <Alert
          type="error"
          showIcon
          message="Failed to fetch activity data"
          description={(error as Error).message}
          closable
        />
      )}

      {/* Filters */}
      <FiltersBar filters={filters} onChange={setFilters} />

      {/* Global Minimization Controls */}
      {data?.activities && data.activities.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: -8 }}>
          <Button size="small" onClick={handleExpandAll} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
            Expand All Widgets
          </Button>
          <Button size="small" onClick={handleCollapseAll} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
            Collapse All Widgets
          </Button>
        </div>
      )}

      {/* Loading indicator */}
      {isFetching && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 0',
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
        }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 12, color: 'var(--color-primary)' }} />} />
          Fetching changelog data from Jira…
        </div>
      )}

      {/* Summary Cards */}
      <SummaryCards summary={data?.summary} loading={isLoading} />

      {/* Top Spotlights: Best & Worst Employee */}
      {data?.activities && data.activities.length > 0 && (
        <TeamPerformanceHighlights activities={data.activities} />
      )}

      {/* Stale & Blocked Tickets Warning */}
      {data?.activities && data.activities.length > 0 && (
        <StaleTicketsWidget
          activities={data.activities}
          isMinimized={minimizedStates.stale}
          onMinimizeToggle={() => toggleWidget('stale')}
        />
      )}

      {/* Charts */}
      {data?.summary && <ActivityCharts summary={data.summary} activities={data.activities || []} />}

      {/* Worklog Goals Tracker */}
      {data?.activities && data.activities.length > 0 && (
        <WorklogGoalsWidget
          activities={data.activities}
          startDate={filters.startDate}
          endDate={filters.endDate}
          isMinimized={minimizedStates.goals}
          onMinimizeToggle={() => toggleWidget('goals')}
        />
      )}

      {/* Worklog Consistency Analytics */}
      {data?.activities && data.activities.length > 0 && (
        <WorklogConsistencyWidget
          activities={data.activities}
          isMinimized={minimizedStates.consistency}
          onMinimizeToggle={() => toggleWidget('consistency')}
        />
      )}

      {/* Team Engagement Health Scorecard */}
      {data?.activities && data.activities.length > 0 && (
        <TeamEngagementWidget
          activities={data.activities}
          startDate={filters.startDate}
          endDate={filters.endDate}
          isMinimized={minimizedStates.engagement}
          onMinimizeToggle={() => toggleWidget('engagement')}
        />
      )}

      {/* Leaderboard & Ranking */}
      {data?.activities && data.activities.length > 0 && (
        <TeamLeaderboardWidget
          activities={data.activities}
          isMinimized={minimizedStates.leaderboard}
          onMinimizeToggle={() => toggleWidget('leaderboard')}
        />
      )}

      {/* Issue Type & Contributors Scorecard */}
      {data?.activities && data.activities.length > 0 && (
        <IssueTypeContributorsWidget
          activities={data.activities}
          isMinimized={minimizedStates.contributors}
          onMinimizeToggle={() => toggleWidget('contributors')}
        />
      )}

      {/* Developer Issue Type Breakdown */}
      {data?.activities && data.activities.length > 0 && (
        <DeveloperProfilesWidget
          activities={data.activities}
          isMinimized={minimizedStates.profiles}
          onMinimizeToggle={() => toggleWidget('profiles')}
        />
      )}

      {/* Peer Collaboration Matrix */}
      {data?.activities && data.activities.length > 0 && (
        <PeerCollaborationWidget
          activities={data.activities}
          isMinimized={minimizedStates.collaboration}
          onMinimizeToggle={() => toggleWidget('collaboration')}
        />
      )}

      {/* Activity Table */}
      <ActivityTable
        data={data?.activities || []}
        loading={isLoading}
        filters={filters}
        isMinimized={minimizedStates.activityTable}
        onMinimizeToggle={() => toggleWidget('activityTable')}
      />

      <React.Suspense fallback={null}>
        {configOpen && (
          <ConfigModal open={configOpen} onClose={() => setConfigOpen(false)} />
        )}
      </React.Suspense>
    </div>
  );
}
