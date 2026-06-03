# Jira Team Activity Tracker

A production-grade dashboard that tracks **actual work done** by team members in Jira and GitLab, using changelog analysis rather than simple issue assignment or field updates.

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
├── backend/                 # Express + Node.js (plain JavaScript) API proxy
│   └── src/
│       ├── services/
│       │   ├── jiraService.js        # Jira REST API integration
│       │   ├── gitlabService.js      # GitLab REST API integration + mock mode
│       │   ├── aggregationService.js # Activity aggregation logic
│       │   └── logger.js             # Winston logger
│       ├── routes/
│       │   ├── jira.js               # /api/jira/* endpoints
│       │   ├── gitlab.js             # /api/gitlab/* endpoints
│       │   └── config.js             # /api/config/* endpoints
│       ├── middleware/
│       │   ├── errorHandler.js
│       │   └── requestLogger.js
│       └── index.js                  # Express app entry point
│
└── frontend/                # React + TypeScript + Ant Design
    └── src/
        ├── components/
        │   ├── layout/AppLayout.tsx          # Tab-based shell (extensible)
        │   ├── dashboard/
        │   │   ├── TeamActivityTab.tsx        # Main Jira activity tab
        │   │   ├── SprintInsightsTab.tsx      # Sprint KPI & contributor scorecard
        │   │   ├── ProductivityAnalyticsTab.tsx # Cycle times, peak productivity hours
        │   │   ├── GitlabActivityTab.tsx      # GitLab Beta integration tab
        │   │   ├── SummaryCards.tsx           # KPI cards
        │   │   ├── ActivityTable.tsx          # Expandable data table
        │   │   └── FiltersBar.tsx             # Filter controls
        │   ├── charts/
        │   │   └── ActivityCharts.tsx         # Recharts visualizations
        │   ├── config/
        │   │   └── ConfigModal.tsx            # Jira config + GitLab config + user mgmt
        │   └── shared/
        │       └── StatusIndicator.tsx
        ├── services/jiraApi.ts               # Jira API calls (via backend proxy)
        ├── services/gitlabApi.ts             # GitLab API calls (via backend proxy)
        ├── hooks/useJira.ts                  # TanStack Query hooks
        ├── store/configStore.ts              # Zustand state (Theme + Persisted Credentials)
        ├── utils/exportUtils.ts             # CSV + Excel export
        └── types/index.ts                   # Shared TypeScript types
```

---

## Core Dashboard Features

### 1. Team Activity (Main Dashboard)
- Visual analytics charts: Daily Activity Trends, Activity Type distribution, Top Active users, and Worklog Duration.
- **Unique Issues Worked On**: Dynamic widget listing unique tickets touched per developer.
- Expandable daily table listing exact status changes, comment counts, edits, and worklog events.

### 2. Sprint Insights Tab
- **Sprint KPIs**: Displays total completed issues, refinements, collaborations (comments), and total hours.
- **Sprint Burn-up**: Visual cumulative area chart plotting completions over the selected date range.
- **Bug Resolution Rate**: Gauges bug-fixing progress using a visual radial indicator.
- **Sprint Contributor Scorecard**: Ranks developer contributions using a weighted point algorithm:
  $$\text{Score} = (\text{Completions} \times 10) + (\text{Unique Issues Touched} \times 4) + (\text{Hours Logged} \times 3) + (\text{Comments} \times 2)$$

### 3. Productivity Analytics Tab
- **Productivity KPIs**: Average Cycle Time, Focus Intensity Index, Time to Value, and active WIP count.
- **Peak Hour Analysis**: Identifies team peak hours by mapping events to the hour of the day.
- **Weekly Workload Intensity**: Groups event volumes across days of the week.
- **WIP vs Completed Tasks**: Side-by-side comparison per developer.
- **Cycle Time Detail Table**: Lists completed issues with start/end timestamps and total cycle duration.

### 4. GitLab Activity Tab *(Beta)*
Track your team's GitLab contributions alongside Jira activity.

**Widgets:**
- **Commits & Pushes** — total commit/push counts for the date range
- **Merge Requests** — opened, merged, and closed MR counts
- **Activity Breakdown** — pie chart of pushes / MRs / comments
- **Contributor Scorecard** — ranked by lines of code, branch count, and MR count
- **Daily Contributions Heatmap** — per-person contribution intensity per day
- **Weekly Intensity** — bar chart of activity volume by day of week
- **Pipeline Runs** — CI/CD pipeline status across projects
- **MR Cycle Time** — time from MR open to merge
- **Project Focus** — which projects each team member is most active in
- **Activity Feed** — chronological list of all GitLab events

**Mock Mode:** Enter `mock` as the GitLab token to instantly populate the dashboard with simulated data (no real GitLab instance required).

### 5. Aesthetics & Theme Selection
- Premium, state-of-the-art visual styling featuring smooth micro-animations.
- Fully-integrated **Dark & Light Modes** with custom-designed palettes.

---

## Quick Start

### Prerequisites
- Node.js 18+ (required for the `--watch` flag used in dev mode)
- A Jira Cloud or Server instance
- A Jira API token ([generate one here](https://id.atlassian.com/manage-profile/security/api-tokens))
- *(Optional)* A GitLab instance or use mock mode

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

### 4. Configure Jira in the App

1. Click **"Configure"** (top right)
2. Enter your **Jira Base URL** (e.g., `https://yourcompany.atlassian.net`)
3. Enter your **email** and **API token**
4. Click **"Validate & Connect"**
5. Go to **"Team Members"** tab → search and add users to track

### 5. Configure GitLab (Optional)

1. Click **"Configure"** (top right)
2. Switch to the **"GitLab"** tab in the config modal
3. Enter your **GitLab Base URL** (e.g., `https://gitlab.com` or your self-hosted URL)
4. Enter a **Personal Access Token** with `read_api` scope — or type `mock` to use simulated data
5. Map each team member's **GitLab username** in the Team Members list
6. Navigate to the **"GitLab (Beta)"** tab

---

## Security & State Design

- **Persisted Token Cache**: Configuration state (credentials, theme preference) is cached client-side in browser local storage.
- **Backend proxy pattern**: The frontend never calls Jira/GitLab directly. All API calls pass through the backend proxy, which validates headers on each request.
- **No server-side credential storage**: Credentials are forwarded per-request to upstream APIs; nothing is persisted on the server.
- **Rate limiting**: Backend enforces 500 requests per 15 minutes per IP.
- **Input validation**: All inputs are validated with Zod schemas on the backend.

---

## API Endpoints

### Jira Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/jira/validate` | Test Jira connection |
| `GET` | `/api/jira/users/search?query=` | Search Jira users |
| `GET` | `/api/jira/projects` | List all projects |
| `GET` | `/api/jira/activity` | Fetch aggregated activity |
| `POST` | `/api/jira/cache/clear` | Clear server-side cache |

Required headers for all `/api/jira/*` endpoints:
```
x-jira-base-url: https://yourcompany.atlassian.net
x-jira-email: you@company.com
x-jira-token: your-api-token
```

### GitLab Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/gitlab/validate` | Test GitLab connection |
| `POST` | `/api/gitlab/activity` | Fetch GitLab activity for users & date range |

Required headers for all `/api/gitlab/*` endpoints:
```
x-gitlab-base-url: https://gitlab.com
x-gitlab-token: your-personal-access-token (or "mock")
```

---

## Caching Policy

All cache times are unified to exactly **5 minutes** (300 seconds TTL on the backend, 300,000ms staleTime on the frontend):

| Data | TTL |
|---|---|
| User lookups | 5 minutes |
| Project lists | 5 minutes |
| Issue search results | 5 minutes |
| Comments + Worklogs | 5 minutes |

The **Refresh** button in the app header clears all backend/frontend caches and triggers a fresh load.

---

## Export

The table's **CSV** and **Excel** export buttons respect currently applied filters. Excel exports include two sheets:
- **Team Activity** — summary per user per day
- **Detailed Events** — every individual activity event

---

## Production Deployment

```bash
# Build frontend Vite bundle
npm run build

# Backend: run directly with Node (no build step needed)
cd backend && node src/index.js

# Frontend: serve frontend/dist/ with any static server (nginx, Vercel, etc.)
```

Set `FRONTEND_URL` in `backend/.env` to your production frontend URL for CORS.

> **Note:** The backend runs directly from source (`src/index.js`) — no TypeScript compilation step is required.
