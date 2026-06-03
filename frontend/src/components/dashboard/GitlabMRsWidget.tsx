import React from "react";
import { Card, Typography, Empty, Space, Row, Col, Progress } from "antd";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import { BuildOutlined, ShrinkOutlined, ArrowsAltOutlined } from "@ant-design/icons";
import { GitlabUserActivity } from "../../types";

const { Text, Title } = Typography;

interface Props {
  activities: GitlabUserActivity[];
  isMinimized: boolean;
  onMinimizeToggle: () => void;
}

export default function GitlabMRsWidget({ activities, isMinimized, onMinimizeToggle }: Props) {
  const chartData = activities
    .filter(u => u.mrsOpened > 0 || u.mrsMerged > 0 || u.mrsClosed > 0)
    .map(u => ({
      name: u.displayName.split(" ")[0],
      Opened: u.mrsOpened,
      Merged: u.mrsMerged,
      Closed: u.mrsClosed,
    }));

  const totalOpened = activities.reduce((sum, u) => sum + u.mrsOpened, 0);
  const totalMerged = activities.reduce((sum, u) => sum + u.mrsMerged, 0);
  const totalClosed = activities.reduce((sum, u) => sum + u.mrsClosed, 0);
  const totalMRs = totalOpened + totalMerged + totalClosed;

  const mergeRate = totalMRs > 0 ? Math.round((totalMerged / (totalMerged + totalClosed || 1)) * 100) : 0;

  return (
    <Card
      size="small"
      title={
        <Space size={8}>
          <BuildOutlined style={{ color: "var(--color-accent)" }} />
          <Title level={5} style={{ margin: 0, fontSize: 14 }}>
            Merge Request Activity
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
        totalMRs === 0 ? (
          <Empty description="No Merge Request activity found" style={{ marginTop: 40 }} />
        ) : (
          <Row gutter={16} style={{ height: "100%" }}>
            {/* Chart Column */}
            <Col xs={24} md={16} style={{ height: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="name"
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
                  <Bar dataKey="Opened" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Merged" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Closed" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Col>

            {/* Sidebar Rate Column */}
            <Col xs={24} md={8} style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
              <div style={{ textAlign: "center" }}>
                <Progress
                  type="circle"
                  percent={mergeRate}
                  size={90}
                  strokeColor="var(--color-success)"
                  trailColor="var(--color-surface-3)"
                  format={(p) => (
                    <div style={{ color: "var(--color-text)", display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.1 }}>{p}%</span>
                      <span style={{ fontSize: 8, color: "var(--color-text-muted)", letterSpacing: "0.05em", textTransform: "uppercase", marginTop: 2 }}>Merge Rate</span>
                    </div>
                  )}
                />
              </div>

              <div style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius)",
                padding: "8px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 4
              }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Opened:</Text>
                  <Text strong style={{ color: "#3b82f6", fontSize: 12 }}>{totalOpened}</Text>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Merged:</Text>
                  <Text strong style={{ color: "#10b981", fontSize: 12 }}>{totalMerged}</Text>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Closed:</Text>
                  <Text strong style={{ color: "#ef4444", fontSize: 12 }}>{totalClosed}</Text>
                </div>
              </div>
            </Col>
          </Row>
        )
      )}
    </Card>
  );
}
