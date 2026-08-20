import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../api.js';

export function History() {
  const navigate = useNavigate();
  const [sows, setSows] = useState([]);

  useEffect(() => {
    api('/api/sows/history')
      .then((d) => setSows(d.sows))
      .catch((err) => toast.error(err.message));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Completed Packing History</h1>
      <p className="text-slate-500 mt-1">Finished SOW packing records.</p>
      <div className="mt-6 bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Completed</th>
              <th className="px-4 py-3 font-medium">SOW</th>
              <th className="px-4 py-3 font-medium">PO</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Batch</th>
              <th className="px-4 py-3 font-medium">SKUs</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">By</th>
            </tr>
          </thead>
          <tbody>
            {sows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                  No completed packing jobs yet.
                </td>
              </tr>
            )}
            {sows.map((sow) => (
              <tr
                key={sow._id}
                className="border-t hover:bg-slate-50 cursor-pointer"
                onClick={() => navigate(`/pack/${sow._id}`)}
              >
                <td className="px-4 py-3">{sow.completedAt ? new Date(sow.completedAt).toLocaleString() : '—'}</td>
                <td className="px-4 py-3 font-mono">{sow.sowNumber}</td>
                <td className="px-4 py-3 font-mono">{sow.poNumber}</td>
                <td className="px-4 py-3">{sow.clientCode}</td>
                <td className="px-4 py-3">{sow.batchNo}</td>
                <td className="px-4 py-3">{sow.selectedSKUs.join(', ')}</td>
                <td className="px-4 py-3">{sow.totalAmount}</td>
                <td className="px-4 py-3">{sow.completedBy?.username || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
