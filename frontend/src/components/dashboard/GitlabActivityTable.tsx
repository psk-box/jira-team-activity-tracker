import React, { useState } from "react";
import { Card, Typography, Empty, Space, Table, Avatar, Tag, Input } from "antd";
import {
  UnorderedListOutlined,
  SearchOutlined,
  MessageOutlined,
  FileTextOutlined,
  RocketOutlined,
  BuildOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PullRequestOutlined,
  ShrinkOutlined,
  ArrowsAltOutlined,
  CloudUploadOutlined,
  CommentOutlined
} from "@ant-design/icons";
import { GitlabActivityEvent, GitlabUserActivity } from "../../types";
import dayjs from "dayjs";

const { Text, Title } = Typography;

interface Props {
  activities: GitlabUserActivity[];
  isMinimized: boolean;
  onMinimizeToggle: () => void;
}

export default function GitlabActivityTable({ activities, isMinimized, onMinimizeToggle }: Props) {
  const [searchText, setSearchText] = useState("");

  // Extract all events from all users and flatten
  const allEvents = activities.flatMap(act =>
    act.events.map(ev => ({
      ...ev,
      authorAvatar: act.avatarUrl,
    }))
  );

  // Sort desc by date
  allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Filter events based on search
  const filteredEvents = allEvents.filter(ev =>
    ev.title.toLowerCase().includes(searchText.toLowerCase()) ||
    ev.authorName.toLowerCase().includes(searchText.toLowerCase()) ||
    ev.projectPath.toLowerCase().includes(searchText.toLowerCase()) ||
    ev.action.toLowerCase().includes(searchText.toLowerCase()) ||
    (ev.details && ev.details.toLowerCase().includes(searchText.toLowerCase()))
  );

  const columns = [
    {
      title: "Contributor",
      dataIndex: "authorName",
      key: "authorName",
      width: 140,
      render: (name: string, record: any) => (
        <Space size={8}>
          <Avatar src={record.authorAvatar} size="small" style={{ background: "var(--color-primary-dim)" }}>
            {name[0]}
          </Avatar>
          <Text strong style={{ fontSize: 12 }}>{name}</Text>
        </Space>
      ),
    },
    {
      title: "Action",
      dataIndex: "action",
      key: "action",
      width: 120,
      render: (action: GitlabActivityEvent["action"]) => {
        let color = "default";
        let icon = <FileTextOutlined />;
        let text: string = action;

        if (action === "commit") {
          color = "blue";
          icon = <RocketOutlined />;
          text = "Commit";
        } else if (action === "push") {
          color = "cyan";
          icon = <CloudUploadOutlined />;
          text = "Push Code";
        } else if (action === "mr_opened") {
          color = "orange";
          icon = <PullRequestOutlined />;
          text = "MR Open";
        } else if (action === "mr_merged") {
          color = "success";
          icon = <CheckCircleOutlined />;
          text = "MR Merge";
        } else if (action === "mr_closed") {
          color = "error";
          icon = <CloseCircleOutlined />;
          text = "MR Close";
        } else if (action === "issue_opened") {
          color = "purple";
          icon = <BuildOutlined />;
          text = "Issue Open";
        } else if (action === "issue_closed") {
          color = "default";
          icon = <CloseCircleOutlined />;
          text = "Issue Close";
        } else if (action === "mr_comment") {
          color = "magenta";
          icon = <MessageOutlined />;
          text = "MR Comment";
        } else if (action === "issue_comment") {
          color = "pink";
          icon = <CommentOutlined />;
          text = "Issue Comment";
        } else if (action === "comment") {
          color = "default";
          icon = <CommentOutlined />;
          text = "Comment";
        }

        return (
          <Tag color={color} icon={icon} style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "capitalize" }}>
            {text}
          </Tag>
        );
      },
    },
    {
      title: "Project Path",
      dataIndex: "projectPath",
      key: "projectPath",
      width: 160,
      render: (path: string) => <Tag color="default" style={{ fontSize: 10, fontFamily: "var(--font-mono)", margin: 0 }}>{path}</Tag>,
    },
    {
      title: "Activity Details",
      dataIndex: "title",
      key: "title",
      render: (title: string, record: any) => (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Text style={{ fontSize: 13, color: "var(--color-text)" }}>{title}</Text>
          {record.details && (
            <Text type="secondary" style={{ fontSize: 10, fontStyle: "italic", whiteSpace: "pre-wrap" }}>
              {record.details}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: "Time",
      dataIndex: "timestamp",
      key: "timestamp",
      width: 120,
      align: "right" as const,
      render: (time: string) => (
        <Text style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>
          {dayjs(time).format("MMM DD, HH:mm")}
        </Text>
      ),
    },
  ];

  return (
    <Card
      size="small"
      title={
        <Space size={8}>
          <UnorderedListOutlined style={{ color: "var(--color-primary)" }} />
          <Title level={5} style={{ margin: 0, fontSize: 14 }}>
            Detailed Activity Stream
          </Title>
        </Space>
      }
      extra={
        <Space size={16}>
          {!isMinimized && (
            <Input
              size="small"
              placeholder="Search activity logs..."
              prefix={<SearchOutlined style={{ color: "var(--color-text-muted)" }} />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: 220, fontSize: 11, background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
            />
          )}
          <a onClick={onMinimizeToggle} style={{ color: "var(--color-text-muted)" }}>
            {isMinimized ? <ArrowsAltOutlined /> : <ShrinkOutlined />}
          </a>
        </Space>
      }
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
      }}
      styles={{
        body: {
          padding: isMinimized ? 0 : "12px 16px 16px 16px",
          height: isMinimized ? 0 : "auto",
          overflow: "hidden",
          transition: "all 0.2s ease-in-out",
        },
      }}
    >
      {!isMinimized && (
        filteredEvents.length === 0 ? (
          <Empty description={searchText ? "No matches found" : "No activity logs available"} style={{ padding: "40px 0" }} />
        ) : (
          <Table
            dataSource={filteredEvents.map((e, idx) => ({ ...e, key: e.id || idx }))}
            columns={columns}
            pagination={{ pageSize: 8, size: "small" }}
            size="small"
            style={{ background: "transparent" }}
            className="clean-table"
          />
        )
      )}
    </Card>
  );
}
