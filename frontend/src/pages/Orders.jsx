import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import { usePending } from '../context/PendingContext.jsx';
import { useConfirm } from '../components/Confirm.jsx';

const baht = (n) => Number(n).toFixed(2) + ' ฿';
const timeOf = (ts) =>
  new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

const Orders = () => {
  const { show } = useToast();
  const { refresh } = usePending();
  const confirm = useConfirm();
  const [orders, setOrders] = useState([]);
  const [leaving, setLeaving] = useState({}); // id → 'complete' | 'cancel' ระหว่างเล่น animation ออก

  // โหลดบอร์ด + ซิงก์ badge ให้ตรงกับจำนวนจริงที่เห็น
  const load = () =>
    api.getPendingOrders().then((os) => { setOrders(os); refresh(); }).catch((e) => show(e.message, 'error'));

  useEffect(() => {
    load();
    const t = setInterval(load, 8000); // refresh บอร์ดครัว
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // เอาการ์ดออกจากบอร์ดพร้อม animation
  const leave = (id, kind) => {
    refresh(); // อัปเดต badge ทันที
    setLeaving((l) => ({ ...l, [id]: kind }));
    setTimeout(() => setOrders((os) => os.filter((o) => o.id !== id)), 400);
  };

  const complete = async (o) => {
    const ok = await confirm({
      title: 'ยืนยันออเดอร์เสร็จ',
      message: `ปิดออเดอร์ ${o.code} (${baht(o.total)}) เป็น "เสร็จแล้ว"?`,
      confirmText: 'เสร็จแล้ว',
    });
    if (!ok) return;
    try {
      await api.completeOrder(o.id);
      leave(o.id, 'complete');
    } catch (e) {
      show(e.message, 'error');
    }
  };

  const cancel = async (o) => {
    const ok = await confirm({
      title: 'ยกเลิกออเดอร์',
      message: `ยืนยันยกเลิกออเดอร์ ${o.code}? ออเดอร์จะถูกทำเป็นสถานะยกเลิก (ไม่นับเป็นยอดขาย)`,
      confirmText: 'ยกเลิกออเดอร์',
      cancelText: 'ไม่ใช่',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.cancelOrder(o.id);
      leave(o.id, 'cancel');
    } catch (e) {
      show(e.message, 'error');
    }
  };

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold text-ink">ออเดอร์ในครัว</h1>
      {orders.length === 0 ? (
        <div className="card p-16 text-center text-sm text-muted">ยังไม่มีออเดอร์ที่รอดำเนินการ</div>
      ) : (
        <div className="grid gap-4 pb-4 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((o) => (
            <div
              key={o.id}
              className={`card relative flex flex-col p-4 ${
                leaving[o.id] ? 'animate-card-out' : 'animate-card-in'
              }`}
            >
              <div className="flex items-center justify-between text-sm text-muted">
                <span className="tabular-nums">{o.code}</span>
                <span className="tabular-nums">{timeOf(o.created_at)}</span>
              </div>

              <ul className="my-3 space-y-1.5">
                {o.items.map((it, idx) => (
                  <li key={idx} className="border-b border-line pb-1.5 text-sm last:border-b-0">
                    <div className="flex justify-between gap-2">
                      <span className="text-ink">
                        {it.name} <span className="tabular-nums text-muted">×{it.qty}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-muted">
                        {baht(Number(it.price) * it.qty)}
                      </span>
                    </div>
                    {it.addons?.map((a, i) => (
                      <div key={i} className="flex justify-between gap-2 pl-3 text-xs text-muted">
                        <span className="truncate">- {a.name}</span>
                        <span className="shrink-0 tabular-nums">{baht(Number(a.price) * it.qty)}</span>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>

              <div className="mb-3 mt-auto flex items-baseline justify-between border-t border-line pt-3">
                <span className="text-sm text-muted">รวม</span>
                <span className="text-xl font-bold tabular-nums text-ink">{baht(o.total)}</span>
              </div>

              {leaving[o.id] === 'complete' && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="animate-stamp rounded-full border-4 border-matcha px-4 py-2 text-2xl font-bold text-matcha">
                    ✓ เสร็จ
                  </span>
                </div>
              )}
              {leaving[o.id] === 'cancel' && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="animate-stamp rounded-full border-4 border-coral px-4 py-2 text-2xl font-bold text-coral">
                    ✕ ยกเลิก
                  </span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => cancel(o)}
                  disabled={!!leaving[o.id]}
                  className="rounded-lg border border-line px-3 py-2.5 text-sm font-medium text-coral transition-transform duration-100 active:scale-95 disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={() => complete(o)}
                  disabled={!!leaving[o.id]}
                  className="flex-1 rounded-lg bg-matcha py-2.5 font-medium text-paper transition-transform duration-100 active:scale-95 disabled:opacity-50"
                >
                  เสร็จแล้ว
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Orders;
