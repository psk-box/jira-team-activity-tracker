import React from 'react';
import { Space, Typography, Tooltip } from 'antd';

const { Text } = Typography;

interface Props {
  isConnected: boolean;
  baseUrl?: string | null;
  userCount: number;
}

export default function StatusIndicator({ isConnected, baseUrl, userCount }: Props) {
  return (
    <Tooltip
      title={isConnected ? `Connected to ${baseUrl}` : 'Not connected to Jira'}
      placement="bottom"
    >
      <Space size={8} style={{ cursor: 'default' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: isConnected ? 'var(--color-success)' : 'var(--color-danger)',
            boxShadow: isConnected
              ? '0 0 8px var(--color-success)'
              : '0 0 8px var(--color-danger)',
          }} />
        </div>
        <Text style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: isConnected ? 'var(--color-text-dim)' : 'var(--color-text-muted)',
        }}>
          {isConnected
            ? `${userCount} user${userCount !== 1 ? 's' : ''} tracked`
            : 'Not configured'}
        </Text>
      </Space>
    </Tooltip>
  );
}
