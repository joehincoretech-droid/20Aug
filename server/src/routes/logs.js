import { Router } from 'express';
import { AuditLog } from '../models/AuditLog.js';
import { authRequired, requireRole } from '../middleware/auth.js';

export const logsRouter = Router();

logsRouter.use(authRequired, requireRole('admin'));

logsRouter.get('/', async (req, res) => {
  const { actionType, packingOnly } = req.query;
  const filter = {};
  if (actionType) filter.actionType = actionType;
  if (packingOnly === 'true') {
    filter.actionType = {
      $in: ['PACKING_COMPLETE', 'PRODUCT_SCAN', 'BOX_COMPLETE', 'BOX_CREATE', 'PALLET_CREATE', 'BOX_LINK_PALLET'],
    };
  }
  const logs = await AuditLog.find(filter)
    .sort({ timestamp: -1 })
    .limit(500)
    .populate('userId', 'username role');
  res.json({ logs });
});
