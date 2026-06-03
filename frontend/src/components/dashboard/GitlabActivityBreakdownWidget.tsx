import React from "react";
import { Card, Typography, Empty, Space } from "antd";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from "recharts";
import { PieChartOutlined, ShrinkOutlined, ArrowsAltOutlined } from "@ant-design/icons";
import { GitlabUserActivity } from "../../types";

const { Text, Title } = Typography;

interface Props {
  activities: GitlabUserActivity[];
  isMinimized: boolean;
  onMinimizeToggle: () => void;
}

const COLORS = ["var(--color-primary)", "var(--color-accent)", "#10b981", "#ef4444", "#a855f7", "#f59e0b"];

export default function GitlabActivityBreakdownWidget({ activities, isMinimized, onMinimizeToggle }: Props) {
  let commits = 0;
  let pushes = 0;
  let mrs = 0;
  let mrComments = 0;
  let issueComments = 0;
  let issues = 0;

  for (const act of activities) {
    commits += act.commits;
    pushes += act.pushes || 0;
    mrs += act.mrsOpened + act.mrsMerged + act.mrsClosed;
    mrComments += act.mrComments || 0;
    issueComments += act.issueComments || 0;
    issues += act.issuesOpened + act.issuesClosed;
  }

  const total = commits + pushes + mrs + mrComments + issueComments + issues;

  const data = [
    { name: "Commits", value: commits },
    { name: "Pushes", value: pushes },
    { name: "Merge Requests", value: mrs },
    { name: "MR Comments", value: mrComments },
    { name: "Issue Comments", value: issueComments },
    { name: "Issues", value: issues },
  ].filter(d => d.value > 0);

  return (
    <Card
      size="small"
      title={
        <Space size={8}>
          <PieChartOutlined style={{ color: "var(--color-accent)" }} />
          <Title level={5} style={{ margin: 0, fontSize: 14 }}>
            Activity Breakdown
          </Title>
        </Space>
      }
      extra={
        <a onClick={onMinimizeToggle} style={{ color: "var(--color-text-muted)" }}>
          {isMinimized ? <ArrowsAltOutlined /> : <ShrinkOutlined />}
        </a>
      }
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
      }}
      styles={{
        body: {
          padding: isMinimized ? 0 : "16px 20px 20px 20px",
          height: isMinimized ? 0 : 280,
          overflow: "hidden",
          transition: "all 0.2s ease-in-out",
        },
      }}
    >
      {!isMinimized && (
        total === 0 ? (
          <Empty description="No GitLab activity records" style={{ marginTop: 40 }} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="45%"
                innerRadius={55}
                outerRadius={85}
                dataKey="value"
                nameKey="name"
                paddingAngle={3}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="var(--color-surface)" strokeWidth={1} />
                ))}
              </Pie>
              <RechartsTooltip
                contentStyle={{
                  background: "var(--color-surface-3)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius)",
                  color: "var(--color-text)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{ fontSize: 11, bottom: 5 }}
              />
            </PieChart>
          </ResponsiveContainer>
        )
      )}
    </Card>
  );
}
