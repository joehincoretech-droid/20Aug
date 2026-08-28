import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { SOW } from './pages/SOW';
import { Packing } from './pages/Packing';
import { Users } from './pages/Users';
import { Logs } from './pages/Logs';
import { History } from './pages/History';
import { ProductNames } from './pages/ProductNames';
import { PurchaseOrders } from './pages/PurchaseOrders';
import type { UserRole } from './types';

function Guard({ children, roles }: { children: ReactNode; roles?: UserRole[] }) {
  const { user, ready } = useAuth();
  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center text-slate-500">Loading…</div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  // Admin has full access to every page.
  if (roles && user.role !== 'admin' && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  const { user, ready } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={ready && user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        element={
          <Guard>
            <Layout />
          </Guard>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route
          path="/sow"
          element={
            <Guard roles={['admin', 'worker']}>
              <SOW />
            </Guard>
          }
        />
        <Route
          path="/pack/:sowId"
          element={
            <Guard roles={['admin', 'worker']}>
              <Packing />
            </Guard>
          }
        />
        <Route
          path="/pos"
          element={
            <Guard roles={['admin', 'po']}>
              <PurchaseOrders />
            </Guard>
          }
        />
        <Route
          path="/admin/users"
          element={
            <Guard roles={['admin']}>
              <Users />
            </Guard>
          }
        />
        <Route
          path="/admin/logs"
          element={
            <Guard roles={['admin']}>
              <Logs />
            </Guard>
          }
        />
        <Route
          path="/admin/history"
          element={
            <Guard roles={['admin']}>
              <History />
            </Guard>
          }
        />
        <Route
          path="/admin/product-names"
          element={
            <Guard roles={['admin', 'po']}>
              <ProductNames />
            </Guard>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
