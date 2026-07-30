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

  // เอาตั๋วออกจากบอร์ดพร้อม animation
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
      <h1 className="mb-4 font-display text-2xl text-grounds">ออเดอร์ในครัว</h1>
      {orders.length === 0 ? (
        <p className="py-16 text-center text-grounds/40">ยังไม่มีออเดอร์ที่รอดำเนินการ</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {orders.map((o) => (
            <div
              key={o.id}
              className={`ticket relative w-64 shrink-0 p-4 ${
                leaving[o.id] ? 'animate-ticket-out' : 'animate-ticket-in'
              }`}
            >
              <div className="flex items-center justify-between font-mono text-sm text-grounds/60">
                <span>{o.code}</span>
                <span>{timeOf(o.created_at)}</span>
              </div>

              <ul className="my-3 space-y-1.5">
                {o.items.map((it, idx) => (
                  <li key={idx} className="flex justify-between border-b border-dashed border-grounds/15 pb-1.5 text-sm">
                    <span className="text-grounds">
                      <span className="font-mono text-grounds/60">{it.qty}×</span> {it.name}
                    </span>
                    <span className="font-mono text-grounds/70">{baht(Number(it.price) * it.qty)}</span>
                  </li>
                ))}
              </ul>

              <div className="mb-3 flex justify-between font-medium">
                <span className="text-grounds/60">รวม</span>
                <span className="font-display text-xl text-grounds">{baht(o.total)}</span>
              </div>

              {leaving[o.id] === 'complete' && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="animate-stamp rounded-full border-4 border-matcha px-4 py-2 font-display text-2xl text-matcha">
                    ✓ เสร็จ
                  </span>
                </div>
              )}
              {leaving[o.id] === 'cancel' && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="animate-stamp rounded-full border-4 border-cherry px-4 py-2 font-display text-2xl text-cherry">
                    ✕ ยกเลิก
                  </span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => cancel(o)}
                  disabled={!!leaving[o.id]}
                  className="rounded border border-cherry/40 px-3 py-2.5 text-sm font-medium text-cherry transition-transform duration-100 active:scale-95 disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={() => complete(o)}
                  disabled={!!leaving[o.id]}
                  className="flex-1 rounded bg-matcha py-2.5 font-medium text-paper transition-transform duration-100 active:scale-95 disabled:opacity-50"
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
