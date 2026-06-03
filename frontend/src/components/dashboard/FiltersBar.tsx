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

  const disabledTime = (current: any, type: 'start' | 'end') => {
    if (current && current.isSame(dayjs(), 'day')) {
      const now = dayjs();
      return {
        disabledHours: () => {
          const hours = [];
          for (let i = now.hour() + 1; i < 24; i++) {
            hours.push(i);
          }
          return hours;
        },
        disabledMinutes: (selectedHour: number) => {
          const minutes = [];
          if (selectedHour === now.hour()) {
            for (let i = now.minute() + 1; i < 60; i++) {
              minutes.push(i);
            }
          } else if (selectedHour > now.hour()) {
            for (let i = 0; i < 60; i++) {
              minutes.push(i);
            }
          }
          return minutes;
        },
      };
    }
    return {};
  };

  const handleDateChange = (dates: any) => {
    if (dates && dates[0] && dates[1]) {
      const now = dayjs();
      let start = dates[0];
      let end = dates[1];
      if (start.isAfter(now)) {
        start = now;
      }
      if (end.isAfter(now)) {
        end = now;
      }
      onChange({
        ...filters,
        startDate: start.format('YYYY-MM-DD'),
        endDate: end.format('YYYY-MM-DD'),
        startTime: start.format('HH:mm'),
        endTime: end.format('HH:mm'),
      });
    }
  };

  const handleReset = () => {
    const today = dayjs();
    const dayOfWeek = today.day();
    const monday = today.subtract(dayOfWeek === 0 ? 6 : dayOfWeek - 1, 'day').format('YYYY-MM-DD');
    const todayStr = today.format('YYYY-MM-DD');
    onChange({
      startDate: monday,
      endDate: todayStr,
      startTime: '00:00',
      endTime: today.format('HH:mm'),
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
            disabledDate={(d) => d && d.isAfter(dayjs(), 'day')}
            disabledTime={(current, type) => disabledTime(current, type)}
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
