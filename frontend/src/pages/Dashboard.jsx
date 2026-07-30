import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import CountUp from '../components/CountUp.jsx';

const baht = (n) => Number(n).toFixed(2) + ' ฿';
const pad = (n) => String(n).padStart(2, '0');

const dateTimeOf = (ts) =>
  new Date(ts).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

const MODES = [
  { key: 'day', label: 'รายวัน' },
  { key: 'month', label: 'รายเดือน' },
  { key: 'year', label: 'รายปี' },
];

const Dashboard = () => {
  const { show } = useToast();
  const now = new Date();

  const [mode, setMode] = useState('day'); // default: รายวัน
  // ค่าเริ่มต้น = วัน/เดือน/ปี ปัจจุบัน
  const [day, setDay] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
  const [month, setMonth] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}`);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);

  // แปลงค่าที่เลือกเป็นวันอ้างอิง YYYY-MM-DD ส่งให้ backend
  const refDate = useMemo(() => {
    if (mode === 'day') return day;
    if (mode === 'month') return `${month}-01`;
    return `${year}-01-01`;
  }, [mode, day, month, year]);

  useEffect(() => {
    setData(null);
    api.getSales(mode, refDate).then(setData).catch((e) => show(e.message, 'error'));
  }, [mode, refDate, show]);

  // ข้อความสรุปช่วงเวลาที่กำลังดู
  const periodLabel = useMemo(() => {
    if (mode === 'day') return new Date(refDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
    if (mode === 'month') return new Date(refDate).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    return `ปี ${year}`;
  }, [mode, refDate, year]);

  return (
    <div>
      <h1 className="mb-4 font-display text-2xl text-grounds">ยอดขาย</h1>

      {/* เลือกช่วงเวลา + ตัวเลือกวัน/เดือน/ปี */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                mode === m.key ? 'bg-grounds text-foam' : 'bg-paper text-grounds/70 hover:text-grounds'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === 'day' && (
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="rounded border border-grounds/15 bg-paper px-3 py-1.5 text-sm font-mono outline-none focus:border-marigold"
          />
        )}
        {mode === 'month' && (
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded border border-grounds/15 bg-paper px-3 py-1.5 text-sm font-mono outline-none focus:border-marigold"
          />
        )}
        {mode === 'year' && (
          <input
            type="number"
            min="2020"
            max="2100"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-28 rounded border border-grounds/15 bg-paper px-3 py-1.5 text-sm font-mono outline-none focus:border-marigold"
          />
        )}
      </div>

      {/* ยอดรวมของช่วงที่เลือก */}
      <div className="ticket p-6">
        <div className="text-sm text-grounds/60">ยอดขาย · {periodLabel}</div>
        <div className="mt-1 font-display text-4xl text-grounds">
          {data ? <CountUp value={data.total} /> : '0.00'} <span className="text-2xl">฿</span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-sm text-grounds/50">{data ? `${data.count} ออเดอร์` : '—'}</span>
          <span className="h-0.5 w-12 bg-marigold" />
        </div>
      </div>

      {/* สรุปว่าขายอะไรไปบ้างในช่วงนี้ (รายเมนู) — กรอบสูงจำกัด เลื่อนภายใน */}
      <div className="mb-2 mt-8 flex items-baseline justify-between">
        <h2 className="font-display text-lg text-grounds">ขายอะไรไปบ้าง</h2>
        {data && data.breakdown.length > 0 && (
          <span className="text-xs text-grounds/40">{data.breakdown.length} เมนู</span>
        )}
      </div>
      <div className="ticket p-2">
        <div className="max-h-72 divide-y divide-dashed divide-grounds/15 overflow-y-auto">
          {!data || data.breakdown.length === 0 ? (
            <p className="py-8 text-center text-sm text-grounds/40">ยังไม่มียอดขายในช่วงเวลานี้</p>
          ) : (
            data.breakdown.map((b) => (
              <div key={b.name} className="flex items-center justify-between px-2 py-2.5 text-sm">
                <span className="flex-1 text-grounds">{b.name}</span>
                <span className="w-16 text-right font-mono text-grounds/60">×{b.qty}</span>
                <span className="w-24 text-right font-mono text-grounds">{baht(b.total)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* รายการออเดอร์ในช่วงที่เลือก (พร้อมรายการสินค้า) — กรอบสูงจำกัด เลื่อนภายใน */}
      <div className="mb-2 mt-8 flex items-baseline justify-between">
        <h2 className="font-display text-lg text-grounds">รายการออเดอร์</h2>
        {data && data.orders.length > 0 && (
          <span className="text-xs text-grounds/40">{data.count} ออเดอร์</span>
        )}
      </div>
      <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
        {!data || data.orders.length === 0 ? (
          <div className="ticket p-2">
            <p className="py-8 text-center text-sm text-grounds/40">ไม่มีออเดอร์ที่เสร็จแล้วในช่วงเวลานี้</p>
          </div>
        ) : (
          data.orders.map((r) => (
            <div key={r.id} className="ticket p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-mono text-grounds/60">{r.code}</span>
                <span className="text-grounds/50">{dateTimeOf(r.completed_at)}</span>
                <span className="font-mono text-grounds">{baht(r.total)}</span>
              </div>
              <ul className="mt-2 space-y-1 border-t border-dashed border-grounds/15 pt-2">
                {r.items.map((it, idx) => (
                  <li key={idx} className="flex justify-between text-xs text-grounds/70">
                    <span>
                      <span className="font-mono text-grounds/50">{it.qty}×</span> {it.name}
                    </span>
                    <span className="font-mono">{baht(it.price * it.qty)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Dashboard;
