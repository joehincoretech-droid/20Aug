import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import type { NavLinkRenderProps } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  History,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  Shield,
  Tag,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const SIDEBAR_STORAGE_KEY = 'sidebar-collapsed';

function navLinkClass({ isActive }: NavLinkRenderProps, collapsed: boolean) {
  return `flex items-center rounded-lg text-sm font-medium transition gap-2 px-3 py-2 ${
    collapsed ? 'md:justify-center md:gap-0 md:px-2 md:py-2.5' : ''
  } ${
    isActive ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
  }`;
}

function NavItem({
  to,
  end,
  icon: Icon,
  label,
  collapsed,
  onClick,
}: {
  to: string;
  end?: boolean;
  icon: LucideIcon;
  label: string;
  collapsed: boolean;
  onClick?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={(props) => navLinkClass(props, collapsed)}
      onClick={onClick}
    >
      <Icon size={16} className="shrink-0" />
      <span className={collapsed ? 'md:hidden' : ''}>{label}</span>
    </NavLink>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
  );

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  function closeDrawer() {
    setMobileOpen(false);
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={closeDrawer}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-950 text-white transition-[width,transform] duration-200 ease-out md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'md:w-16' : 'md:w-64'}`}
      >
        <div
          className={`flex items-start justify-between gap-2 border-b border-slate-800 ${
            collapsed ? 'px-5 py-6 md:flex-col md:items-center md:px-2 md:py-4' : 'px-5 py-6'
          }`}
        >
          <div className={collapsed ? 'md:text-center' : ''}>
            <div className={collapsed ? 'md:hidden' : ''}>
              <div className="text-xs uppercase tracking-[0.2em] text-amber-400">CoreTech</div>
              <div className="mt-1 text-lg font-semibold">Warehouse Packing</div>
            </div>
            <div
              className={`hidden h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-xs font-bold text-amber-400 ${
                collapsed ? 'md:flex' : ''
              }`}
              title="CoreTech Warehouse Packing"
            >
              CT
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white md:hidden"
            aria-label="Close menu"
            onClick={closeDrawer}
          >
            <X size={20} />
          </button>
          <button
            type="button"
            className="hidden rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white md:inline-flex"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className={`flex-1 space-y-1 overflow-y-auto p-3 ${collapsed ? 'md:p-2' : ''}`}>
          <NavItem to="/" end icon={LayoutDashboard} label="Dashboard" collapsed={collapsed} onClick={closeDrawer} />
          {(user?.role === 'admin' || user?.role === 'worker') && (
            <NavItem to="/sow" icon={Layers} label="SOW" collapsed={collapsed} onClick={closeDrawer} />
          )}
          {(user?.role === 'admin' || user?.role === 'po') && (
            <>
              <NavItem
                to="/pos"
                icon={FileText}
                label="Purchase Orders"
                collapsed={collapsed}
                onClick={closeDrawer}
              />
              <NavItem
                to="/admin/product-names"
                icon={Tag}
                label="SKU / Product Names"
                collapsed={collapsed}
                onClick={closeDrawer}
              />
            </>
          )}
          {user?.role === 'admin' && (
            <>
              <NavItem
                to="/admin/users"
                icon={Users}
                label="User Management"
                collapsed={collapsed}
                onClick={closeDrawer}
              />
              <NavItem
                to="/admin/history"
                icon={ClipboardList}
                label="Packing History"
                collapsed={collapsed}
                onClick={closeDrawer}
              />
              <NavItem
                to="/admin/logs"
                icon={History}
                label="Audit Logs"
                collapsed={collapsed}
                onClick={closeDrawer}
              />
            </>
          )}
        </nav>

        <div className={`border-t border-slate-800 p-4 ${collapsed ? 'md:p-2' : ''}`}>
          <div className={collapsed ? 'md:hidden' : ''}>
            <div className="flex items-center gap-2 text-sm">
              <Shield size={16} className="shrink-0 text-amber-400" />
              <div className="min-w-0">
                <div className="truncate font-medium">{user?.username}</div>
                <div className="text-xs uppercase tracking-wide text-slate-400">{user?.role}</div>
              </div>
            </div>
            <button
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
              onClick={() => {
                closeDrawer();
                logout();
                navigate('/login');
              }}
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
          <div
            className={`hidden flex-col items-center gap-2 ${collapsed ? 'md:flex' : ''}`}
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800"
              title={`${user?.username ?? 'User'} (${user?.role ?? ''})`}
            >
              <Shield size={16} className="text-amber-400" />
            </div>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700"
              title="Sign out"
              onClick={() => {
                closeDrawer();
                logout();
                navigate('/login');
              }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      <div
        className={`flex min-h-screen min-w-0 flex-col transition-[margin] duration-200 ease-out ${
          collapsed ? 'md:ml-16' : 'md:ml-64'
        }`}
      >
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-white px-3 py-2.5 md:hidden">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={22} />
          </button>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-amber-600">CoreTech</div>
            <div className="truncate text-sm font-semibold text-slate-900">Warehouse Packing</div>
          </div>
        </header>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
