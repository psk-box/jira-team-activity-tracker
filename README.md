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
        │   │   ├── TeamActivityTab.tsx        # Main activity tab
        │   │   ├── SprintInsightsTab.tsx      # Sprint KPI & contributor scorecard tab
        │   │   ├── ProductivityAnalyticsTab.tsx # Cycle times, peak productivity hours tab
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
        ├── store/configStore.ts              # Zustand state (Theme + Persisted Credentials)
        ├── utils/exportUtils.ts             # CSV + Excel export
        └── types/index.ts                   # Shared TypeScript types
```

---

## Core Dashboard Features

### 1. Team Activity (Main Dashboard)
- Visual analytics charts: Daily Activity Trends, Activity Type distribution, Top Active users, and Worklog Duration (hours logged on Y-axis vs users on X-axis).
- **Unique Issues Worked On**: Dynamic widget listing unique tickets touched per developer.
- Expandable daily table listing exact status changes, comment counts, edits, and worklog events.

### 2. Sprint Insights Tab
- **Sprint KPIs**: Displays total completed issues, refinements, collaborations (comments), and total hours.
- **Sprint Burn-up**: Visual cumulative area chart plotting completions over the selected date range.
- **Bug Resolution Rate**: Gauges bug-fixing progress using a visual radial indicator.
- **Sprint Contributor Scorecard**: Ranks developer contributions using a weighted point algorithm:
  $$\text{Score} = (\text{Completions} \times 10) + (\text{Unique Issues Touched} \times 4) + (\text{Hours Logged} \times 3) + (\text{Comments} \times 2)$$
  *Note: Issues touched only by status shifts are excluded from unique issues score count.*

### 3. Productivity Analytics Tab
- **Productivity KPIs**: Displays Average Cycle Time, Focus Intensity Index, average Time to Value, and active WIP count.
- **Peak Hour Analysis**: Identifies team peak hours by mapping events to the hour of the day (00:00 to 23:00).
- **Weekly Workload Intensity**: Groups event volumes across days of the week (Monday - Sunday).
- **WIP vs Completed Tasks**: Side-by-side comparison per developer.
- **Cycle Time Detail Table**: Lists completed issues showing start time (first "In Progress" transition), end time (transition to "Done"), and total cycle duration.

### 4. Aesthetics & Theme Selection
- Premium, state-of-the-art visual styling featuring smooth micro-animations.
- Fully-integrated **Dark & Light Modes** with custom-designed palettes dynamically overriding CSS variables at runtime.

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

## Security & State Design

- **Persisted Token Cache**: For convenience, configuration state (including `apiToken` and light/dark theme preference) is cached securely client-side in the browser's local storage.
- **Backend proxy pattern**: The frontend never calls Jira directly. All API calls pass through the backend proxy, which validates the headers on each request.
- **No server-side credential storage**: The backend receives credentials from the frontend per-request and forwards them to Jira. Nothing is persisted on the server.
- **Rate limiting**: Backend enforces 500 requests per 15 minutes per IP.
- **Input validation**: All inputs are validated with Zod schemas server-side.

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

---

## Caching Policy

All cache times are unified to exactly **5 minutes** (300 seconds TTL on the backend, 300,000ms staleTime on the frontend) to maintain cache integrity:

| Data | TTL (Cache Time) |
|---|---|
| User lookups | 5 minutes |
| Project lists | 5 minutes |
| Issue search results | 5 minutes |
| Comments + Worklogs | 5 minutes |

The "Refresh" reload icon button in the app header clears all backend/frontend caches and triggers a fresh load.

---

## Export

The table's **CSV** and **Excel** export buttons respect currently applied filters. Excel exports include two sheets:
- **Team Activity** — summary per user per day
- **Detailed Events** — every individual activity event

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
