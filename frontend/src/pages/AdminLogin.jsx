import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';

const AdminLogin = () => {
  const { login, isAdmin, sessionExpired } = useAuth();
  const { show } = useToast();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // เข้าระบบอยู่แล้ว → ไปหน้าออเดอร์ (ห้ามเรียก navigate() ระหว่าง render)
  if (isAdmin) return <Navigate to="/admin/order" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.login(username, password);
      login(res.token, res.username);
      navigate('/admin/order', { replace: true });
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-6">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-ink text-paper">☕</div>
        <h1 className="mb-1 text-lg font-bold text-ink">เข้าสู่ระบบผู้ดูแล</h1>
        <p className="mb-5 text-sm text-muted">สำหรับเจ้าของร้าน/ผู้จัดการเท่านั้น</p>

        {sessionExpired && (
          <div className="mb-5 rounded-lg border border-coral/25 bg-coral/10 px-3 py-2 text-sm text-coral">
            เซสชันหมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่
          </div>
        )}

        <label className="mb-1 block text-sm text-muted">ชื่อผู้ใช้</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mb-4 w-full rounded-lg border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-ink"
          autoFocus
        />

        <label className="mb-1 block text-sm text-muted">รหัสผ่าน</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-6 w-full rounded-lg border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-ink"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-amber py-2.5 font-medium text-ink transition-transform duration-100 active:scale-95 disabled:opacity-40"
        >
          {loading ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </div>
  );
};

export default AdminLogin;
