import { useEffect, useMemo, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { Search, X } from 'lucide-react';
import { api } from '../api';
import { Modal } from '../components/Modal';
import type { User, UserRole } from '../types';
import {
  PASSWORD_MAX_AGE_DAYS,
  PASSWORD_REQUIREMENTS,
  validatePassword,
} from '../utils/password';
import { formatDateTime } from '../utils/date';

type UserForm = { username: string; password: string; confirmPassword: string; role: UserRole };

type RoleFilter = 'all' | UserRole;

const EMPTY_FORM: UserForm = { username: '', password: '', confirmPassword: '', role: 'worker' };

function PasswordHint() {
  return <p className="text-xs text-slate-500 mt-1">{PASSWORD_REQUIREMENTS}</p>;
}

type PasswordUrgency = 'safe' | 'warning' | 'expired';

function passwordUrgency(user: User): PasswordUrgency {
  const days = user.passwordDaysUsed ?? 0;
  const max = user.passwordMaxAgeDays ?? PASSWORD_MAX_AGE_DAYS;
  if (user.passwordExpired || days >= max) return 'expired';
  if (days >= max - 30) return 'warning';
  return 'safe';
}

function passwordAgeLabel(user: User): { text: string; urgency: PasswordUrgency } {
  const days = user.passwordDaysUsed ?? 0;
  const max = user.passwordMaxAgeDays ?? PASSWORD_MAX_AGE_DAYS;
  const urgency = passwordUrgency(user);
  if (urgency === 'expired') {
    return { text: `${days} / ${max} days (expired)`, urgency };
  }
  return { text: `${days} / ${max} days`, urgency };
}

const URGENCY_STYLES: Record<PasswordUrgency, string> = {
  safe: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  expired: 'bg-red-100 text-red-800 border-red-200',
};

function PasswordAgeBadge({ user }: { user: User }) {
  const age = passwordAgeLabel(user);
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${URGENCY_STYLES[age.urgency]}`}
    >
      {age.text}
    </span>
  );
}

export function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [createForm, setCreateForm] = useState<UserForm>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<UserForm>(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.username.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter]);

  const roleCounts = useMemo(() => {
    let admin = 0;
    let worker = 0;
    let po = 0;
    for (const u of users) {
      if (u.role === 'admin') admin += 1;
      else if (u.role === 'worker') worker += 1;
      else if (u.role === 'po') po += 1;
    }
    return { all: users.length, admin, worker, po };
  }, [users]);

  async function load() {
    const data = await api<{ users: User[] }>('/api/users');
    setUsers(data.users);
  }

  useEffect(() => {
    load().catch((err: Error) => toast.error(err.message));
  }, []);

  function openEdit(user: User) {
    setEditUser(user);
    setEditForm({ username: user.username, password: '', confirmPassword: '', role: user.role });
  }

  function passwordsMatch(password: string, confirmPassword: string): boolean {
    return password === confirmPassword;
  }

  async function createUser(e: FormEvent) {
    e.preventDefault();
    const passwordError = validatePassword(createForm.password);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }
    if (!passwordsMatch(createForm.password, createForm.confirmPassword)) {
      toast.error('Passwords do not match');
      return;
    }
    try {
      await api('/api/users', { method: 'POST', body: createForm });
      toast.success('Account created');
      setCreateOpen(false);
      setCreateForm(EMPTY_FORM);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed');
    }
  }

  async function updateUser(e: FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    if (editForm.password) {
      const passwordError = validatePassword(editForm.password);
      if (passwordError) {
        toast.error(passwordError);
        return;
      }
      if (!passwordsMatch(editForm.password, editForm.confirmPassword)) {
        toast.error('Passwords do not match');
        return;
      }
    } else if (editForm.confirmPassword) {
      toast.error('Please enter the new password in both fields');
      return;
    }
    try {
      const body: { username: string; role: UserRole; password?: string } = {
        username: editForm.username,
        role: editForm.role,
      };
      if (editForm.password) body.password = editForm.password;
      await api(`/api/users/${editUser._id}`, { method: 'PATCH', body });
      toast.success('User updated');
      setEditUser(null);
      setEditForm(EMPTY_FORM);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed');
    }
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold">User Management</h1>
          <p className="text-slate-500 mt-1">
            Admins can create and edit accounts. Passwords must be changed every {PASSWORD_MAX_AGE_DAYS}{' '}
            days.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-amber-500 px-4 py-2.5 font-semibold text-slate-950 shrink-0"
        >
          Create user
        </button>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
        <div className="relative flex-1 min-w-0 sm:min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            className="w-full rounded-lg border bg-white pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            placeholder="Search username or role…"
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
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'admin', label: 'Admin' },
              { id: 'worker', label: 'Worker' },
              { id: 'po', label: 'PO' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRoleFilter(tab.id)}
              className={`rounded-lg px-3 py-2 text-xs font-medium capitalize transition ${
                roleFilter === tab.id
                  ? tab.id === 'all'
                    ? 'bg-slate-800 text-white'
                    : tab.id === 'admin'
                      ? 'bg-emerald-600 text-white'
                      : tab.id === 'worker'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-200 text-slate-700'
                  : 'bg-white border text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 opacity-80">{roleCounts[tab.id]}</span>
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-400 sm:ml-auto shrink-0">
          {rows.length} / {users.length} users
        </div>
      </div>

      <div className="mt-3 bg-white rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Username</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                    {users.length === 0
                      ? 'No users yet.'
                      : 'No users match your search or filter.'}
                  </td>
                </tr>
              )}
              {rows.map((u) => (
                <tr key={u._id} className="border-t">
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{u.username}</td>
                  <td className="px-4 py-3 uppercase text-xs tracking-wide whitespace-nowrap">
                    {u.role}
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {formatDateTime(u.createdAt)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <PasswordAgeBadge user={u} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && (
        <Modal title="Create user" onClose={() => setCreateOpen(false)}>
          <form className="space-y-3" onSubmit={createUser}>
            <label className="block text-sm">
              Username
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                required
              />
            </label>
            <label className="block text-sm">
              Password
              <input
                type="password"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                required
                minLength={8}
              />
              <PasswordHint />
            </label>
            <label className="block text-sm">
              Confirm password
              <input
                type="password"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={createForm.confirmPassword}
                onChange={(e) => setCreateForm({ ...createForm, confirmPassword: e.target.value })}
                required
                minLength={8}
              />
            </label>
            <label className="block text-sm">
              Role
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
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

      {editUser && (
        <Modal title={`Edit user — ${editUser.username}`} onClose={() => setEditUser(null)}>
          <form className="space-y-3" onSubmit={updateUser}>
            <label className="block text-sm">
              Username
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                required
              />
            </label>
            <label className="block text-sm">
              New password
              <input
                type="password"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                placeholder="Leave blank to keep current password"
                minLength={8}
              />
              <PasswordHint />
            </label>
            <label className="block text-sm">
              Confirm new password
              <input
                type="password"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={editForm.confirmPassword}
                onChange={(e) => setEditForm({ ...editForm, confirmPassword: e.target.value })}
                placeholder="Re-enter new password"
                minLength={8}
              />
            </label>
            <label className="block text-sm">
              Role
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
              >
                <option value="worker">worker — packing</option>
                <option value="po">po — create purchase orders</option>
                <option value="admin">admin</option>
              </select>
            </label>
            <div className="rounded-lg bg-slate-50 border px-3 py-2 text-sm text-slate-600 flex items-center justify-between gap-2">
              <span>Current password age:</span>
              <PasswordAgeBadge user={editUser} />
            </div>
            <button className="rounded-lg bg-slate-950 text-white px-4 py-2">Save changes</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
