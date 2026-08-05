import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { usePending } from '../context/PendingContext.jsx';

const IconLogout = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
    <path
      d="M15 17l5-5-5-5M20 12H9M12 3H6a1 1 0 00-1 1v16a1 1 0 001 1h6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// แถบเมนู admin — responsive: จอใหญ่เป็นแถว, จอเล็กยุบเป็นแฮมเบอร์เกอร์
const Navbar = () => {
  const { logout } = useAuth();
  const { count: pending } = usePending();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const links = [
    { to: '/admin/order', label: 'เมนู' },
    { to: '/admin/orders', label: 'ออเดอร์', badge: pending },
    { to: '/admin/menu', label: 'จัดการเมนู' },
    { to: '/admin/costs', label: 'ต้นทุน' },
    { to: '/admin/dashboard', label: 'ยอดขาย' },
    { to: '/admin/profit', label: 'กำไร' },
  ];

  const linkClass = ({ isActive }) =>
    `px-3 py-1.5 rounded-lg text-sm transition-colors ${
      isActive ? 'bg-surface font-semibold text-ink' : 'font-medium text-muted hover:text-ink'
    }`;

  const renderLink = (l) => (
    <NavLink key={l.to} to={l.to} className={linkClass} onClick={() => setOpen(false)}>
      <span className="inline-flex items-center gap-1.5">
        {l.label}
        {l.badge > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1 text-[11px] leading-none tabular-nums text-paper">
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

  const logoutButton = (extra = '') => (
    <button
      onClick={handleLogout}
      aria-label="ออกจากระบบ"
      title="ออกจากระบบ"
      className={`rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-coral ${extra}`}
    >
      <IconLogout />
    </button>
  );

  return (
    <header className="border-b border-line bg-paper">
      <nav className="mx-auto max-w-6xl px-4">
        <div className="flex items-center gap-2 py-3">
          <span className="mr-2 font-bold text-ink">Coffee POS</span>

          {/* จอใหญ่: ลิงก์เป็นแถว */}
          <div className="hidden items-center gap-1 md:flex">{links.map(renderLink)}</div>
          <div className="ml-auto hidden md:flex">{logoutButton()}</div>

          {/* จอเล็ก: ปุ่มแฮมเบอร์เกอร์ + badge รวมบนปุ่ม */}
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="เปิด/ปิดเมนู"
            className="relative ml-auto rounded-lg p-1.5 text-2xl leading-none text-ink md:hidden"
          >
            {open ? '✕' : '☰'}
            {!open && pending > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1 text-[11px] leading-none tabular-nums text-paper">
                {pending}
              </span>
            )}
          </button>
        </div>

        {/* จอเล็ก: แผงเมนูที่กางลงมา */}
        {open && (
          <div className="flex flex-col gap-1 pb-3 md:hidden">
            {links.map(renderLink)}
            <div className="mt-2 flex justify-end border-t border-line pt-3">{logoutButton()}</div>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Navbar;
