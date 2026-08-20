import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ClipboardList, FileText, History, LayoutDashboard, LogOut, Shield, Tag, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const linkClass = ({ isActive }) =>
  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
  }`;

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <aside className="w-64 bg-slate-950 text-white flex flex-col">
        <div className="px-5 py-6 border-b border-slate-800">
          <div className="text-xs uppercase tracking-[0.2em] text-amber-400">CoreTech</div>
          <div className="mt-1 text-lg font-semibold">Warehouse Packing</div>
        </div>
        <nav className="p-3 flex-1 space-y-1">
          {(user?.role === 'admin' || user?.role === 'worker') && (
            <NavLink to="/" end className={linkClass}>
              <LayoutDashboard size={16} /> Dashboard
            </NavLink>
          )}
          {(user?.role === 'admin' || user?.role === 'po') && (
            <NavLink to="/pos" className={linkClass}>
              <FileText size={16} /> Purchase Orders
            </NavLink>
          )}
          {user?.role === 'admin' && (
            <>
              <NavLink to="/admin/users" className={linkClass}>
                <Users size={16} /> User Management
              </NavLink>
              <NavLink to="/admin/product-names" className={linkClass}>
                <Tag size={16} /> SKU / Product Names
              </NavLink>
              <NavLink to="/admin/history" className={linkClass}>
                <ClipboardList size={16} /> Packing History
              </NavLink>
              <NavLink to="/admin/logs" className={linkClass}>
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
              logout();
              navigate('/login');
            }}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
