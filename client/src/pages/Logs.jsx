import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api.js';

export function Logs() {
  const [logs, setLogs] = useState([]);
  const [packingOnly, setPackingOnly] = useState(false);

  useEffect(() => {
    api(`/api/logs${packingOnly ? '?packingOnly=true' : ''}`)
      .then((d) => setLogs(d.logs))
      .catch((err) => toast.error(err.message));
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
                <td className="px-4 py-3 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                <td className="px-4 py-3">{log.userId?.username || '—'}</td>
                <td className="px-4 py-3 font-mono text-xs">{log.actionType}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-pre-wrap">
                  {JSON.stringify(log.details, null, 2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
