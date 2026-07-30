import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { usePending } from '../context/PendingContext.jsx';

// แถบเมนู admin — responsive: จอใหญ่เป็นแถว, จอเล็กยุบเป็นแฮมเบอร์เกอร์
const Navbar = () => {
  const { username, logout } = useAuth();
  const { count: pending } = usePending();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const links = [
    { to: '/admin/order', label: 'เมนู' },
    { to: '/admin/orders', label: 'ออเดอร์', badge: pending },
    { to: '/admin/menu', label: 'จัดการเมนู' },
    { to: '/admin/dashboard', label: 'ยอดขาย' },
  ];

  const linkClass = ({ isActive }) =>
    `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
      isActive ? 'bg-marigold text-grounds' : 'text-foam/80 hover:text-foam'
    }`;

  const renderLink = (l) => (
    <NavLink key={l.to} to={l.to} className={linkClass} onClick={() => setOpen(false)}>
      <span className="inline-flex items-center gap-1.5">
        {l.label}
        {l.badge > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-cherry px-1 font-mono text-[11px] leading-none text-paper">
            {l.badge}
          </span>
        )}
      </span>
    </NavLink>
  );

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate('/admin');
  };

  return (
    <header className="bg-grounds text-foam">
      <nav className="mx-auto max-w-6xl px-4">
        <div className="flex items-center gap-2 py-3">
          <span className="mr-2 font-display text-lg">Coffee POS</span>

          {/* จอใหญ่: ลิงก์เป็นแถว */}
          <div className="hidden items-center gap-2 md:flex">{links.map(renderLink)}</div>
          <div className="ml-auto hidden items-center gap-3 md:flex">
            <span className="text-sm text-foam/60">{username}</span>
            <button onClick={handleLogout} className="text-sm text-cherry hover:underline">
              ออกจากระบบ
            </button>
          </div>

          {/* จอเล็ก: ปุ่มแฮมเบอร์เกอร์ + badge รวมบนปุ่ม */}
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="เปิด/ปิดเมนู"
            className="relative ml-auto rounded p-1.5 text-2xl leading-none text-foam md:hidden"
          >
            {open ? '✕' : '☰'}
            {!open && pending > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-cherry px-1 font-mono text-[11px] leading-none text-paper">
                {pending}
              </span>
            )}
          </button>
        </div>

        {/* จอเล็ก: แผงเมนูที่กางลงมา */}
        {open && (
          <div className="flex flex-col gap-1 pb-3 md:hidden">
            {links.map(renderLink)}
            <div className="mt-2 flex items-center justify-between border-t border-foam/15 pt-3">
              <span className="text-sm text-foam/60">{username}</span>
              <button onClick={handleLogout} className="text-sm text-cherry hover:underline">
                ออกจากระบบ
              </button>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Navbar;
