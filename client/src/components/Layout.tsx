import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import type { NavLinkRenderProps } from 'react-router-dom';
import {
  ClipboardList,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  Tag,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const linkClass = ({ isActive }: NavLinkRenderProps) =>
  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
  }`;

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function closeDrawer() {
    setOpen(false);
  }

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={closeDrawer}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-950 text-white flex flex-col transition-transform duration-200 ease-out md:static md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 py-6 border-b border-slate-800 flex items-start justify-between gap-2">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-amber-400">CoreTech</div>
            <div className="mt-1 text-lg font-semibold">Warehouse Packing</div>
          </div>
          <button
            type="button"
            className="md:hidden rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
            aria-label="Close menu"
            onClick={closeDrawer}
          >
            <X size={20} />
          </button>
        </div>
        <nav className="p-3 flex-1 space-y-1">
          {(user?.role === 'admin' || user?.role === 'worker') && (
            <NavLink to="/" end className={linkClass} onClick={closeDrawer}>
              <LayoutDashboard size={16} /> SOW Dashboard
            </NavLink>
          )}
          {(user?.role === 'admin' || user?.role === 'po') && (
            <NavLink to="/pos" className={linkClass} onClick={closeDrawer}>
              <FileText size={16} /> Purchase Orders
            </NavLink>
          )}
          {(user?.role === 'admin' || user?.role === 'po') && (
            <NavLink to="/admin/product-names" className={linkClass} onClick={closeDrawer}>
              <Tag size={16} /> SKU / Product Names
            </NavLink>
          )}
          {user?.role === 'admin' && (
            <>
              <NavLink to="/admin/users" className={linkClass} onClick={closeDrawer}>
                <Users size={16} /> User Management
              </NavLink>
              <NavLink to="/admin/history" className={linkClass} onClick={closeDrawer}>
                <ClipboardList size={16} /> Packing History
              </NavLink>
              <NavLink to="/admin/logs" className={linkClass} onClick={closeDrawer}>
                <History size={16} /> Audit Logs
              </NavLink>
            </>
          )}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-2 text-sm">
            <Shield size={16} className="text-amber-400" />
            <div>
              <div className="font-medium">{user?.username}</div>
              <div className="text-xs uppercase tracking-wide text-slate-400">{user?.role}</div>
            </div>
          </div>
          <button
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
            onClick={() => {
              closeDrawer();
              logout();
              navigate('/login');
            }}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="md:hidden sticky top-0 z-20 flex items-center gap-3 border-b bg-white px-3 py-2.5">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu size={22} />
          </button>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-amber-600">CoreTech</div>
            <div className="text-sm font-semibold text-slate-900 truncate">Warehouse Packing</div>
          </div>
        </header>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
