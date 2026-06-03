import React, { useState } from 'react';
import { Card, Table, Avatar, Space, Typography, Tag, Tooltip, Button } from 'antd';
import { TeamOutlined, UserOutlined, UpOutlined, DownOutlined, MessageOutlined } from '@ant-design/icons';
import { useConfigStore } from '../../store/configStore';
import { AggregatedUserActivity, ActivityEvent } from '../../types';

const { Text } = Typography;

interface Props {
  activities: AggregatedUserActivity[];
  isMinimized?: boolean;
  onMinimizeToggle?: () => void;
}

interface PeerRelation {
  userId: string;
  displayName: string;
  avatarUrl: string;
  sharedCount: number;
}

interface UserCollaborationData {
  key: string;
  user: any;
  sharedTicketsCount: number;
  commentsOnShared: number;
  topPeers: PeerRelation[];
  rating: {
    label: string;
    color: string;
    description: string;
  };
}

export default function PeerCollaborationWidget({ activities, isMinimized, onMinimizeToggle }: Props) {
  const { trackedUsers } = useConfigStore();
  const [localMinimized, setLocalMinimized] = useState(false);
  const minimized = isMinimized !== undefined ? isMinimized : localMinimized;
  const toggleMinimized = onMinimizeToggle ? onMinimizeToggle : () => setLocalMinimized(!localMinimized);

  // Group events by issueKey
  const issueEventsMap = new Map<string, ActivityEvent[]>();

  activities.forEach(act => {
    act.events.forEach(event => {
      if (!issueEventsMap.has(event.issueKey)) {
        issueEventsMap.set(event.issueKey, []);
      }
      issueEventsMap.get(event.issueKey)!.push(event);
    });
  });

  // Calculate peer-to-peer relationships
  const userPeersMap = new Map<string, Map<string, number>>();
  const userSharedTickets = new Map<string, Set<string>>();
  const userCommentsOnShared = new Map<string, number>();

  // Initialize maps for tracked users
  trackedUsers.forEach(u => {
    userPeersMap.set(u.accountId, new Map());
    userSharedTickets.set(u.accountId, new Set());
    userCommentsOnShared.set(u.accountId, 0);
  });

  issueEventsMap.forEach((events, issueKey) => {
    const contributors = new Set(events.map(e => e.userId).filter(uid => trackedUsers.some(u => u.accountId === uid)));
    
    if (contributors.size > 1) {
      const contributorsArray = Array.from(contributors);
      
      // Update shared tickets count & relationships
      contributorsArray.forEach(uid => {
        userSharedTickets.get(uid)?.add(issueKey);

        // Find comments written by this user on this issue
        const userComments = events.filter(e => e.userId === uid && e.activityType === 'comment').length;
        if (userComments > 0) {
          userCommentsOnShared.set(uid, (userCommentsOnShared.get(uid) || 0) + userComments);
        }

        // Add to peer relationships
        const peersMap = userPeersMap.get(uid)!;
        contributorsArray.forEach(otherUid => {
          if (uid !== otherUid) {
            peersMap.set(otherUid, (peersMap.get(otherUid) || 0) + 1);
          }
        });
      });
    }
  });

  const tableData: UserCollaborationData[] = trackedUsers.map(user => {
    const sharedTicketsCount = userSharedTickets.get(user.accountId)?.size || 0;
    const commentsOnShared = userCommentsOnShared.get(user.accountId) || 0;
    
    // Top Peers
    const peersMap = userPeersMap.get(user.accountId) || new Map<string, number>();
    const topPeers: PeerRelation[] = Array.from(peersMap.entries())
      .map(([peerId, count]) => {
        const peerUser = trackedUsers.find(u => u.accountId === peerId);
        return {
          userId: peerId,
          displayName: peerUser?.displayName || 'Unknown Peer',
          avatarUrl: peerUser?.avatarUrl || '',
          sharedCount: count
        };
      })
      .sort((a, b) => b.sharedCount - a.sharedCount);

    let rating = {
      label: 'Focused Soloist',
      color: 'default',
      description: 'Works independently on tasks with minimal direct team overlap.'
    };

    if (sharedTicketsCount > 0) {
      if (commentsOnShared >= 5 || (commentsOnShared >= 2 && sharedTicketsCount >= 3)) {
        rating = {
          label: 'Active Reviewer',
          color: 'success',
          description: 'Regularly comments and provides feedback on shared issues.'
        };
      } else if (sharedTicketsCount >= 4) {
        rating = {
          label: 'Highly Collaborative',
          color: 'processing',
          description: 'Frequently co-works on tickets with several team members.'
        };
      } else {
        rating = {
          label: 'Cooperative',
          color: 'cyan',
          description: 'Works alongside peers on shared backlog deliverables.'
        };
      }
    }

    return {
      key: user.accountId,
      user,
      sharedTicketsCount,
      commentsOnShared,
      topPeers,
      rating
    };
  }).sort((a, b) => b.sharedTicketsCount - a.sharedTicketsCount);

  const columns = [
    {
      title: 'Developer',
      key: 'user',
      width: 220,
      render: (_: any, record: UserCollaborationData) => (
        <Space>
          <Avatar src={record.user.avatarUrl} icon={<UserOutlined />}>
            {record.user.displayName[0]}
          </Avatar>
          <Text style={{ fontWeight: 500, color: 'var(--color-text)' }}>
            {record.user.displayName}
          </Text>
        </Space>
      )
    },
    {
      title: 'Synergy Style',
      dataIndex: 'rating',
      key: 'rating',
      width: 180,
      render: (rating: UserCollaborationData['rating']) => (
        <Tooltip title={rating.description} placement="top">
          <Tag color={rating.color} style={{ fontWeight: 600, padding: '2px 8px', borderRadius: 4, cursor: 'help' }}>
            {rating.label}
          </Tag>
        </Tooltip>
      )
    },
    {
      title: 'Shared Tickets Co-Worked',
      dataIndex: 'sharedTicketsCount',
      key: 'sharedTicketsCount',
      width: 180,
      align: 'center' as const,
      render: (val: number) => (
        <Text style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
          {val} {val === 1 ? 'ticket' : 'tickets'}
        </Text>
      ),
      sorter: (a: UserCollaborationData, b: UserCollaborationData) => a.sharedTicketsCount - b.sharedTicketsCount
    },
    {
      title: 'Peer Comments Posted',
      dataIndex: 'commentsOnShared',
      key: 'commentsOnShared',
      width: 180,
      align: 'center' as const,
      render: (val: number) => (
        <Space size={4}>
          <MessageOutlined style={{ color: 'var(--color-accent)' }} />
          <Text style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{val}</Text>
        </Space>
      ),
      sorter: (a: UserCollaborationData, b: UserCollaborationData) => a.commentsOnShared - b.commentsOnShared
    },
    {
      title: 'Primary Collaborators',
      key: 'peers',
      render: (_: any, record: UserCollaborationData) => (
        <Avatar.Group max={{ count: 3, style: { color: '#f56a00', backgroundColor: '#fde3cf' } }}>
          {record.topPeers.map(peer => (
            <Tooltip title={`${peer.displayName} (${peer.sharedCount} shared)`} key={peer.userId}>
              <Avatar src={peer.avatarUrl} icon={<UserOutlined />}>
                {peer.displayName[0]}
              </Avatar>
            </Tooltip>
          ))}
        </Avatar.Group>
      )
    }
  ];

  if (trackedUsers.length === 0) return null;

  return (
    <Card
      title={
        <Space size={8}>
          <TeamOutlined style={{ color: 'var(--color-accent)' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>
            Peer Collaboration & Review Matrix
          </span>
        </Space>
      }
      extra={
        <Button
          type="text"
          size="small"
          onClick={toggleMinimized}
          icon={minimized ? <DownOutlined /> : <UpOutlined />}
          style={{ color: 'var(--color-text-muted)' }}
        />
      }
      bordered={false}
      style={{ background: 'var(--color-surface)' }}
    >
      {!minimized && (
        <Table
          dataSource={tableData}
          columns={columns}
          pagination={false}
          size="middle"
          className="fade-in"
        />
      )}
    </Card>
  );
}
