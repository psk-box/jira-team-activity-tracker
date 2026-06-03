import React from "react";
import { Card, Typography, Empty, Space, Row, Col, Progress, Table, Tag } from "antd";
import { RocketOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, ClockCircleOutlined, ShrinkOutlined, ArrowsAltOutlined } from "@ant-design/icons";
import { GitlabPipelineRun } from "../../types";
import dayjs from "dayjs";

const { Text, Title } = Typography;

interface Props {
  pipelines: GitlabPipelineRun[];
  successRate: number;
  avgDuration: number;
  isMinimized: boolean;
  onMinimizeToggle: () => void;
}

export default function GitlabPipelinesWidget({ pipelines, successRate, avgDuration, isMinimized, onMinimizeToggle }: Props) {
  const dataSource = pipelines.slice(0, 5).map(pipe => ({
    key: pipe.id,
    ...pipe,
  }));

  const columns = [
    {
      title: "Pipeline ID",
      dataIndex: "id",
      key: "id",
      width: 90,
      render: (id: string) => <Text style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>#{id}</Text>,
    },
    {
      title: "Project / Branch",
      dataIndex: "projectName",
      key: "projectName",
      render: (_: any, record: GitlabPipelineRun) => (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Text strong style={{ fontSize: 12 }}>{record.projectName}</Text>
          <Text type="secondary" style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}>
            ref: {record.ref}
          </Text>
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: GitlabPipelineRun["status"]) => {
        let color = "default";
        let icon = <ClockCircleOutlined />;
        if (status === "success") {
          color = "success";
          icon = <CheckCircleOutlined />;
        } else if (status === "failed") {
          color = "error";
          icon = <CloseCircleOutlined />;
        } else if (status === "running") {
          color = "processing";
          icon = <SyncOutlined spin />;
        }

        return (
          <Tag color={color} icon={icon} style={{ fontSize: 10, textTransform: "capitalize", fontFamily: "var(--font-mono)" }}>
            {status}
          </Tag>
        );
      },
    },
    {
      title: "Duration",
      dataIndex: "durationSeconds",
      key: "durationSeconds",
      width: 80,
      align: "right" as const,
      render: (sec: number) => <Text style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{sec}s</Text>,
    },
    {
      title: "Time",
      dataIndex: "timestamp",
      key: "timestamp",
      width: 100,
      align: "right" as const,
      render: (time: string) => <Text style={{ fontSize: 11 }}>{dayjs(time).format("MMM DD, HH:mm")}</Text>,
    },
  ];

  return (
    <Card
      size="small"
      title={
        <Space size={8}>
          <RocketOutlined style={{ color: "var(--color-primary)" }} />
          <Title level={5} style={{ margin: 0, fontSize: 14 }}>
            CI/CD Pipeline Status
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
          height: isMinimized ? 0 : "auto",
          overflow: "hidden",
          transition: "all 0.2s ease-in-out",
        },
      }}
    >
      {!isMinimized && (
        pipelines.length === 0 ? (
          <Empty description="No pipeline runs recorded" style={{ padding: "30px 0" }} />
        ) : (
          <Row gutter={[16, 16]}>
            {/* Stats Row */}
            <Col xs={24} md={6}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%", justifyContent: "center" }}>
                <div style={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius)",
                  padding: "12px",
                  textAlign: "center"
                }}>
                  <Progress
                    type="dashboard"
                    percent={successRate}
                    size={70}
                    strokeColor={successRate > 80 ? "var(--color-success)" : successRate > 50 ? "orange" : "var(--color-danger)"}
                    trailColor="var(--color-surface-3)"
                  />
                  <div style={{ marginTop: 4 }}>
                    <Text strong style={{ display: "block", fontSize: 12 }}>Success Rate</Text>
                  </div>
                </div>

                <div style={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius)",
                  padding: "12px",
                  textAlign: "center"
                }}>
                  <Title level={4} style={{ margin: 0, fontFamily: "var(--font-mono)", color: "var(--color-primary)" }}>
                    {avgDuration}s
                  </Title>
                  <Text type="secondary" style={{ fontSize: 12 }}>Avg Run Duration</Text>
                </div>
              </div>
            </Col>

            {/* Pipelines List Column */}
            <Col xs={24} md={18}>
              <Text strong style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--color-text-muted)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                display: "block",
                marginBottom: 8
              }}>
                Recent Pipeline Executions
              </Text>
              <Table
                dataSource={dataSource}
                columns={columns}
                pagination={false}
                size="small"
                style={{ background: "transparent" }}
                className="clean-table"
              />
            </Col>
          </Row>
        )
      )}
    </Card>
  );
}
