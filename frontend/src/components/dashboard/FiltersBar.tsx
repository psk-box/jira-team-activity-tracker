import React from 'react';
import { Row, Col, Space, Select, DatePicker, Button, Typography, Tag } from 'antd';
import { FilterOutlined, ClearOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useConfigStore } from '../../store/configStore';
import { useProjects } from '../../hooks/useJira';
import { ActivityFilters } from '../../types';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const ACTIVITY_TYPES = [
  { value: 'status_change', label: 'Status Changes' },
  { value: 'field_update', label: 'Field Updates' },
  { value: 'comment', label: 'Comments' },
  { value: 'worklog', label: 'Worklogs' },
];

const ISSUE_TYPES = [
  'Bug', 'Story', 'Task', 'Epic', 'Sub-task', 'Feature', 'Improvement',
];

interface Props {
  filters: ActivityFilters;
  onChange: (filters: ActivityFilters) => void;
}

export default function FiltersBar({ filters, onChange }: Props) {
  const { trackedUsers } = useConfigStore();
  const { data: projects = [] } = useProjects();

  const handleDateChange = (dates: any) => {
    if (dates && dates[0] && dates[1]) {
      onChange({
        ...filters,
        startDate: dates[0].format('YYYY-MM-DD'),
        endDate: dates[1].format('YYYY-MM-DD'),
        startTime: dates[0].format('HH:mm'),
        endTime: dates[1].format('HH:mm'),
      });
    }
  };

  const handleReset = () => {
    const today = dayjs().format('YYYY-MM-DD');
    onChange({
      startDate: today,
      endDate: today,
      startTime: '00:00',
      endTime: '23:59',
      userIds: [],
      projectKeys: [],
      issueTypes: [],
      activityTypes: [],
    });
  };

  const hasActiveFilters =
    filters.userIds.length > 0 ||
    filters.projectKeys.length > 0 ||
    filters.issueTypes.length > 0 ||
    filters.activityTypes.length > 0;

  const selectStyle = {
    background: 'var(--color-surface-2)',
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
  };

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      padding: '14px 20px',
    }}>
      <Row gutter={[12, 12]} align="middle">
        <Col flex="none">
          <Space size={6}>
            <FilterOutlined style={{ color: 'var(--color-text-muted)', fontSize: 13 }} />
            <Text style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--color-text-muted)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              Filters
            </Text>
          </Space>
        </Col>

        <Col flex="none">
          <RangePicker
            value={[
              dayjs(`${filters.startDate} ${filters.startTime}`),
              dayjs(`${filters.endDate} ${filters.endTime}`),
            ]}
            onChange={handleDateChange}
            size="small"
            showTime={{ format: 'HH:mm' }}
            format="YYYY-MM-DD HH:mm"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
            }}
            allowClear={false}
            disabledDate={(d) => d.isAfter(dayjs())}
          />
        </Col>

        <Col flex="auto">
          <Row gutter={[8, 8]}>
            <Col xs={24} sm={12} md={6}>
              <Select
                mode="multiple"
                placeholder="Users"
                size="small"
                style={{ width: '100%', ...selectStyle }}
                value={filters.userIds}
                onChange={(v) => onChange({ ...filters, userIds: v })}
                maxTagCount={1}
                options={trackedUsers.map(u => ({
                  value: u.accountId,
                  label: u.displayName,
                }))}
              />
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Select
                mode="multiple"
                placeholder="Projects"
                size="small"
                style={{ width: '100%', ...selectStyle }}
                value={filters.projectKeys}
                onChange={(v) => onChange({ ...filters, projectKeys: v })}
                maxTagCount={1}
                options={projects.map(p => ({
                  value: p.key,
                  label: `${p.key} — ${p.name}`,
                }))}
              />
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Select
                mode="multiple"
                placeholder="Issue Type"
                size="small"
                style={{ width: '100%', ...selectStyle }}
                value={filters.issueTypes}
                onChange={(v) => onChange({ ...filters, issueTypes: v })}
                maxTagCount={1}
                options={ISSUE_TYPES.map(t => ({ value: t, label: t }))}
              />
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Select
                mode="multiple"
                placeholder="Activity Type"
                size="small"
                style={{ width: '100%', ...selectStyle }}
                value={filters.activityTypes}
                onChange={(v) => onChange({ ...filters, activityTypes: v })}
                maxTagCount={1}
                options={ACTIVITY_TYPES}
              />
            </Col>
          </Row>
        </Col>

        {hasActiveFilters && (
          <Col flex="none">
            <Button
              size="small"
              icon={<ClearOutlined />}
              onClick={handleReset}
              style={{
                background: 'transparent',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
              }}
            >
              Clear
            </Button>
          </Col>
        )}
      </Row>
    </div>
  );
}
