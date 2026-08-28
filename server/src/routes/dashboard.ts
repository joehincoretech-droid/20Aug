import { Router, type Request, type Response } from 'express';
import { authRequired } from '../middleware/auth.js';
import type { UserRole } from '../models/User.js';
import { buildDashboardStats } from '../utils/buildDashboardStats.js';

export const dashboardRouter = Router();

dashboardRouter.get('/', authRequired, async (req: Request, res: Response) => {
  const role = (req.user?.role || 'worker') as UserRole;
  const stats = await buildDashboardStats(role);
  res.json({ stats });
});
