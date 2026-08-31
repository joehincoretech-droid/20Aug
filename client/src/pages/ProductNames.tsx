import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';
import { Modal } from '../components/Modal';
import type { ProductName } from '../types';

type SkuSortKey = 'sku' | 'name' | 'boxesPerOuterBox';
type SortDir = 'asc' | 'desc';

type ProductNameForm = { sku: string; name: string; boxesPerOuterBox: string };

const EMPTY_FORM: ProductNameForm = { sku: '', name: '', boxesPerOuterBox: '' };

export function ProductNames() {
  const [names, setNames] = useState<ProductName[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductName | null>(null);
  const [form, setForm] = useState<ProductNameForm>(EMPTY_FORM);
  const [sortKey, setSortKey] = useState<SkuSortKey>('sku');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [search, setSearch] = useState('');

  async function load() {
    const data = await api<{ names: ProductName[] }>('/api/product-names');
    setNames(data.names);
  }

  useEffect(() => {
    load().catch((err: Error) => toast.error(err.message));
  }, []);

  function handleSort(key: SkuSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = names;
    if (q) {
      list = list.filter(
        (item) =>
          (item.sku || '').toLowerCase().includes(q) ||
          (item.name || '').toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'sku') {
        cmp = (a.sku || '').localeCompare(b.sku || '');
      } else if (sortKey === 'name') {
        cmp = (a.name || '').localeCompare(b.name || '');
      } else {
        cmp = (a.boxesPerOuterBox ?? 0) - (b.boxesPerOuterBox ?? 0);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [names, sortKey, sortDir, search]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(item: ProductName) {
    setEditing(item);
    setForm({
      sku: item.sku || '',
      name: item.name,
      boxesPerOuterBox: String(item.boxesPerOuterBox ?? ''),
    });
    setOpen(true);
  }

  function parseCapacity(value: string): number | null {
    const n = Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null;
    return n;
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const sku = form.sku.trim();
    const name = form.name.trim();
    const boxesPerOuterBox = parseCapacity(form.boxesPerOuterBox);
    if (!sku || !name) {
      toast.error('SKU and product name are required');
      return;
    }
    if (boxesPerOuterBox === null) {
      toast.error('Boxes per outer box must be a whole number of at least 1');
      return;
    }
    try {
      const body = { sku, name, boxesPerOuterBox };
      if (editing) {
        await api(`/api/product-names/${editing._id}`, { method: 'PATCH', body });
        toast.success('SKU / product name updated');
      } else {
        await api('/api/product-names', { method: 'POST', body });
        toast.success('SKU / product name added');
      }
      setOpen(false);
      setForm(EMPTY_FORM);
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed');
    }
  }

  async function remove(item: ProductName) {
    if (!window.confirm(`Delete "${item.sku} · ${item.name}"?`)) return;
    try {
      await api(`/api/product-names/${item._id}`, { method: 'DELETE' });
      toast.success('Removed');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed');
    }
  }

  function SortButton({ column, label }: { column: SkuSortKey; label: string }) {
    return (
      <button
        type="button"
        onClick={() => handleSort(column)}
        className={`inline-flex items-center gap-1 rounded-md px-1 py-0.5 -mx-1 hover:bg-slate-200/70 hover:text-slate-900 ${
          sortKey === column ? 'text-slate-900' : ''
        }`}
      >
        {label}
        {sortKey === column ? (
          sortDir === 'asc' ? (
            <ChevronUp size={13} />
          ) : (
            <ChevronDown size={13} />
          )
        ) : (
          <ChevronsUpDown size={13} className="opacity-40" />
        )}
      </button>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">SKU / Product Names</h1>
          <p className="text-slate-500 mt-1">
            Each SKU is linked to one product name and an outer-box capacity. Used in Create SOW and
            packing.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg bg-amber-500 px-4 py-2.5 font-semibold text-slate-950"
        >
          Add SKU / Name
        </button>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
        <div className="relative flex-1 min-w-0 sm:min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            className="w-full rounded-lg border bg-white pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            placeholder="Search SKU or product name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => setSearch('')}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="text-xs text-slate-400 sm:ml-auto shrink-0">
          {rows.length} / {names.length} rows
        </div>
      </div>

      <div className="mt-3 bg-white rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">
                  <SortButton column="sku" label="SKU" />
                </th>
                <th className="px-4 py-3 font-medium">
                  <SortButton column="name" label="Product Name" />
                </th>
                <th className="px-4 py-3 font-medium">
                  <SortButton column="boxesPerOuterBox" label="Boxes / outer box" />
                </th>
                <th className="px-4 py-3 font-medium w-40">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                    {names.length === 0 ? 'No items yet. Run seed or add one.' : 'No items match your search.'}
                  </td>
                </tr>
              )}
              {rows.map((item) => (
                <tr key={item._id} className="border-t">
                  <td className="px-4 py-3 font-mono whitespace-nowrap">{item.sku}</td>
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {item.boxesPerOuterBox != null
                      ? `${item.boxesPerOuterBox} Boxes/Outer Box`
                      : '—'}
                  </td>
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
            <label className="block text-sm">
            Boxes/Outer Box
              <input
                type="number"
                min={1}
                step={1}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.boxesPerOuterBox}
                onChange={(e) => setForm({ ...form, boxesPerOuterBox: e.target.value })}
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                How many inner boxes fit in one outer box (required for packing).
              </p>
            </label>
            <button className="rounded-lg bg-slate-950 text-white px-4 py-2">Save</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
