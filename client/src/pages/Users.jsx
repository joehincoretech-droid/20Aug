import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api.js';
import { Modal } from '../components/Modal.jsx';

export function Users() {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'worker' });

  async function load() {
    const data = await api('/api/users');
    setUsers(data.users);
  }

  useEffect(() => {
    load().catch((err) => toast.error(err.message));
  }, []);

  async function createUser(e) {
    e.preventDefault();
    try {
      await api('/api/users', { method: 'POST', body: form });
      toast.success('Account created');
      setOpen(false);
      setForm({ username: '', password: '', role: 'worker' });
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">User Management</h1>
          <p className="text-slate-500 mt-1">Admins can create worker, PO clerk, or additional admin accounts.</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg bg-amber-500 px-4 py-2.5 font-semibold text-slate-950"
        >
          Create user
        </button>
      </div>
      <div className="mt-6 bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Username</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} className="border-t">
                <td className="px-4 py-3 font-medium">{u.username}</td>
                <td className="px-4 py-3 uppercase text-xs tracking-wide">{u.role}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(u.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <Modal title="Create user" onClose={() => setOpen(false)}>
          <form className="space-y-3" onSubmit={createUser}>
            <label className="block text-sm">
              Username
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
              />
            </label>
            <label className="block text-sm">
              Password
              <input
                type="password"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </label>
            <label className="block text-sm">
              Role
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="worker">worker — packing</option>
                <option value="po">po — create purchase orders</option>
                <option value="admin">admin</option>
              </select>
            </label>
            <button className="rounded-lg bg-slate-950 text-white px-4 py-2">Create</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
