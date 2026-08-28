import { Router, type Request, type Response } from 'express';
import type { FilterQuery } from 'mongoose';
import { AuditLog, type IAuditLog } from '../models/AuditLog.js';
import { authRequired, requireRole } from '../middleware/auth.js';

export const logsRouter = Router();

const PACKING_ACTION_TYPES = [
  'PACKING_COMPLETE',
  'PACKING_UNCOMPLETE',
  'PACKING_SAVE',
  'PRODUCT_SCAN',
  'BOX_COMPLETE',
  'BOX_CREATE',
  'BOX_RENAME',
  'PALLET_CREATE',
  'PALLET_RENAME',
  'BOX_LINK_PALLET',
  'BOX_UNLINK_PALLET',
  'SOW_RENAME',
] as const;

logsRouter.use(authRequired, requireRole('admin'));

logsRouter.get('/', async (req: Request, res: Response) => {
  const { actionType, packingOnly } = req.query;
  const filter: FilterQuery<IAuditLog> = {};
  if (actionType) filter.actionType = actionType as string;
  if (packingOnly === 'true') {
    filter.actionType = { $in: [...PACKING_ACTION_TYPES] };
  }
  const logs = await AuditLog.find(filter)
    .sort({ timestamp: -1 })
    .limit(500)
    .populate('userId', 'username role');
  res.json({ logs });
});
