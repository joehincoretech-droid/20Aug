import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { Layout } from './components/Layout.jsx';
import { Login } from './pages/Login.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Packing } from './pages/Packing.jsx';
import { Users } from './pages/Users.jsx';
import { Logs } from './pages/Logs.jsx';
import { History } from './pages/History.jsx';
import { ProductNames } from './pages/ProductNames.jsx';
import { PurchaseOrders } from './pages/PurchaseOrders.jsx';

function Guard({ children, roles }) {
  const { user, ready } = useAuth();
  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center text-slate-500">Loading…</div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  // Admin has full access to every page.
  if (roles && user.role !== 'admin' && !roles.includes(user.role)) {
    return <Navigate to={user.role === 'po' ? '/pos' : '/'} replace />;
  }
  return children;
}

function HomeRedirect() {
  const { user } = useAuth();
  if (user?.role === 'po') return <Navigate to="/pos" replace />;
  return <Dashboard />;
}

export default function App() {
  const { user, ready } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={ready && user ? <Navigate to={user.role === 'po' ? '/pos' : '/'} replace /> : <Login />}
      />
      <Route
        element={
          <Guard>
            <Layout />
          </Guard>
        }
      >
        <Route path="/" element={<HomeRedirect />} />
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
            <Guard roles={['admin']}>
              <ProductNames />
            </Guard>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
