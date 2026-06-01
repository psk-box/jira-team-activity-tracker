import React, { useState } from 'react';
import {
  Modal, Form, Input, Button, Tabs, Space, List, Avatar,
  Typography, Divider, AutoComplete, Spin, Tag, Empty, Popconfirm, message,
} from 'antd';
import {
  ApiOutlined, TeamOutlined, UserAddOutlined, DeleteOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useConfigStore } from '../../store/configStore';
import { useValidateConnection, useSearchUsers } from '../../hooks/useJira';
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
        background: 'rgba(245, 158, 11, 0.08)',
        border: '1px solid rgba(245, 158, 11, 0.25)',
        borderRadius: 'var(--radius)',
        marginBottom: 20,
      }}>
        <Space>
          <ExclamationCircleOutlined style={{ color: 'var(--color-warning)' }} />
          <Text style={{ fontSize: 12, color: 'var(--color-warning)' }}>
            Your API token is never stored — you'll need to re-enter it each session.
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
  const { trackedUsers, addTrackedUser, removeTrackedUser, isConfigured } = useConfigStore();
  const { data: searchResults = [], isFetching } = useSearchUsers(searchQuery, isConfigured);

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
                  <Space size={8}>
                    <Tag style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      background: 'var(--color-surface-3)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-muted)',
                    }}>
                      {user.accountId.slice(0, 16)}…
                    </Tag>
                    <Text style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {user.emailAddress}
                    </Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}
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
