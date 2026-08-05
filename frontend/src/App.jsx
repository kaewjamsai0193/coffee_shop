import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { PendingProvider } from './context/PendingContext.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { ConfirmProvider } from './components/Confirm.jsx';
import Navbar from './components/Navbar.jsx';
import Order from './pages/Order.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import MenuManage from './pages/MenuManage.jsx';
import Orders from './pages/Orders.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Costs from './pages/Costs.jsx';
import Profit from './pages/Profit.jsx';

// guard: ไม่มี token → เด้งไปหน้า login admin
const ProtectedLayout = () => {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/admin" replace />;
  return (
    <PendingProvider>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </PendingProvider>
  );
};

const App = () => (
  <ToastProvider>
    <ConfirmProvider>
    <Routes>
      {/* public — หน้าสั่งสินค้า */}
      <Route path="/" element={<Order />} />

      {/* ทางลับ admin */}
      <Route path="/admin" element={<AdminLogin />} />

      {/* admin เท่านั้น */}
      <Route element={<ProtectedLayout />}>
        <Route path="/admin/order" element={<Order embedded />} />
        <Route path="/admin/orders" element={<Orders />} />
        <Route path="/admin/menu" element={<MenuManage />} />
        <Route path="/admin/dashboard" element={<Dashboard />} />
        <Route path="/admin/costs" element={<Costs />} />
        {/* ที่อยู่เดิมของหน้าซื้อวัตถุดิบ — ตอนนี้เป็นแท็บหนึ่งในหน้าต้นทุน กัน bookmark เก่าเสีย */}
        <Route path="/admin/purchases" element={<Navigate to="/admin/costs" replace />} />
        <Route path="/admin/profit" element={<Profit />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </ConfirmProvider>
  </ToastProvider>
);

export default App;
