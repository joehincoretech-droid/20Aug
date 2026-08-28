import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api';
import type { AuditLog } from '../types';
import { formatDateTime } from '../utils/date';

const ACTION_LABELS: Record<string, string> = {
  PACKING_UNCOMPLETE: 'SOW unfinish',
  SOW_RENAME: 'SOW number changed',
  BOX_RENAME: 'Outer Box ID changed',
  PALLET_RENAME: 'Pallet ID changed',
  PACKING_COMPLETE: 'SOW finished',
  PACKING_SAVE: 'Packing saved',
  PRODUCT_SCAN: 'Product scanned',
  BOX_COMPLETE: 'Box completed',
  BOX_CREATE: 'Outer box created',
  PALLET_CREATE: 'Pallet created',
  BOX_LINK_PALLET: 'Box linked to pallet',
  BOX_UNLINK_PALLET: 'Box unlinked from pallet',
};

function formatAuditDetails(actionType: string, details: unknown): string {
  const d = (details ?? {}) as Record<string, unknown>;
  switch (actionType) {
    case 'PACKING_UNCOMPLETE':
      return `Reopened SOW ${d.sowNumber ?? '—'} (PO ${d.poNumber ?? '—'})`;
    case 'SOW_RENAME':
      return `${d.previous ?? '—'} → ${d.sowNumber ?? '—'} · PO ${d.poNumber ?? '—'}`;
    case 'BOX_RENAME':
      return `${d.previous ?? '—'} → ${d.boxId ?? '—'} · SOW ${d.sowNumber ?? '—'} (PO ${d.poNumber ?? '—'})`;
    case 'PALLET_RENAME':
      return `${d.previous ?? '—'} → ${d.palletId ?? '—'} · SOW ${d.sowNumber ?? '—'} (PO ${d.poNumber ?? '—'})`;
    default:
      return JSON.stringify(details, null, 2);
  }
}

function actionLabel(actionType: string): string {
  return ACTION_LABELS[actionType] ?? actionType;
}

export function Logs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [packingOnly, setPackingOnly] = useState(false);

  useEffect(() => {
    api<{ logs: AuditLog[] }>(`/api/logs${packingOnly ? '?packingOnly=true' : ''}`)
      .then((d) => setLogs(d.logs))
      .catch((err: Error) => toast.error(err.message));
  }, [packingOnly]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">System Audit Logs</h1>
          <p className="text-slate-500 mt-1">Operations performed across the warehouse system.</p>
        </div>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={packingOnly} onChange={(e) => setPackingOnly(e.target.checked)} />
          Packing-related only
        </label>
      </div>
      <div className="mt-6 bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log._id} className="border-t align-top">
                <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(log.timestamp)}</td>
                <td className="px-4 py-3">{log.userId?.username || '—'}</td>
                <td className="px-4 py-3 text-xs font-medium text-slate-800">
                  {actionLabel(log.actionType)}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600 whitespace-pre-wrap">
                  {formatAuditDetails(log.actionType, log.details)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
