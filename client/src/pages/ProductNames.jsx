import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api.js';
import { Modal } from '../components/Modal.jsx';

export function ProductNames() {
  const [names, setNames] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ sku: '', name: '' });

  async function load() {
    const data = await api('/api/product-names');
    setNames(data.names);
  }

  useEffect(() => {
    load().catch((err) => toast.error(err.message));
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ sku: '', name: '' });
    setOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({ sku: item.sku || '', name: item.name });
    setOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    const sku = form.sku.trim();
    const name = form.name.trim();
    if (!sku || !name) {
      toast.error('SKU and product name are required');
      return;
    }
    try {
      if (editing) {
        await api(`/api/product-names/${editing._id}`, {
          method: 'PATCH',
          body: { sku, name },
        });
        toast.success('SKU / product name updated');
      } else {
        await api('/api/product-names', { method: 'POST', body: { sku, name } });
        toast.success('SKU / product name added');
      }
      setOpen(false);
      setForm({ sku: '', name: '' });
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function remove(item) {
    if (!window.confirm(`Delete "${item.sku} · ${item.name}"?`)) return;
    try {
      await api(`/api/product-names/${item._id}`, { method: 'DELETE' });
      toast.success('Removed');
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">SKU / Product Names</h1>
          <p className="text-slate-500 mt-1">
            Each SKU is linked to one product name. Used in Create SOW and packing.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg bg-amber-500 px-4 py-2.5 font-semibold text-slate-950"
        >
          Add SKU / Name
        </button>
      </div>
      <div className="mt-6 bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Product Name</th>
              <th className="px-4 py-3 font-medium w-40">Actions</th>
            </tr>
          </thead>
          <tbody>
            {names.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-slate-400">
                  No items yet. Run seed or add one.
                </td>
              </tr>
            )}
            {names.map((item) => (
              <tr key={item._id} className="border-t">
                <td className="px-4 py-3 font-mono">{item.sku}</td>
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      className="rounded-lg border px-3 py-1 text-xs hover:bg-slate-50"
                      onClick={() => openEdit(item)}
                    >
                      Edit
                    </button>
                    <button
                      className="rounded-lg border border-red-200 text-red-700 px-3 py-1 text-xs hover:bg-red-50"
                      onClick={() => remove(item)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <Modal
          title={editing ? 'Edit SKU / Product Name' : 'Add SKU / Product Name'}
          onClose={() => setOpen(false)}
        >
          <form className="space-y-3" onSubmit={save}>
            <label className="block text-sm">
              SKU
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 font-mono"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                required
                autoFocus
              />
            </label>
            <label className="block text-sm">
              Product name
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <button className="rounded-lg bg-slate-950 text-white px-4 py-2">Save</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
