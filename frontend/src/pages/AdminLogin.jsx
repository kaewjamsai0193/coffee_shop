import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

  // เข้าระบบอยู่แล้ว → ไปหน้าออเดอร์
  if (isAdmin) {
    navigate('/admin/order', { replace: true });
    return null;
  }

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
    <div className="flex min-h-screen items-center justify-center bg-foam px-4">
      <form onSubmit={submit} className="ticket w-full max-w-sm p-6">
        <h1 className="mb-1 font-display text-2xl text-grounds">เข้าสู่ระบบผู้ดูแล</h1>
        <p className="mb-5 text-sm text-grounds/50">สำหรับเจ้าของร้าน/ผู้จัดการเท่านั้น</p>

        {sessionExpired && (
          <div className="mb-5 rounded border border-cherry/25 bg-cherry/10 px-3 py-2 text-sm text-cherry">
            เซสชันหมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่
          </div>
        )}

        <label className="mb-1 block text-sm text-grounds/70">ชื่อผู้ใช้</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mb-4 w-full rounded border border-grounds/15 bg-foam px-3 py-2 outline-none focus:border-marigold"
          autoFocus
        />

        <label className="mb-1 block text-sm text-grounds/70">รหัสผ่าน</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-6 w-full rounded border border-grounds/15 bg-foam px-3 py-2 outline-none focus:border-marigold"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-marigold py-2.5 font-medium text-grounds transition-transform duration-100 active:scale-95 disabled:opacity-40"
        >
          {loading ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </div>
  );
};

export default AdminLogin;
