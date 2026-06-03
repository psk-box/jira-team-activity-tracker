import React, { useState } from 'react';
import {
  Modal, Form, Input, Button, Tabs, Space, List, Avatar,
  Typography, Divider, AutoComplete, Spin, Tag, Empty, Popconfirm, message, InputNumber,
} from 'antd';
import {
  ApiOutlined, TeamOutlined, UserAddOutlined, DeleteOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, ClockCircleOutlined, InfoCircleOutlined,
  RocketOutlined, EditOutlined,
} from '@ant-design/icons';
import { useConfigStore } from '../../store/configStore';
import { useValidateConnection, useSearchUsers } from '../../hooks/useJira';
import { useValidateGitlabConnection } from '../../hooks/useGitlab';
import { JiraUser, TrackedUser } from '../../types';

const { Text, Title } = Typography;
const { Password } = Input;

interface Props {
  open: boolean;
  onClose: () => void;
}

// ─── Jira Connection Tab ──────────────────────────────────────────────────────

function JiraConnectionTab() {
  const [form] = Form.useForm();
  const { jiraConfig, isConfigured } = useConfigStore();
  const { mutate: validate, isPending } = useValidateConnection();

  React.useEffect(() => {
    form.setFieldsValue({
      baseUrl: jiraConfig?.baseUrl || '',
      email: jiraConfig?.email || '',
      apiToken: jiraConfig?.apiToken || '',
    });
  }, [jiraConfig, form]);

  const handleSubmit = (values: any) => {
    validate({
      baseUrl: values.baseUrl.replace(/\/$/, ''),
      email: values.email,
      apiToken: values.apiToken,
    });
  };

  return (
    <div style={{ padding: '8px 0' }}>
      {isConfigured && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: 'var(--radius)',
          marginBottom: 20,
        }}>
          <CheckCircleOutlined style={{ color: 'var(--color-success)' }} />
          <Text style={{ color: 'var(--color-success)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            Connected to {jiraConfig?.baseUrl}
          </Text>
        </div>
      )}

      <div style={{
        padding: '10px 14px',
        background: 'rgba(16, 185, 129, 0.08)',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        borderRadius: 'var(--radius)',
        marginBottom: 20,
      }}>
        <Space>
          <CheckCircleOutlined style={{ color: 'var(--color-success)' }} />
          <Text style={{ fontSize: 12, color: 'var(--color-success)' }}>
            Your API token is securely cached locally so you don't need to enter it every time.
          </Text>
        </Space>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          baseUrl: jiraConfig?.baseUrl || '',
          email: jiraConfig?.email || '',
          apiToken: jiraConfig?.apiToken || '',
        }}
      >
        <Form.Item
          name="baseUrl"
          label="Jira Base URL"
          rules={[
            { required: true, message: 'Required' },
            { type: 'url', message: 'Must be a valid URL' },
          ]}
        >
          <Input
            placeholder="https://yourcompany.atlassian.net"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
          />
        </Form.Item>

        <Form.Item
          name="email"
          label="Email / User ID"
          rules={[{ required: true }, { type: 'email' }]}
        >
          <Input placeholder="you@company.com" />
        </Form.Item>

        <Form.Item
          name="apiToken"
          label="API Token"
          rules={[{ required: true }]}
        >
          <Password
            placeholder="Your Jira API token"
            style={{ fontFamily: 'var(--font-mono)' }}
          />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={isPending}
            icon={<ApiOutlined />}
            block
          >
            Validate & Connect
          </Button>
        </Form.Item>
      </Form>

      <Divider style={{ borderColor: 'var(--color-border)' }} />
      <Text style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
        Generate an API token at:{' '}
        <a
          href="https://id.atlassian.com/manage-profile/security/api-tokens"
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--color-primary)' }}
        >
          Atlassian Account → Security
        </a>
      </Text>
    </div>
  );
}

// ─── User Search + Management Tab ────────────────────────────────────────────

function UserManagementTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const { trackedUsers, addTrackedUser, removeTrackedUser, updateTrackedUser, isConfigured } = useConfigStore();
  const { data: searchResults = [], isFetching } = useSearchUsers(searchQuery, isConfigured);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [tempUsername, setTempUsername] = useState('');

  const handleStartEdit = (user: TrackedUser) => {
    setEditingUserId(user.accountId);
    setTempUsername(user.gitlabUsername || '');
  };

  const handleSaveEdit = (accountId: string) => {
    updateTrackedUser(accountId, { gitlabUsername: tempUsername.trim() || undefined });
    setEditingUserId(null);
    message.success('GitLab username mapping updated');
  };

  const options = searchResults
    .filter(u => !trackedUsers.some(t => t.accountId === u.accountId))
    .map(user => ({
      value: user.accountId,
      label: (
        <Space>
          <Avatar size={24} src={user.avatarUrls?.['24x24']}>
            {user.displayName[0]}
          </Avatar>
          <span style={{ color: 'var(--color-text)' }}>{user.displayName}</span>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
            {user.emailAddress}
          </span>
        </Space>
      ),
      user,
    }));

  const handleSelect = (_value: string, option: any) => {
    const jiraUser: JiraUser = option.user;
    addTrackedUser({
      accountId: jiraUser.accountId,
      displayName: jiraUser.displayName,
      emailAddress: jiraUser.emailAddress,
      avatarUrl: jiraUser.avatarUrls?.['48x48'] || '',
    });
    setSearchQuery('');
    message.success(`Added ${jiraUser.displayName}`);
  };

  if (!isConfigured) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>
        <ApiOutlined style={{ fontSize: 32, marginBottom: 12 }} />
        <div>Connect to Jira first to search for users.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 0' }}>
      <AutoComplete
          style={{ width: '100%', marginBottom: 20 }}
          options={options}
          onSearch={setSearchQuery}
          onSelect={handleSelect}
          value={searchQuery}
          onChange={setSearchQuery}
          notFoundContent={isFetching ? <Spin size="small" /> : searchQuery.length >= 2 ? 'No users found' : 'Type to search...'}
      >
        <Input
            prefix={<UserAddOutlined style={{ color: 'var(--color-text-muted)' }} />}
            placeholder="Search users by name or email..."
            suffix={isFetching ? <Spin size="small" /> : null}
        />
      </AutoComplete>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      }}>
        <Text style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--color-text-muted)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          Tracked Users ({trackedUsers.length})
        </Text>
      </div>

      {trackedUsers.length === 0 ? (
        <Empty
          description={
            <Text style={{ color: 'var(--color-text-muted)' }}>
              No users tracked yet. Search above to add team members.
            </Text>
          }
          style={{ margin: '32px 0' }}
        />
      ) : (
        <List
          dataSource={trackedUsers}
          renderItem={(user: TrackedUser) => (
            <List.Item
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                marginBottom: 8,
                padding: '10px 14px',
                background: 'var(--color-surface-2)',
              }}
              actions={[
                <Popconfirm
                  title={`Remove ${user.displayName}?`}
                  onConfirm={() => removeTrackedUser(user.accountId)}
                  okText="Remove"
                  cancelText="Cancel"
                >
                  <Button
                    type="text"
                    icon={<DeleteOutlined />}
                    danger
                    size="small"
                  />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <Avatar
                    src={user.avatarUrl}
                    style={{ background: 'var(--color-primary)' }}
                  >
                    {user.displayName[0]}
                  </Avatar>
                }
                title={
                  <Text style={{ color: 'var(--color-text)', fontWeight: 500 }}>
                    {user.displayName}
                  </Text>
                }
                description={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                    <Space size={8}>
                      <Tag style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        background: 'var(--color-surface-3)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-muted)',
                      }}>
                        Jira ID: {user.accountId.slice(0, 8)}…
                      </Tag>
                      <Text style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        {user.emailAddress}
                      </Text>
                    </Space>
                    
                    {editingUserId === user.accountId ? (
                      <Space size={4} style={{ marginTop: 2 }}>
                        <Input
                          size="small"
                          placeholder="GitLab Username"
                          value={tempUsername}
                          onChange={(e) => setTempUsername(e.target.value)}
                          style={{ width: 150, fontSize: 11, height: 22, background: 'var(--color-surface)' }}
                        />
                        <Button
                          type="primary"
                          size="small"
                          onClick={() => handleSaveEdit(user.accountId)}
                          style={{ fontSize: 10, height: 22, padding: '0 8px' }}
                        >
                          Save
                        </Button>
                        <Button
                          size="small"
                          onClick={() => setEditingUserId(null)}
                          style={{ fontSize: 10, height: 22, padding: '0 8px' }}
                        >
                          Cancel
                        </Button>
                      </Space>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Tag color="cyan" style={{ fontSize: 10, fontFamily: 'var(--font-mono)', border: '1px solid var(--color-border)', background: 'var(--color-surface-3)' }}>
                          GitLab: <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{user.gitlabUsername || user.emailAddress.split('@')[0]}</span>
                        </Tag>
                        <Button
                          type="link"
                          size="small"
                          icon={<EditOutlined style={{ fontSize: 10 }} />}
                          onClick={() => handleStartEdit(user)}
                          style={{ padding: 0, height: 'auto', fontSize: 10, color: 'var(--color-primary)' }}
                        >
                          Map GitLab Username
                        </Button>
                      </div>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );
}

// ─── GitLab Connection Tab ───────────────────────────────────────────────────

function GitlabConnectionTab() {
  const [form] = Form.useForm();
  const { gitlabConfig, isGitlabConfigured } = useConfigStore();
  const { mutate: validate, isPending } = useValidateGitlabConnection();

  React.useEffect(() => {
    form.setFieldsValue({
      baseUrl: gitlabConfig?.baseUrl || 'https://gitlab.com',
      token: gitlabConfig?.token || '',
    });
  }, [gitlabConfig, form]);

  const handleSubmit = (values: any) => {
    validate({
      baseUrl: values.baseUrl.replace(/\/$/, ''),
      token: values.token,
    });
  };

  return (
    <div style={{ padding: '8px 0' }}>
      {isGitlabConfigured && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: 'var(--radius)',
          marginBottom: 20,
        }}>
          <CheckCircleOutlined style={{ color: 'var(--color-success)' }} />
          <Text style={{ color: 'var(--color-success)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            Connected to {gitlabConfig?.baseUrl}
          </Text>
        </div>
      )}

      <div style={{
        padding: '10px 14px',
        background: 'rgba(16, 185, 129, 0.08)',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        borderRadius: 'var(--radius)',
        marginBottom: 20,
      }}>
        <Space>
          <CheckCircleOutlined style={{ color: 'var(--color-success)' }} />
          <Text style={{ fontSize: 12, color: 'var(--color-success)' }}>
            Enter your credentials or type <strong>"mock"</strong> as the token to activate simulated mode.
          </Text>
        </Space>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          baseUrl: gitlabConfig?.baseUrl || 'https://gitlab.com',
          token: gitlabConfig?.token || '',
        }}
      >
        <Form.Item
          name="baseUrl"
          label="GitLab Base URL"
          rules={[
            { required: true, message: 'Required' },
            { type: 'url', message: 'Must be a valid URL' },
          ]}
        >
          <Input
            placeholder="https://gitlab.com"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
          />
        </Form.Item>

        <Form.Item
          name="token"
          label="Personal Access Token (PAT)"
          rules={[{ required: true }]}
        >
          <Password
            placeholder="Your GitLab Personal Access Token"
            style={{ fontFamily: 'var(--font-mono)' }}
          />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={isPending}
            icon={<ApiOutlined />}
            block
          >
            Validate & Connect
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}

// ─── Activity Goals Tab ──────────────────────────────────────────────────────

function GoalsTab() {
  const { worklogGoalHours, setWorklogGoalHours } = useConfigStore();
  const [hours, setHours] = useState(worklogGoalHours);

  const handleSave = () => {
    setWorklogGoalHours(hours);
    message.success(`Daily worklog goal updated to ${hours} hours`);
  };

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{
        padding: '10px 14px',
        background: 'rgba(59, 130, 246, 0.08)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: 'var(--radius)',
        marginBottom: 20,
      }}>
        <Space>
          <InfoCircleOutlined style={{ color: 'var(--color-primary)' }} />
          <Text style={{ fontSize: 12, color: 'var(--color-primary)' }}>
            Configure daily worklog expectations for your team. This goal is used to measure who reached or did not reach their target hours.
          </Text>
        </Space>
      </div>

      <Form layout="vertical" onFinish={handleSave}>
        <Form.Item
          label="Daily Worklog Goal (Hours)"
          tooltip="Expected number of hours each developer should log per day."
        >
          <InputNumber
            min={1}
            max={24}
            value={hours}
            onChange={(val) => val !== null && setHours(val)}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item style={{ marginTop: 24 }}>
          <Button type="primary" htmlType="submit" block>
            Save Goals
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function ConfigModal({ open, onClose }: Props) {
  const { trackedUsers } = useConfigStore();

  const tabItems = [
    {
      key: 'connection',
      label: (
        <Space>
          <ApiOutlined />
          Jira Connection
        </Space>
      ),
      children: <JiraConnectionTab />,
    },
    {
      key: 'gitlab-connection',
      label: (
        <Space>
          <RocketOutlined />
          GitLab Connection
        </Space>
      ),
      children: <GitlabConnectionTab />,
    },
    {
      key: 'users',
      label: (
        <Space>
          <TeamOutlined />
          Team Members
          {trackedUsers.length > 0 && (
            <Tag style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              background: 'var(--color-primary-dim)',
              border: '1px solid var(--color-primary)',
              color: 'var(--color-primary)',
            }}>
              {trackedUsers.length}
            </Tag>
          )}
        </Space>
      ),
      children: <UserManagementTab />,
    },
    {
      key: 'goals',
      label: (
        <Space>
          <ClockCircleOutlined />
          Activity Goals
        </Space>
      ),
      children: <GoalsTab />,
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <div style={{
            width: 24,
            height: 24,
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            color: '#fff',
          }}>
            J
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>
            Configuration
          </span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      styles={{
        body: { padding: '0 24px 24px' },
        mask: { backdropFilter: 'blur(4px)' },
      }}
    >
      <Tabs items={tabItems} />
    </Modal>
  );
}
