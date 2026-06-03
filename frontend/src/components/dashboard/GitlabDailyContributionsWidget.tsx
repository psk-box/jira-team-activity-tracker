import React from "react";
import { Card, Typography, Empty, Space } from "antd";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import { CalendarOutlined, ShrinkOutlined, ArrowsAltOutlined } from "@ant-design/icons";
import { GitlabUserActivity } from "../../types";
import dayjs from "dayjs";

const { Title } = Typography;

interface Props {
  activities: GitlabUserActivity[];
  isMinimized: boolean;
  onMinimizeToggle: () => void;
}

const USER_COLORS = [
  "var(--color-primary)",
  "var(--color-accent)",
  "#10b981",
  "#f59e0b",
  "#a855f7",
  "#ec4899",
  "#3b82f6",
  "#eab308",
  "#14b8a6",
  "#6366f1"
];

export default function GitlabDailyContributionsWidget({ activities, isMinimized, onMinimizeToggle }: Props) {
  // Aggregate contributions per person per day
  const dateMap = new Map<string, Record<string, number>>();

  let totalEvents = 0;
  for (const act of activities) {
    for (const ev of act.events) {
      totalEvents++;
      const dateKey = ev.timestamp.substring(0, 10); // YYYY-MM-DD
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, {});
      }
      const dayData = dateMap.get(dateKey)!;
      dayData[act.displayName] = (dayData[act.displayName] || 0) + 1;
    }
  }

  const sortedDates = Array.from(dateMap.keys()).sort();

  const chartData = sortedDates.map(date => {
    const dayData = dateMap.get(date)!;
    const row: Record<string, any> = {
      date: dayjs(date).format("MMM DD"),
    };
    for (const act of activities) {
      row[act.displayName] = dayData[act.displayName] || 0;
    }
    return row;
  });

  return (
    <Card
      size="small"
      title={
        <Space size={8}>
          <CalendarOutlined style={{ color: "var(--color-primary)" }} />
          <Title level={5} style={{ margin: 0, fontSize: 14 }}>
            Daily Contributions by Person
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
          <Empty description="No activity events found" style={{ marginTop: 40 }} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
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
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, marginTop: 4 }} />
              {activities.map((act, idx) => (
                <Bar
                  key={act.userId}
                  dataKey={act.displayName}
                  stackId="a"
                  fill={USER_COLORS[idx % USER_COLORS.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )
      )}
    </Card>
  );
}
