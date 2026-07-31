import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import CountUp from '../components/CountUp.jsx';

const baht = (n) => Number(n).toFixed(2) + ' ฿';
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const dateTimeOf = (ts) =>
  new Date(ts).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

const MODES = [
  { key: 'day', label: 'รายวัน' },
  { key: 'month', label: 'รายเดือน' },
  { key: 'year', label: 'รายปี' },
];

const PREV_LABEL = { day: 'จากเมื่อวาน', month: 'จากเดือนที่แล้ว', year: 'จากปีที่แล้ว' };

const ORDERS_PREVIEW = 20; // แสดงเท่านี้ก่อน แล้วค่อยกด "ดูทั้งหมด"
const MENU_PREVIEW = 10;

const inputClass =
  'rounded-lg border border-line bg-paper px-3 py-1.5 text-sm tabular-nums text-ink outline-none focus:border-ink';

// วันอ้างอิงของช่วงก่อนหน้า ใช้ยิง /sales ซ้ำเพื่อเทียบยอด
// (mode month/year ส่ง refDate เป็นวันที่ 1 เสมอ จึงไม่เจอปัญหาเดือนสั้น-ยาว)
const prevRefOf = (mode, ref) => {
  const d = new Date(ref);
  if (mode === 'day') d.setDate(d.getDate() - 1);
  else if (mode === 'month') d.setMonth(d.getMonth() - 1);
  else d.setFullYear(d.getFullYear() - 1);
  return ymd(d);
};

const Dashboard = () => {
  const { show } = useToast();
  const now = new Date();
  const today = ymd(now);
  const thisMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;

  const [mode, setMode] = useState('day'); // default: รายวัน
  // ค่าเริ่มต้น = วัน/เดือน/ปี ปัจจุบัน
  const [day, setDay] = useState(today);
  const [month, setMonth] = useState(thisMonth);
  const [year, setYear] = useState(now.getFullYear());
  const [summary, setSummary] = useState(null); // ภาพรวมวันนี้/เดือนนี้/ปีนี้
  const [data, setData] = useState(null); // ช่วงที่เลือก
  const [prev, setPrev] = useState(null); // ช่วงก่อนหน้า ใช้เทียบ
  const [showAllMenu, setShowAllMenu] = useState(false);
  const [showAllOrders, setShowAllOrders] = useState(false);

  // แปลงค่าที่เลือกเป็นวันอ้างอิง YYYY-MM-DD ส่งให้ backend
  const refDate = useMemo(() => {
    if (mode === 'day') return day;
    if (mode === 'month') return `${month}-01`;
    return `${year}-01-01`;
  }, [mode, day, month, year]);

  useEffect(() => {
    api.getReport().then(setSummary).catch((e) => show(e.message, 'error'));
  }, [show]);

  // โหลดช่วงที่เลือก + ช่วงก่อนหน้าพร้อมกัน (alive กันคำตอบเก่ามาทับตอนสลับเร็วๆ)
  useEffect(() => {
    let alive = true;
    setData(null);
    setPrev(null);
    setShowAllMenu(false);
    setShowAllOrders(false);

    Promise.all([api.getSales(mode, refDate), api.getSales(mode, prevRefOf(mode, refDate))])
      .then(([cur, before]) => {
        if (!alive) return;
        setData(cur);
        setPrev(before);
      })
      .catch((e) => alive && show(e.message, 'error'));

    return () => {
      alive = false;
    };
  }, [mode, refDate, show]);

  // ข้อความสรุปช่วงเวลาที่กำลังดู
  const periodLabel = useMemo(() => {
    if (mode === 'day') return new Date(refDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
    if (mode === 'month') return new Date(refDate).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    return `ปี ${year}`;
  }, [mode, refDate, year]);

  // เทียบกับช่วงก่อนหน้า — null = ยังโหลดไม่เสร็จ, kind 'new' = ช่วงก่อนไม่มียอดให้เทียบ
  const delta = useMemo(() => {
    if (!data || !prev) return null;
    if (prev.total === 0) return { kind: 'new' };
    const pct = ((data.total - prev.total) / prev.total) * 100;
    return { kind: pct >= 0 ? 'up' : 'down', pct: Math.abs(pct), before: prev.total };
  }, [data, prev]);

  const avg = data && data.count > 0 ? data.total / data.count : 0;
  const maxMenuTotal = data?.breakdown?.[0]?.total || 0; // breakdown เรียงจากมากไปน้อยมาแล้ว
  const menuRows = data ? (showAllMenu ? data.breakdown : data.breakdown.slice(0, MENU_PREVIEW)) : [];
  const orderRows = data ? (showAllOrders ? data.orders : data.orders.slice(0, ORDERS_PREVIEW)) : [];

  // กดการ์ดภาพรวม → กระโดดไปดูช่วงนั้นของปัจจุบัน
  const jumpTo = (key) => {
    setDay(today);
    setMonth(thisMonth);
    setYear(now.getFullYear());
    setMode(key);
  };

  const cards = [
    { key: 'day', label: 'วันนี้', value: summary?.today },
    { key: 'month', label: 'เดือนนี้', value: summary?.month },
    { key: 'year', label: 'ปีนี้', value: summary?.year },
  ];

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold text-ink">ยอดขาย</h1>

      {/* ภาพรวมปัจจุบัน — กดเพื่อกระโดดไปดูช่วงนั้น */}
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <button
            key={c.key}
            onClick={() => jumpTo(c.key)}
            className="card p-4 text-left transition-transform duration-100 active:scale-[0.98]"
          >
            <div className="text-sm text-muted">{c.label}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-ink">
              {summary ? <CountUp value={c.value} /> : '—'} <span className="text-base">฿</span>
            </div>
            <span className={`mt-3 block h-0.5 w-12 ${mode === c.key ? 'bg-amber' : 'bg-line'}`} />
          </button>
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-lg font-bold text-ink">เจาะดูตามช่วงเวลา</h2>

      {/* เลือกช่วงเวลา + ตัวเลือกวัน/เดือน/ปี */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                mode === m.key ? 'bg-surface font-semibold text-ink' : 'font-medium text-muted hover:text-ink'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === 'day' && (
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={inputClass} />
        )}
        {mode === 'month' && (
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={inputClass} />
        )}
        {mode === 'year' && (
          <input
            type="number"
            min="2020"
            max="2100"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className={`w-28 ${inputClass}`}
          />
        )}
      </div>

      {/* ยอดรวมของช่วงที่เลือก + เทียบช่วงก่อนหน้า */}
      <div className="card p-6">
        <div className="text-sm text-muted">ยอดขาย · {periodLabel}</div>
        <div className="mt-1 text-4xl font-bold tabular-nums text-ink">
          {data ? <CountUp value={data.total} /> : '0.00'} <span className="text-2xl">฿</span>
        </div>

        <div className="mt-2 min-h-5 text-sm">
          {delta?.kind === 'up' && (
            <span className="text-matcha">
              ▲ {delta.pct.toFixed(1)}% {PREV_LABEL[mode]} ({baht(delta.before)})
            </span>
          )}
          {delta?.kind === 'down' && (
            <span className="text-coral">
              ▼ {delta.pct.toFixed(1)}% {PREV_LABEL[mode]} ({baht(delta.before)})
            </span>
          )}
          {delta?.kind === 'new' && <span className="text-muted">ช่วงก่อนหน้าไม่มียอดขายให้เทียบ</span>}
        </div>

        <div className="mt-4 flex gap-8 border-t border-line pt-4">
          <div>
            <div className="text-xs text-muted">จำนวนออเดอร์</div>
            <div className="text-lg tabular-nums text-ink">{data ? data.count : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-muted">เฉลี่ยต่อออเดอร์</div>
            <div className="text-lg tabular-nums text-ink">{data ? baht(avg) : '—'}</div>
          </div>
        </div>
      </div>

      {/* สรุปว่าขายอะไรไปบ้างในช่วงนี้ (รายเมนู) + แถบเทียบสัดส่วน */}
      <div className="mb-2 mt-8 flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-ink">ขายอะไรไปบ้าง</h2>
        {data && data.breakdown.length > 0 && (
          <span className="text-xs text-muted">{data.breakdown.length} เมนู</span>
        )}
      </div>
      <div className="card p-2">
        <div className="divide-y divide-line">
          {!data || data.breakdown.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">ยังไม่มียอดขายในช่วงเวลานี้</p>
          ) : (
            menuRows.map((b) => (
              <div key={b.name} className="px-2 py-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex-1 text-ink">{b.name}</span>
                  <span className="w-16 text-right tabular-nums text-muted">×{b.qty}</span>
                  <span className="w-24 text-right tabular-nums text-ink">{baht(b.total)}</span>
                </div>
                <div className="mt-1.5 h-1 rounded-full bg-surface">
                  <div
                    className="h-1 rounded-full bg-amber"
                    style={{ width: maxMenuTotal ? `${(b.total / maxMenuTotal) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
        {data && data.breakdown.length > MENU_PREVIEW && !showAllMenu && (
          <button
            onClick={() => setShowAllMenu(true)}
            className="w-full py-2.5 text-sm text-muted transition-colors hover:text-ink"
          >
            ดูทั้งหมด {data.breakdown.length} เมนู
          </button>
        )}
      </div>

      {/* รายการออเดอร์ในช่วงที่เลือก (พร้อมรายการสินค้า) */}
      <div className="mb-2 mt-8 flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-ink">รายการออเดอร์</h2>
        {data && data.orders.length > 0 && <span className="text-xs text-muted">{data.count} ออเดอร์</span>}
      </div>
      <div className="space-y-2">
        {!data || data.orders.length === 0 ? (
          <div className="card p-2">
            <p className="py-8 text-center text-sm text-muted">ไม่มีออเดอร์ที่เสร็จแล้วในช่วงเวลานี้</p>
          </div>
        ) : (
          orderRows.map((r) => (
            <div key={r.id} className="card p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="tabular-nums text-muted">{r.code}</span>
                <span className="text-muted">{dateTimeOf(r.completed_at)}</span>
                <span className="font-bold tabular-nums text-ink">{baht(r.total)}</span>
              </div>
              <ul className="mt-2 space-y-1 border-t border-line pt-2">
                {r.items.map((it, idx) => (
                  <li key={idx} className="flex justify-between text-xs text-muted">
                    <span>
                      <span className="tabular-nums">{it.qty}×</span> {it.name}
                    </span>
                    <span className="tabular-nums">{baht(it.price * it.qty)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
        {data && data.orders.length > ORDERS_PREVIEW && !showAllOrders && (
          <button
            onClick={() => setShowAllOrders(true)}
            className="card w-full py-3 text-sm text-muted transition-colors hover:text-ink"
          >
            ดูทั้งหมด {data.orders.length} ออเดอร์
          </button>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
