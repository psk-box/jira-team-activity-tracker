import React, { useState } from 'react';
import { Typography, Input, Button, Table, Card, Space, Spin, Alert, Avatar, Row, Col, Statistic } from 'antd';
import { AppstoreOutlined, TagsOutlined, SearchOutlined, DownloadOutlined, UserOutlined, BugOutlined, TeamOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { PieChart, Pie, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { useFilterStats } from '../../hooks/useJira';
import { exportFilterStatsToExcel } from '../../utils/exportUtils';

const { Title, Text } = Typography;

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A28CF2", "#FF6666", "#4CAF50", "#F44336"];

export const FilterStatsTab: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [filterId, setFilterId] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useFilterStats(filterId);

  const handleSearch = () => {
    if (inputValue.trim()) {
      setFilterId(inputValue.trim());
    }
  };

  const handleExport = () => {
    if (!data || !data.assigneeStats) return;
    
    // Flatten data for export
    const exportData = data.assigneeStats.map((stat: any) => ({
      Assignee: stat.assignee,
      Email: stat.email || 'N/A',
      'Assigned Issues': stat.count,
    }));

    exportFilterStatsToExcel(exportData, "Filter_" + filterId + "_Stats");
  };

  const columns = [
    {
      title: 'Assignee',
      key: 'assignee',
      render: (_: any, record: any) => (
        <Space>
          <Avatar src={record.avatarUrl} icon={<UserOutlined />} />
          <Text strong>{record.assignee}</Text>
        </Space>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (text: string) => text || <Text type="secondary">N/A</Text>,
    },
    {
      title: 'Assigned Issues',
      dataIndex: 'count',
      key: 'count',
      sorter: (a: any, b: any) => a.count - b.count,
      defaultSortOrder: 'descend' as const,
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%', marginTop: 24 }}>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Title level={4}>Filter Statistics</Title>
          <Text type="secondary">
            Enter a Jira Filter ID to view issue assignments for that filter.
          </Text>
          <Space>
            <Input
              placeholder="e.g. 10012"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onPressEnter={handleSearch}
              style={{ width: 250 }}
              prefix={<SearchOutlined />}
            />
            <Button type="primary" onClick={handleSearch} disabled={!inputValue.trim()}>
              Fetch Stats
            </Button>
            {data && data.assigneeStats && data.assigneeStats.length > 0 && (
              <Button icon={<DownloadOutlined />} onClick={handleExport}>
                Export
              </Button>
            )}
          </Space>
        </Space>
      </Card>

      {isLoading && (
        <Card style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>Loading filter statistics...</div>
        </Card>
      )}

      {isError && (
        <Alert
          type="error"
          message="Failed to load filter"
          description={error instanceof Error ? error.message : 'Unknown error occurred'}
          showIcon
        />
      )}

      {data && (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Row gutter={16}>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Total Issues"
                  value={data.totalIssues}
                  prefix={<BugOutlined />}
                  valueStyle={{ color: 'var(--color-primary)' }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Total Assignees"
                  value={data.assigneeStats.filter((s: any) => s.accountId !== 'unassigned').length}
                  prefix={<TeamOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Unassigned Issues"
                  value={data.assigneeStats.find((s: any) => s.accountId === 'unassigned')?.count || 0}
                  prefix={<QuestionCircleOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Card title={<><TagsOutlined /> Issues by Status</>}>
                <div style={{ height: 300, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.statusStats}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        innerRadius={60}
                        dataKey="count"
                        nameKey="name"
                        label={({ name, percent }) => name + " (" + (percent * 100).toFixed(0) + "%)"}
                        paddingAngle={2}
                      >
                        {data.statusStats?.map((entry: any, index: number) => (
                          <Cell key={"cell-" + index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card title={<><AppstoreOutlined /> Issues by Module</>}>
                <div style={{ height: 300, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.componentStats}
                      margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                      <XAxis 
                        dataKey="name" 
                        angle={-45} 
                        textAnchor="end" 
                        height={80} 
                        tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} 
                      />
                      <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} allowDecimals={false} />
                      <RechartsTooltip 
                        cursor={{ fill: 'var(--color-surface-2)' }}
                        contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                      />
                      <Bar dataKey="count" name="Issues" radius={[4, 4, 0, 0]} fill="#8884d8">
                        {data.componentStats?.map((entry: any, index: number) => (
                          <Cell key={"cell-" + index} fill={COLORS[(index + 4) % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>
          </Row>

          <Card title="Issues per Assignee">
            <div style={{ height: 400, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.assigneeStats}
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis 
                    dataKey="assignee" 
                    angle={-45} 
                    textAnchor="end" 
                    height={80} 
                    tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} 
                  />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} allowDecimals={false} />
                  <RechartsTooltip 
                    cursor={{ fill: 'var(--color-surface-2)' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                  />
                  <Bar dataKey="count" name="Assigned Issues" radius={[4, 4, 0, 0]}>
                    {data.assigneeStats.map((entry: any, index: number) => {
                      const isUnassigned = entry.accountId === 'unassigned';
                      return (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={isUnassigned ? '#faad14' : 'var(--color-primary)'} 
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title={`Filter Details: ${data.filterName || 'Unknown'} (ID: ${filterId})`}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div style={{ background: 'var(--color-surface-2)', padding: 12, borderRadius: 8, border: '1px solid var(--color-border)' }}>
                <Text type="secondary">JQL: </Text>
                <Text code style={{ background: 'transparent' }}>{data.jql}</Text>
              </div>
              
              <Table
                dataSource={data.assigneeStats}
                columns={columns}
                rowKey="accountId"
                pagination={{ pageSize: 20 }}
              />
            </Space>
          </Card>
        </Space>
      )}
    </Space>
  );
};
