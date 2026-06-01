import { Router, Request, Response } from 'express';

const router = Router();

// Health/version info only — actual Jira config is passed via request headers
// (never stored server-side to avoid credential exposure)
router.get('/info', (_req: Request, res: Response) => {
  res.json({
    version: '1.0.0',
    name: 'Jira Team Activity Tracker',
    features: ['changelog-analysis', 'comment-tracking', 'worklog-tracking'],
  });
});

export default router;
