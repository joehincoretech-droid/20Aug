import type { Types } from 'mongoose';
import { AuditLog } from '../models/AuditLog.js';

export async function writeAudit(
  userId: Types.ObjectId | string,
  actionType: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  await AuditLog.create({
    userId,
    actionType,
    timestamp: new Date(),
    details,
  });
}
