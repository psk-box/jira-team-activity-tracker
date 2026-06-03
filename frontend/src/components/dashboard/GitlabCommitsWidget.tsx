import React from "react";
import { Card, Typography, Empty, Space } from "antd";
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import { MessageOutlined, ShrinkOutlined, ArrowsAltOutlined } from "@ant-design/icons";

const { Text, Title } = Typography;

interface Props {
  activityByDate: { date: string; commits: number; pushes: number; mrs: number; comments: number }[];
  isMinimized: boolean;
  onMinimizeToggle: () => void;
}

export default function GitlabCommitsWidget({ activityByDate, isMinimized, onMinimizeToggle }: Props) {
  const chartData = activityByDate.map(d => ({
    date: d.date.substring(5), // MM-DD
    Commits: d.commits,
    Pushes: d.pushes || 0,
  }));

  const totalCommits = activityByDate.reduce((sum, d) => sum + d.commits, 0);
  const totalPushes = activityByDate.reduce((sum, d) => sum + (d.pushes || 0), 0);

  return (
    <Card
      size="small"
      title={
        <Space size={8}>
          <MessageOutlined style={{ color: "var(--color-primary)" }} />
          <Title level={5} style={{ margin: 0, fontSize: 14 }}>
            Commits vs Pushes Trend
          </Title>
          <Text type="secondary" style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>
            ({totalCommits} commits / {totalPushes} pushes)
          </Text>
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
        chartData.length === 0 ? (
          <Empty description="No commit activity found" style={{ marginTop: 40 }} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="commitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="var(--color-text-muted)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--color-text-muted)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <RechartsTooltip
                contentStyle={{
                  background: "var(--color-surface-3)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius)",
                  color: "var(--color-text)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                }}
                labelStyle={{ fontWeight: "bold" }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, marginTop: 4 }} />
              <Area
                type="monotone"
                dataKey="Commits"
                stroke="var(--color-primary)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#commitGrad)"
              />
              <Line
                type="monotone"
                dataKey="Pushes"
                stroke="var(--color-accent)"
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )
      )}
    </Card>
  );
}
