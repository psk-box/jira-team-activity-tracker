# Jira Team Activity Tracker

A production-grade dashboard that tracks **actual work done** by team members in Jira, using changelog analysis rather than simple issue assignment or field updates.

---

## How It Works — Changelog Analysis

Most naive Jira dashboards only count issues *assigned* to a user. This tracker uses the **Jira Changelog API** (`expand=changelog`) to capture every actual change a user made:

| Activity | Source |
|---|---|
| Status changes | `changelog.histories` where `item.field === "status"` |
| Field updates | `changelog.histories` for any other field |
| Comments added | `/issue/{key}/comment` API |
| Work logged | `/issue/{key}/worklog` API |

Only issues where the user **did something** are counted — not just ownership.

---

## Architecture

```
jira-tracker/
├── backend/                 # Express + TypeScript API proxy
│   └── src/
│       ├── services/
│       │   ├── jiraService.ts       # Jira REST API integration
│       │   ├── aggregationService.ts # Activity aggregation logic
│       │   └── logger.ts
│       ├── routes/
│       │   ├── jira.ts              # /api/jira/* endpoints
│       │   └── config.ts
│       └── middleware/
│           ├── errorHandler.ts
│           └── requestLogger.ts
│
└── frontend/                # React + TypeScript + Ant Design
    └── src/
        ├── components/
        │   ├── layout/AppLayout.tsx          # Tab-based shell (extensible)
        │   ├── dashboard/
        │   │   ├── TeamActivityTab.tsx        # Main tab
        │   │   ├── SummaryCards.tsx           # KPI cards
        │   │   ├── ActivityTable.tsx          # Expandable data table
        │   │   └── FiltersBar.tsx             # Filter controls
        │   ├── charts/
        │   │   └── ActivityCharts.tsx         # Recharts visualizations
        │   ├── config/
        │   │   └── ConfigModal.tsx            # Jira config + user mgmt
        │   └── shared/
        │       └── StatusIndicator.tsx
        ├── services/jiraApi.ts               # API calls (via backend proxy)
        ├── hooks/useJira.ts                  # TanStack Query hooks
        ├── store/configStore.ts              # Zustand state
        ├── utils/exportUtils.ts             # CSV + Excel export
        └── types/index.ts                   # Shared TypeScript types
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- A Jira Cloud or Server instance
- A Jira API token ([generate one here](https://id.atlassian.com/manage-profile/security/api-tokens))

### 1. Install Dependencies

```bash
# Install root dev tools
npm install

# Install backend + frontend
npm run install:all
```

### 2. Configure Backend

```bash
cd backend
cp .env.example .env
# Edit .env — set PORT and FRONTEND_URL if needed
```

### 3. Start Development Servers

```bash
# From repo root — starts both backend (port 3001) and frontend (port 5173)
npm run dev
```

Open **http://localhost:5173** in your browser.

### 4. Configure in the App

1. Click **"Configure"** (top right)
2. Enter your **Jira Base URL** (e.g., `https://yourcompany.atlassian.net`)
3. Enter your **email** and **API token**
4. Click **"Validate & Connect"**
5. Go to **"Team Members"** tab → search and add users to track

---

## Security Design

- **API token is never stored** — it's only kept in memory for the browser session and sent per-request via a custom HTTP header (`x-jira-token`).
- **Backend proxy pattern** — the frontend never calls Jira directly. All Jira API calls go through the backend, which validates the config on each request.
- **No server-side credential storage** — the backend receives credentials from the frontend per-request and forwards them to Jira. Nothing is persisted.
- **Rate limiting** — backend enforces 500 requests per 15 minutes per IP.
- **Input validation** — all inputs validated with Zod schemas server-side.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/jira/validate` | Test Jira connection |
| `GET` | `/api/jira/users/search?query=` | Search Jira users |
| `GET` | `/api/jira/projects` | List all projects |
| `GET` | `/api/jira/activity` | Fetch aggregated activity |
| `POST` | `/api/jira/cache/clear` | Clear server-side cache |

All `/api/jira/*` endpoints require these headers:
```
x-jira-base-url: https://yourcompany.atlassian.net
x-jira-email: you@company.com
x-jira-token: your-api-token
```

### Activity Query Parameters

| Param | Format | Description |
|---|---|---|
| `userIds` | comma-separated accountIds | Users to fetch activity for |
| `startDate` | `YYYY-MM-DD` | Start of date range |
| `endDate` | `YYYY-MM-DD` | End of date range |
| `projectKeys` | comma-separated | Filter by project |
| `issueTypes` | comma-separated | Filter by issue type |
| `activityTypes` | comma-separated | Filter by activity type |

---

## Caching

The backend uses an in-memory cache (NodeCache) with these TTLs:

| Data | TTL |
|---|---|
| User lookups | 15 minutes |
| Project list | 15 minutes |
| Issue search results | 5 minutes |
| Comments + Worklogs | 5 minutes |

The "Refresh" button in the header clears all caches and re-fetches.

---

## Export

The table's **CSV** and **Excel** export buttons respect currently applied filters. Excel exports include two sheets:
- **Team Activity** — summary per user per day
- **Detailed Events** — every individual activity event

---

## Adding Future Tabs

The tab system is in `AppLayout.tsx`. To add a new tab:

```typescript
// In frontend/src/components/layout/AppLayout.tsx
const tabs = [
  { key: 'team-activity', label: 'Team Activity', icon: <TeamOutlined />, component: <TeamActivityTab /> },
  // Add your new tab:
  { key: 'my-feature', label: 'My Feature', icon: <MyIcon />, component: <MyTab /> },
];
```

---

## Jira API Notes

- Uses **Jira REST API v3** (`/rest/api/3/`)
- Compatible with **Jira Cloud** (Atlassian.net)
- For **Jira Server/Data Center**, set `baseUrl` to your server URL; the `/rest/api/3/` path should still work for modern versions. For older versions, you may need to change the client base URL to `/rest/api/2/` in `backend/src/services/jiraService.ts`.
- The `expand=changelog` parameter is used on the issue search endpoint — this is the key to accurate activity tracking.

---

## Performance Considerations

- Issues are fetched in **pages of 100** to handle large boards
- Comments and worklogs are fetched in **batches of 10** to avoid API rate limits
- Results are **cached server-side** to minimize redundant API calls
- For very large teams (50+ users) with wide date ranges, expect 30–60s load times on first fetch due to Jira API pagination

---

## Production Deployment

```bash
# Build both
npm run build

# Backend: serve dist/index.js with Node
cd backend && node dist/index.js

# Frontend: serve frontend/dist/ with any static server (nginx, Vercel, etc.)
```

Set `FRONTEND_URL` in backend `.env` to your production frontend URL for CORS.
