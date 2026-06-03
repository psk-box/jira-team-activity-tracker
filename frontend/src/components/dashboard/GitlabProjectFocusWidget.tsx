import React from "react";
import { Card, Typography, Empty, Space } from "antd";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";
import { ApartmentOutlined, ShrinkOutlined, ArrowsAltOutlined } from "@ant-design/icons";
import { GitlabUserActivity } from "../../types";

const { Title } = Typography;

interface Props {
  activities: GitlabUserActivity[];
  isMinimized: boolean;
  onMinimizeToggle: () => void;
}

const COLORS = ["var(--color-primary)", "var(--color-accent)", "#10b981", "#a855f7", "#ec4899", "#f59e0b"];

export default function GitlabProjectFocusWidget({ activities, isMinimized, onMinimizeToggle }: Props) {
  const projectMap = new Map<string, number>();

  let totalEvents = 0;
  for (const act of activities) {
    for (const ev of act.events) {
      totalEvents++;
      projectMap.set(ev.projectPath, (projectMap.get(ev.projectPath) || 0) + 1);
    }
  }

  const chartData = Array.from(projectMap.entries())
    .map(([name, value]) => ({
      name: name.replace(/^https:\/\/gitlab\.com\//, ""),
      Activity: value,
    }))
    .sort((a, b) => b.Activity - a.Activity);

  return (
    <Card
      size="small"
      title={
        <Space size={8}>
          <ApartmentOutlined style={{ color: "var(--color-primary)" }} />
          <Title level={5} style={{ margin: 0, fontSize: 14 }}>
            Project & Repository Focus
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
        totalEvents === 0 ? (
          <Empty description="No repository activity recorded" style={{ marginTop: 40 }} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis
                type="number"
                stroke="var(--color-text-muted)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis
                dataKey="name"
                type="category"
                stroke="var(--color-text-muted)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={130}
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
                formatter={(val) => [`${val} actions`, "Activity Volume"]}
              />
              <Bar dataKey="Activity" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )
      )}
    </Card>
  );
}
