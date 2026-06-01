import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { AggregatedUserActivity, ActivityFilters } from '../types';

interface ExportRow {
  User: string;
  Email: string;
  Date: string;
  'Unique Issues': number;
  'Total Activities': number;
  'Status Changes': number;
  'Field Updates': number;
  Comments: number;
  Worklogs: number;
  'Issues List': string;
}

function buildRows(activities: AggregatedUserActivity[]): ExportRow[] {
  return activities.map(a => ({
    User: a.displayName,
    Email: a.emailAddress,
    Date: a.date,
    'Unique Issues': a.uniqueIssues.length,
    'Total Activities': a.totalActivities,
    'Status Changes': a.statusChanges,
    'Field Updates': a.fieldUpdates,
    Comments: a.comments,
    Worklogs: a.worklogs,
    'Issues List': a.uniqueIssues.join(', '),
  }));
}

export function exportToCSV(
  activities: AggregatedUserActivity[],
  _filters: ActivityFilters,
  filename = 'jira-team-activity'
): void {
  const rows = buildRows(activities);
  const headers = Object.keys(rows[0] || {});
  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      headers
        .map(h => {
          const val = String((row as any)[h] || '');
          return val.includes(',') ? `"${val}"` : val;
        })
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `${filename}.csv`);
}

export function exportToExcel(
  activities: AggregatedUserActivity[],
  _filters: ActivityFilters,
  filename = 'jira-team-activity'
): void {
  const rows = buildRows(activities);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();

  // Style the header row
  const colWidths = [
    { wch: 25 }, // User
    { wch: 30 }, // Email
    { wch: 12 }, // Date
    { wch: 15 }, // Unique Issues
    { wch: 18 }, // Total Activities
    { wch: 16 }, // Status Changes
    { wch: 14 }, // Field Updates
    { wch: 12 }, // Comments
    { wch: 12 }, // Worklogs
    { wch: 50 }, // Issues List
  ];
  worksheet['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Team Activity');

  // Detailed events sheet
  const eventRows = activities.flatMap(a =>
    a.events.map(e => ({
      User: a.displayName,
      Date: a.date,
      'Issue Key': e.issueKey,
      'Issue Summary': e.issueSummary,
      'Issue Type': e.issueType,
      Project: e.projectKey,
      'Activity Type': e.activityType.replace('_', ' '),
      Detail: e.detail,
      Timestamp: e.timestamp,
    }))
  );

  if (eventRows.length > 0) {
    const eventSheet = XLSX.utils.json_to_sheet(eventRows);
    eventSheet['!cols'] = [
      { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 50 },
      { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 60 }, { wch: 25 },
    ];
    XLSX.utils.book_append_sheet(workbook, eventSheet, 'Detailed Events');
  }

  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
