import { AuditLog } from '../models/AuditLog.js';

export async function writeAudit(userId, actionType, details = {}) {
  await AuditLog.create({
    userId,
    actionType,
    timestamp: new Date(),
    details,
  });
}
