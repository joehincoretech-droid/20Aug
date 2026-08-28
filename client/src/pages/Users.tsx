import { useEffect, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api';
import { Modal } from '../components/Modal';
import type { User, UserRole } from '../types';
import {
  PASSWORD_MAX_AGE_DAYS,
  PASSWORD_REQUIREMENTS,
  validatePassword,
} from '../utils/password';

type UserForm = { username: string; password: string; confirmPassword: string; role: UserRole };

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
      <div className="mt-6 bg-white rounded-2xl border overflow-hidden">
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
              {users.map((u) => (
                <tr key={u._id} className="border-t">
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{u.username}</td>
                  <td className="px-4 py-3 uppercase text-xs tracking-wide whitespace-nowrap">
                    {u.role}
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {u.createdAt ? new Date(u.createdAt).toLocaleString() : '—'}
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
