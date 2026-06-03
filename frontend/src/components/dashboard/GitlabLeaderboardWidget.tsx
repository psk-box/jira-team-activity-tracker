import React from "react";
import { Card, Typography, Empty, Space, Table, Avatar, Progress, Tag } from "antd";
import { CrownOutlined, ShrinkOutlined, ArrowsAltOutlined, BranchesOutlined, PullRequestOutlined } from "@ant-design/icons";
import { GitlabUserActivity } from "../../types";

const { Text, Title } = Typography;

interface Props {
  activities: GitlabUserActivity[];
  isMinimized: boolean;
  onMinimizeToggle: () => void;
}

export default function GitlabLeaderboardWidget({ activities, isMinimized, onMinimizeToggle }: Props) {
  const dataSource = activities.map((act) => {
    // Calculate a weighted GitLab contribution score incorporating branches and line counts
    const score = act.commits * 1 +
      (act.pushes || 0) * 2 +
      (act.mrsOpened + act.mrsMerged) * 5 +
      (act.mrComments || 0) * 2 +
      (act.uniqueBranches?.length || 0) * 10 +
      Math.round(((act.linesAdded || 0) + (act.linesDeleted || 0)) * 0.1);

    return {
      key: act.userId,
      displayName: act.displayName,
      gitlabUsername: act.gitlabUsername,
      avatarUrl: act.avatarUrl,
      commits: act.commits,
      pushes: act.pushes || 0,
      mrs: act.mrsOpened + act.mrsMerged,
      mrComments: act.mrComments || 0,
      branchesCount: act.uniqueBranches?.length || 0,
      linesAdded: act.linesAdded || 0,
      linesDeleted: act.linesDeleted || 0,
      score,
    };
  });

  // Sort descending by score
  dataSource.sort((a, b) => b.score - a.score);

  const dataSourceWithRank = dataSource.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));

  const maxScore = dataSourceWithRank.length > 0 ? Math.max(...dataSourceWithRank.map(a => a.score)) : 1;

  const columns = [
    {
      title: "#",
      dataIndex: "rank",
      key: "rank",
      width: 40,
      align: "center" as const,
      render: (rank: number) => (
        <span style={{
          fontWeight: 700,
          color: rank === 1 ? "#eab308" : rank === 2 ? "#94a3b8" : rank === 3 ? "#b45309" : "var(--color-text-muted)",
          fontFamily: "var(--font-mono)",
        }}>
          {rank === 1 ? <CrownOutlined style={{ color: "#eab308" }} /> : rank}
        </span>
      ),
    },
    {
      title: "Contributor",
      dataIndex: "displayName",
      key: "displayName",
      render: (_: any, record: typeof dataSourceWithRank[0]) => (
        <Space size={8}>
          <Avatar src={record.avatarUrl} size="small" style={{ background: "var(--color-primary-dim)" }}>
            {record.displayName[0]}
          </Avatar>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <Text strong style={{ fontSize: 13 }}>{record.displayName}</Text>
            <Text type="secondary" style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}>
              @{record.gitlabUsername}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: "Branches",
      dataIndex: "branchesCount",
      key: "branchesCount",
      align: "center" as const,
      width: 90,
      render: (val: number) => (
        <Tag color="cyan" icon={<BranchesOutlined />} style={{ fontFamily: "var(--font-mono)", margin: 0 }}>
          {val}
        </Tag>
      ),
    },
    {
      title: "MRs (Merge Requests)",
      dataIndex: "mrs",
      key: "mrs",
      align: "center" as const,
      width: 150,
      render: (val: number) => (
        <Tag color="blue" icon={<PullRequestOutlined />} style={{ fontFamily: "var(--font-mono)", margin: 0 }}>
          {val}
        </Tag>
      ),
    },
    {
      title: "Lines Changed",
      key: "linesChanged",
      width: 160,
      render: (_: any, record: typeof dataSourceWithRank[0]) => (
        <div style={{ display: "flex", gap: 4, fontFamily: "var(--font-mono)", fontSize: 11 }}>
          <span style={{ color: "#10b981", fontWeight: 600 }}>+{record.linesAdded}</span>
          <span style={{ color: "var(--color-text-muted)" }}>/</span>
          <span style={{ color: "#ef4444", fontWeight: 600 }}>-{record.linesDeleted}</span>
        </div>
      ),
    },
    {
      title: "Weighted Score",
      dataIndex: "score",
      key: "score",
      render: (score: number) => {
        const percent = Math.max(2, Math.min(100, Math.round((score / maxScore) * 100)));
        return (
          <Space style={{ width: "100%" }} size={8}>
            <Progress
              percent={percent}
              showInfo={false}
              strokeColor="linear-gradient(90deg, var(--color-primary) 0%, var(--color-accent) 100%)"
              trailColor="var(--color-surface-3)"
              size="small"
              style={{ width: 100, margin: 0 }}
            />
            <Text strong style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
              {score}
            </Text>
          </Space>
        );
      },
    },
  ];

  return (
    <Card
      size="small"
      title={
        <Space size={8}>
          <CrownOutlined style={{ color: "#eab308" }} />
          <Title level={5} style={{ margin: 0, fontSize: 14 }}>
            GitLab Contributors Scorecard
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
          padding: isMinimized ? 0 : "12px 16px 16px 16px",
          height: isMinimized ? 0 : "auto",
          overflow: "hidden",
          transition: "all 0.2s ease-in-out",
        },
      }}
    >
      {!isMinimized && (
        dataSourceWithRank.length === 0 ? (
          <Empty description="No GitLab activity configured" style={{ padding: "20px 0" }} />
        ) : (
          <Table
            dataSource={dataSourceWithRank}
            columns={columns}
            pagination={false}
            size="small"
            style={{ background: "transparent" }}
            className="clean-table"
          />
        )
      )}
    </Card>
  );
}
