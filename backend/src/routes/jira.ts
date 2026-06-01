import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getJiraService, JiraUser, ActivityEvent } from '../services/jiraService';
import { aggregateActivities, buildDashboardSummary, filterActivities } from '../services/aggregationService';
import { logger } from '../services/logger';

const router = Router();

// ─── Validation Schemas ────────────────────────────────────────────────────────

const jiraConfigSchema = z.object({
  baseUrl: z.string().url(),
  email: z.string().email(),
  apiToken: z.string().min(1),
});

const activityQuerySchema = z.object({
  userIds: z.string().transform(s => s.split(',').filter(Boolean)),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().default('00:00'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().default('23:59'),
  projectKeys: z.string().optional().transform(s => s ? s.split(',').filter(Boolean) : []),
  issueTypes: z.string().optional().transform(s => s ? s.split(',').filter(Boolean) : []),
  activityTypes: z.string().optional().transform(s => s ? s.split(',').filter(Boolean) : []),
  targetDate: z.string().optional(),
});

// ─── Helper: Get config from request ──────────────────────────────────────────

function getConfigFromRequest(req: Request) {
  const baseUrl = req.headers['x-jira-base-url'] as string;
  const email = req.headers['x-jira-email'] as string;
  const apiToken = req.headers['x-jira-token'] as string;

  const result = jiraConfigSchema.safeParse({ baseUrl, email, apiToken });
  if (!result.success) {
    throw new Error('Invalid Jira configuration in request headers');
  }

  return result.data;
}

// ─── Validate Connection ───────────────────────────────────────────────────────

router.get('/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = getConfigFromRequest(req);
    const service = getJiraService(config);
    const user = await service.validateConnection();
    res.json({ success: true, user });
  } catch (err: any) {
    next(err);
  }
});

// ─── Search Users ──────────────────────────────────────────────────────────────

router.get('/users/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = getConfigFromRequest(req);
    const query = (req.query.query as string) || '';
    const service = getJiraService(config);
    const users = await service.searchUsers(query);
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// ─── Get Projects ──────────────────────────────────────────────────────────────

router.get('/projects', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = getConfigFromRequest(req);
    const service = getJiraService(config);
    const projects = await service.getProjects();
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

// ─── Fetch Activity Data ───────────────────────────────────────────────────────

router.get('/activity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = getConfigFromRequest(req);
    const filters = activityQuerySchema.parse(req.query);

    if (filters.userIds.length === 0) {
      return res.json({ activities: [], summary: null });
    }

    logger.info('Fetching activity', {
      userIds: filters.userIds,
      startDate: filters.startDate,
      endDate: filters.endDate,
    });

    const service = getJiraService(config);

    // Fetch user details for all tracked users
    const userMap = new Map<string, JiraUser>();
    await Promise.all(
      filters.userIds.map(async (uid) => {
        try {
          const user = await service.getUser(uid);
          userMap.set(uid, user);
        } catch (e) {
          logger.warn(`Could not fetch user ${uid}`, e);
        }
      })
    );

    // Fetch raw activity from Jira changelog + comments + worklogs
    const rawActivityMap = await service.fetchUserActivity(
      filters.userIds,
      filters.startDate,
      filters.endDate,
      filters.projectKeys,
      filters.startTime,
      filters.endTime,
    );

    // Convert Map<string, ActivityEvent[][]> to Map<string, ActivityEvent[]>
    const flatMap = new Map<string, ActivityEvent[]>();
    for (const [key, eventArrays] of rawActivityMap.entries()) {
      // eventArrays is actually ActivityEvent[] already from our service
      flatMap.set(key, eventArrays as unknown as ActivityEvent[]);
    }

    // Aggregate into per-user-per-day summaries
    let activities = aggregateActivities(flatMap, userMap);

    // Apply additional filters
    activities = filterActivities(activities, {
      userIds: filters.userIds,
      projectKeys: filters.projectKeys,
      issueTypes: filters.issueTypes,
      activityTypes: filters.activityTypes,
      startDate: filters.startDate,
      endDate: filters.endDate,
    });

    // Build summary statistics
    const summary = buildDashboardSummary(activities, filters.targetDate);

    res.json({ activities, summary });
  } catch (err) {
    next(err);
  }
});

// ─── Clear Cache ───────────────────────────────────────────────────────────────

router.post('/cache/clear', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = getConfigFromRequest(req);
    const service = getJiraService(config);
    service.clearCache();
    res.json({ success: true, message: 'Cache cleared' });
  } catch (err) {
    next(err);
  }
});

export default router;
