'use strict';

const { Router } = require('express');
const { z } = require('zod');
const { getJiraService } = require('../services/jiraService');
const { aggregateActivities, buildDashboardSummary, filterActivities } = require('../services/aggregationService');
const { logger } = require('../services/logger');

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
  projectKeys: z.string().optional().transform(s => (s ? s.split(',').filter(Boolean) : [])),
  issueTypes: z.string().optional().transform(s => (s ? s.split(',').filter(Boolean) : [])),
  activityTypes: z.string().optional().transform(s => (s ? s.split(',').filter(Boolean) : [])),
  targetDate: z.string().optional(),
});

// ─── Helper: Get config from request headers ──────────────────────────────────

function getConfigFromRequest(req) {
  const baseUrl = req.headers['x-jira-base-url'];
  const email = req.headers['x-jira-email'];
  const apiToken = req.headers['x-jira-token'];

  const result = jiraConfigSchema.safeParse({ baseUrl, email, apiToken });
  if (!result.success) {
    throw new Error('Invalid Jira configuration in request headers');
  }

  return result.data;
}

// ─── Validate Connection ───────────────────────────────────────────────────────

router.get('/validate', async (req, res, next) => {
  try {
    const config = getConfigFromRequest(req);
    const service = getJiraService(config);
    const user = await service.validateConnection();
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

// ─── Search Users ──────────────────────────────────────────────────────────────

router.get('/users/search', async (req, res, next) => {
  try {
    const config = getConfigFromRequest(req);
    const query = req.query.query || '';
    const service = getJiraService(config);
    const users = await service.searchUsers(query);
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// ─── Get Projects ──────────────────────────────────────────────────────────────

router.get('/projects', async (req, res, next) => {
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

router.get('/activity', async (req, res, next) => {
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
    const userMap = new Map();
    await Promise.all(
      filters.userIds.map(async uid => {
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
      filters.endTime
    );

    // Aggregate into per-user-per-day summaries
    let activities = aggregateActivities(rawActivityMap, userMap);

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

// ─── Filter Stats ──────────────────────────────────────────────────────────────

router.get('/filter/:id/stats', async (req, res, next) => {
  try {
    const config = getConfigFromRequest(req);
    const service = getJiraService(config);
    const filterId = req.params.id;
    const stats = await service.getFilterStats(filterId);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// ─── Clear Cache ───────────────────────────────────────────────────────────────

router.post('/cache/clear', async (req, res, next) => {
  try {
    const config = getConfigFromRequest(req);
    const service = getJiraService(config);
    service.clearCache();
    res.json({ success: true, message: 'Cache cleared' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
