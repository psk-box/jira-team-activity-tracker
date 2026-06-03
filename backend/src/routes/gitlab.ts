import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { GitlabService } from "../services/gitlabService";
import { logger } from "../services/logger";

const router = Router();

// ─── Validation Schemas ────────────────────────────────────────────────────────

const gitlabConfigHeadersSchema = z.object({
  baseUrl: z.string().url().optional().default("https://gitlab.com"),
  token: z.string().min(1),
});

const gitlabActivityBodySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  users: z.array(
    z.object({
      accountId: z.string(),
      displayName: z.string(),
      emailAddress: z.string(),
      gitlabUsername: z.string().optional(),
      gitlabEmail: z.string().optional(),
      avatarUrl: z.string().optional().default(""),
    })
  ),
});

// ─── Helper: Get config from request headers ──────────────────────────────────

function getConfigFromRequest(req: Request) {
  const baseUrl = (req.headers["x-gitlab-base-url"] as string) || "https://gitlab.com";
  const token = req.headers["x-gitlab-token"] as string;

  const result = gitlabConfigHeadersSchema.safeParse({ baseUrl, token });
  if (!result.success) {
    throw new Error("Missing or invalid GitLab connection configuration (x-gitlab-token is required)");
  }

  return result.data;
}

// ─── Validate Connection ───────────────────────────────────────────────────────

router.get("/validate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = getConfigFromRequest(req);
    const service = new GitlabService(config);
    const user = await service.validateConnection();
    res.json({ success: true, user });
  } catch (err: any) {
    next(err);
  }
});

// ─── Fetch Activity Data ───────────────────────────────────────────────────────

router.post("/activity", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = getConfigFromRequest(req);
    const { startDate, endDate, users } = gitlabActivityBodySchema.parse(req.body);

    if (users.length === 0) {
      return res.json({ activities: [], pipelines: [], summary: {}, isMock: true });
    }

    logger.info("Fetching GitLab activity", {
      userCount: users.length,
      startDate,
      endDate,
    });

    const service = new GitlabService(config);
    const data = await service.fetchUserActivity(users, startDate, endDate);
    
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
