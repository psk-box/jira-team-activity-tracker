import React, { useState } from "react";
import { Space, Typography, Alert, Spin, Row, Col, Card, Button } from "antd";
import { SettingOutlined, LoadingOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { useConfigStore } from "../../store/configStore";
import { useGitlabActivity } from "../../hooks/useGitlab";
import { ActivityFilters } from "../../types";
import GitlabCommitsWidget from "./GitlabCommitsWidget";
import GitlabMRsWidget from "./GitlabMRsWidget";
import GitlabActivityBreakdownWidget from "./GitlabActivityBreakdownWidget";
import GitlabLeaderboardWidget from "./GitlabLeaderboardWidget";
import GitlabPipelinesWidget from "./GitlabPipelinesWidget";
import GitlabActivityTable from "./GitlabActivityTable";
import GitlabDailyContributionsWidget from "./GitlabDailyContributionsWidget";
import GitlabWeeklyIntensityWidget from "./GitlabWeeklyIntensityWidget";
import GitlabMRCycleTimeWidget from "./GitlabMRCycleTimeWidget";
import GitlabProjectFocusWidget from "./GitlabProjectFocusWidget";
import ConfigModal from "../config/ConfigModal";

const { Text, Title } = Typography;

interface Props {
  filters: ActivityFilters;
}

function SimulationBanner({ onOpenConfig }: { onOpenConfig: () => void }) {
  return (
    <Alert
      message={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Space>
            <InfoCircleOutlined style={{ color: "var(--color-primary)" }} />
            <Text style={{ fontSize: 13, color: "var(--color-text)" }}>
              <strong>GitLab Simulation Mode:</strong> Displaying simulated developer activity. To connect to a live GitLab repository, update your settings.
            </Text>
          </Space>
          <Button
            type="primary"
            size="small"
            icon={<SettingOutlined />}
            onClick={onOpenConfig}
            style={{ fontSize: 11, background: "var(--color-primary)", border: "none" }}
          >
            Configure GitLab
          </Button>
        </div>
      }
      type="info"
      showIcon={false}
      style={{
        background: "rgba(6, 182, 212, 0.08)",
        border: "1px solid rgba(6, 182, 212, 0.25)",
        borderRadius: "var(--radius-lg)",
        padding: "10px 16px",
      }}
    />
  );
}

export default function GitlabActivityTab({ filters }: Props) {
  const { trackedUsers, isGitlabConfigured } = useConfigStore();
  const [configOpen, setConfigOpen] = useState(false);

  // Widget minimize controls
  const [minimizedStates, setMinimizedStates] = useState<Record<string, boolean>>({
    commits: false,
    mrs: false,
    breakdown: false,
    dailyContribs: false,
    weeklyIntensity: false,
    mrCycleTime: false,
    projectFocus: false,
    leaderboard: false,
    pipelines: false,
    table: false,
  });

  const { data, isFetching, error } = useGitlabActivity(filters);

  const toggleMinimize = (widgetKey: string) => {
    setMinimizedStates((prev) => ({
      ...prev,
      [widgetKey]: !prev[widgetKey],
    }));
  };

  const handleExpandAll = () => {
    setMinimizedStates({
      commits: false,
      mrs: false,
      breakdown: false,
      dailyContribs: false,
      weeklyIntensity: false,
      mrCycleTime: false,
      projectFocus: false,
      leaderboard: false,
      pipelines: false,
      table: false,
    });
  };

  const handleCollapseAll = () => {
    setMinimizedStates({
      commits: true,
      mrs: true,
      breakdown: true,
      dailyContribs: true,
      weeklyIntensity: true,
      mrCycleTime: true,
      projectFocus: true,
      leaderboard: true,
      pipelines: true,
      table: true,
    });
  };

  if (trackedUsers.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "100px 24px", gap: 16 }}>
        <Title level={4} style={{ margin: 0, color: "var(--color-text-muted)" }}>
          No Tracked Users Configured
        </Title>
        <Text type="secondary">
          Configure Jira and add team members in Settings to view GitLab metrics.
        </Text>
      </div>
    );
  }

  const antIcon = <LoadingOutlined style={{ fontSize: 24, color: "var(--color-primary)" }} spin />;

  return (
    <div style={{ padding: "20px 24px 40px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Simulation Mode Info Banner */}
      {(!isGitlabConfigured || data?.isMock) && (
        <SimulationBanner onOpenConfig={() => setConfigOpen(true)} />
      )}

      {/* Global Collapse/Expand Button Panel */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, margin: "-4px 0" }}>
        <Button size="small" onClick={handleExpandAll} style={{ fontSize: 11, fontFamily: "var(--font-mono)", background: "transparent", borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
          Expand All Widgets
        </Button>
        <Button size="small" onClick={handleCollapseAll} style={{ fontSize: 11, fontFamily: "var(--font-mono)", background: "transparent", borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
          Collapse All Widgets
        </Button>
      </div>

      {isFetching && !data ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "40vh" }}>
          <Spin indicator={antIcon} tip="Loading GitLab activity metrics..." size="large" style={{ color: "var(--color-text)" }} />
        </div>
      ) : error ? (
        <Alert message="Error fetching GitLab activity" description={error.message} type="error" showIcon />
      ) : (
        <>
          {/* Summary Stat Cards Row */}
          {data?.summary && (
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={8} md={4}>
                <Card size="small" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)" }}>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Commits</Text>
                  <Title level={3} style={{ margin: "4px 0 0 0", color: "var(--color-primary)" }}>{data.summary.totalCommits}</Title>
                </Card>
              </Col>
              <Col xs={12} sm={8} md={4}>
                <Card size="small" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)" }}>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Code Pushes</Text>
                  <Title level={3} style={{ margin: "4px 0 0 0", color: "var(--color-accent)" }}>{data.summary.totalPushes || 0}</Title>
                </Card>
              </Col>
              <Col xs={12} sm={8} md={4}>
                <Card size="small" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)" }}>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Merge Requests</Text>
                  <Title level={3} style={{ margin: "4px 0 0 0", color: "#10b981" }}>{data.summary.totalMRs}</Title>
                </Card>
              </Col>
              <Col xs={12} sm={8} md={4}>
                <Card size="small" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)" }}>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>MR Comments</Text>
                  <Title level={3} style={{ margin: "4px 0 0 0", color: "#a855f7" }}>{data.summary.totalMRComments || 0}</Title>
                </Card>
              </Col>
              <Col xs={12} sm={8} md={4}>
                <Card size="small" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)" }}>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Active Branches</Text>
                  <Title level={3} style={{ margin: "4px 0 0 0" }}>{data.summary.activeBranchesCount}</Title>
                </Card>
              </Col>
              <Col xs={12} sm={8} md={4}>
                <Card size="small" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)" }}>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Pipeline Success</Text>
                  <Title level={3} style={{ margin: "4px 0 0 0", color: "var(--color-success)" }}>{data.summary.pipelineSuccessRate}%</Title>
                </Card>
              </Col>
            </Row>
          )}

          {/* Grid Layout of Widgets */}
          <Row gutter={[16, 16]}>
            {/* Row 1: Trend charts and Pie breakdown */}
            <Col xs={24} xl={8}>
              <GitlabCommitsWidget
                activityByDate={data?.summary?.activityByDate || []}
                isMinimized={minimizedStates.commits}
                onMinimizeToggle={() => toggleMinimize("commits")}
              />
            </Col>
            <Col xs={24} xl={8}>
              <GitlabMRsWidget
                activities={data?.activities || []}
                isMinimized={minimizedStates.mrs}
                onMinimizeToggle={() => toggleMinimize("mrs")}
              />
            </Col>
            <Col xs={24} xl={8}>
              <GitlabActivityBreakdownWidget
                activities={data?.activities || []}
                isMinimized={minimizedStates.breakdown}
                onMinimizeToggle={() => toggleMinimize("breakdown")}
              />
            </Col>

            {/* Row 2: Daily stacked user contribs & Weekly day distribution */}
            <Col xs={24} xl={12}>
              <GitlabDailyContributionsWidget
                activities={data?.activities || []}
                isMinimized={minimizedStates.dailyContribs}
                onMinimizeToggle={() => toggleMinimize("dailyContribs")}
              />
            </Col>
            <Col xs={24} xl={12}>
              <GitlabWeeklyIntensityWidget
                activities={data?.activities || []}
                isMinimized={minimizedStates.weeklyIntensity}
                onMinimizeToggle={() => toggleMinimize("weeklyIntensity")}
              />
            </Col>

            {/* Row 2.5: MR Cycle times & Project focus hotspots */}
            <Col xs={24} xl={12}>
              <GitlabMRCycleTimeWidget
                activities={data?.activities || []}
                isMinimized={minimizedStates.mrCycleTime}
                onMinimizeToggle={() => toggleMinimize("mrCycleTime")}
              />
            </Col>
            <Col xs={24} xl={12}>
              <GitlabProjectFocusWidget
                activities={data?.activities || []}
                isMinimized={minimizedStates.projectFocus}
                onMinimizeToggle={() => toggleMinimize("projectFocus")}
              />
            </Col>

            {/* Row 3: Leaderboard / Tables */}
            <Col xs={24}>
              <GitlabLeaderboardWidget
                activities={data?.activities || []}
                isMinimized={minimizedStates.leaderboard}
                onMinimizeToggle={() => toggleMinimize("leaderboard")}
              />
            </Col>
            <Col xs={24}>
              <GitlabPipelinesWidget
                pipelines={data?.pipelines || []}
                successRate={data?.summary?.pipelineSuccessRate || 100}
                avgDuration={data?.summary?.avgPipelineDuration || 0}
                isMinimized={minimizedStates.pipelines}
                onMinimizeToggle={() => toggleMinimize("pipelines")}
              />
            </Col>
            <Col xs={24}>
              <GitlabActivityTable
                activities={data?.activities || []}
                isMinimized={minimizedStates.table}
                onMinimizeToggle={() => toggleMinimize("table")}
              />
            </Col>
          </Row>
        </>
      )}

      {/* Internal configuration Modal context */}
      <ConfigModal open={configOpen} onClose={() => setConfigOpen(false)} />
    </div>
  );
}
