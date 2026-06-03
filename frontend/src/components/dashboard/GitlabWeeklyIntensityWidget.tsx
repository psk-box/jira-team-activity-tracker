import React from "react";
import { Card, Typography, Empty, Space } from "antd";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import { BarChartOutlined, ShrinkOutlined, ArrowsAltOutlined } from "@ant-design/icons";
import { GitlabUserActivity } from "../../types";
import dayjs from "dayjs";

const { Title } = Typography;

interface Props {
  activities: GitlabUserActivity[];
  isMinimized: boolean;
  onMinimizeToggle: () => void;
}

export default function GitlabWeeklyIntensityWidget({ activities, isMinimized, onMinimizeToggle }: Props) {
  const weeklyData = [
    { day: "Mon", Commits: 0, Pushes: 0, "MR Comments": 0 },
    { day: "Tue", Commits: 0, Pushes: 0, "MR Comments": 0 },
    { day: "Wed", Commits: 0, Pushes: 0, "MR Comments": 0 },
    { day: "Thu", Commits: 0, Pushes: 0, "MR Comments": 0 },
    { day: "Fri", Commits: 0, Pushes: 0, "MR Comments": 0 },
    { day: "Sat", Commits: 0, Pushes: 0, "MR Comments": 0 },
    { day: "Sun", Commits: 0, Pushes: 0, "MR Comments": 0 },
  ];

  let totalEvents = 0;
  for (const act of activities) {
    for (const ev of act.events) {
      const d = dayjs(ev.timestamp);
      const dayIndex = d.day(); // 0 is Sun, 1 is Mon, etc.
      const mappedIndex = dayIndex === 0 ? 6 : dayIndex - 1;

      if (ev.action === "push") {
        const commitMatch = ev.details?.match(/Pushed (\d+) commit\(s\)/);
        const commitsCount = commitMatch ? parseInt(commitMatch[1], 10) : 1;
        weeklyData[mappedIndex].Commits += commitsCount;
        weeklyData[mappedIndex].Pushes += 1;
        totalEvents += commitsCount + 1;
      } else if (ev.action === "commit") {
        weeklyData[mappedIndex].Commits += 1;
        totalEvents++;
      } else if (ev.action === "mr_comment") {
        weeklyData[mappedIndex]["MR Comments"] += 1;
        totalEvents++;
      }
    }
  }

  return (
    <Card
      size="small"
      title={
        <Space size={8}>
          <BarChartOutlined style={{ color: "var(--color-primary)" }} />
          <Title level={5} style={{ margin: 0, fontSize: 14 }}>
            Weekly Workload Intensity
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
          <Empty description="No commit or push activity found in date range" style={{ marginTop: 40 }} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="day"
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
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, marginTop: 4 }} />
              <Bar dataKey="Commits" stackId="a" fill="var(--color-primary)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Pushes" stackId="a" fill="var(--color-accent)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="MR Comments" stackId="a" fill="#10b981" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )
      )}
    </Card>
  );
}
