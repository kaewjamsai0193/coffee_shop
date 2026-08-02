import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import CountUp from '../components/CountUp.jsx';
import PeriodPicker, { usePeriod, prevRefOf, prevLabelOf } from '../components/PeriodPicker.jsx';
import ShowMore from '../components/ShowMore.jsx';

const baht = (n) => Number(n).toFixed(2) + ' ฿';

const dateTimeOf = (ts) =>
  new Date(ts).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

const ORDERS_PREVIEW = 10; // แสดงเท่านี้ก่อน แล้วค่อยกด "ดูทั้งหมด"
const MENU_PREVIEW = 10;

const Dashboard = () => {
  const { show } = useToast();
  const period = usePeriod();
  const { mode, refDate, label, jumpTo } = period;

  const [summary, setSummary] = useState(null); // ภาพรวมวันนี้/เดือนนี้/ปีนี้
  const [data, setData] = useState(null); // ช่วงที่เลือก
  const [prev, setPrev] = useState(null); // ช่วงก่อนหน้า ใช้เทียบ
  const [showAllMenu, setShowAllMenu] = useState(false);
  const [showAllOrders, setShowAllOrders] = useState(false);

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
      <PeriodPicker period={period} />

      {/* ยอดรวมของช่วงที่เลือก + เทียบช่วงก่อนหน้า */}
      <div className="card p-6">
        <div className="text-sm text-muted">ยอดขาย · {label}</div>
        <div className="mt-1 text-4xl font-bold tabular-nums text-ink">
          {data ? <CountUp value={data.total} /> : '0.00'} <span className="text-2xl">฿</span>
        </div>

        <div className="mt-2 min-h-5 text-sm">
          {delta?.kind === 'up' && (
            <span className="text-matcha">
              ▲ {delta.pct.toFixed(1)}% {prevLabelOf(mode)} ({baht(delta.before)})
            </span>
          )}
          {delta?.kind === 'down' && (
            <span className="text-coral">
              ▼ {delta.pct.toFixed(1)}% {prevLabelOf(mode)} ({baht(delta.before)})
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
        {data && (
          <ShowMore
            expanded={showAllMenu}
            onToggle={() => setShowAllMenu((v) => !v)}
            total={data.breakdown.length}
            limit={MENU_PREVIEW}
            unit="เมนู"
          />
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
                  <li key={idx} className="text-xs text-muted">
                    <div className="flex justify-between gap-2">
                      <span>
                        {it.name} <span className="tabular-nums">×{it.qty}</span>
                      </span>
                      <span className="shrink-0 tabular-nums">{baht(it.price * it.qty)}</span>
                    </div>
                    {it.addons?.map((a, i) => (
                      <div key={i} className="flex justify-between gap-2 pl-3">
                        <span className="truncate">- {a.name}</span>
                        <span className="shrink-0 tabular-nums">{baht(Number(a.price) * it.qty)}</span>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
        {data && (
          <ShowMore
            expanded={showAllOrders}
            onToggle={() => setShowAllOrders((v) => !v)}
            total={data.orders.length}
            limit={ORDERS_PREVIEW}
            unit="ออเดอร์"
            className="card py-3"
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;
