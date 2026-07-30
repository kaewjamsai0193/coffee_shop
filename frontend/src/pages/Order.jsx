import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import { usePending } from '../context/PendingContext.jsx';
import { useConfirm } from '../components/Confirm.jsx';
import MenuImage from '../components/MenuImage.jsx';

const ALL = 'ทั้งหมด';
const TABS = [ALL, 'กาแฟสด', 'เย็น', 'ปั่น']; // 'ทั้งหมด' = รวมทุกเมนู
const baht = (n) => Number(n).toFixed(2) + ' ฿';

// embedded=true → ฝังในหน้า admin (ใช้ Navbar/main ของ layout, ไม่มี header/gear ของตัวเอง)
const Order = ({ embedded = false }) => {
  const { show } = useToast();
  const { refresh } = usePending(); // no-op บนหน้า public (ไม่มี provider)
  const confirm = useConfirm();
  const [menu, setMenu] = useState([]);
  const [tab, setTab] = useState(ALL);
  const [cart, setCart] = useState({}); // { [id]: { item, qty } }
  const [bumped, setBumped] = useState(null); // id ที่เพิ่ง +1 (ให้ badge เด้ง)
  const [submitting, setSubmitting] = useState(false);
  const [picking, setPicking] = useState(null); // เมนูที่กำลังเลือกจำนวนใน popup
  const [pickQty, setPickQty] = useState(1);

  useEffect(() => {
    api.getMenu().then(setMenu).catch((e) => show(e.message, 'error'));
  }, [show]);

  const shown = useMemo(
    () => (tab === ALL ? menu : menu.filter((m) => m.category === tab)),
    [menu, tab]
  );
  const lines = Object.values(cart);
  const total = lines.reduce((sum, l) => sum + Number(l.item.price) * l.qty, 0);

  const addToCartQty = (item, qty) => {
    setCart((c) => ({ ...c, [item.id]: { item, qty: (c[item.id]?.qty || 0) + qty } }));
    setBumped(item.id);
    setTimeout(() => setBumped(null), 400);
  };

  // แตะเมนู → เปิด popup โชว์รูป + เลือกจำนวน (เริ่มที่ 1)
  const selectItem = (item) => {
    setPickQty(1);
    setPicking(item);
  };

  const confirmAdd = () => {
    addToCartQty(picking, pickQty);
    setPicking(null);
  };

  const changeQty = (id, delta) => {
    setCart((c) => {
      const qty = (c[id]?.qty || 0) + delta;
      if (qty <= 0) {
        const { [id]: _, ...rest } = c;
        return rest;
      }
      return { ...c, [id]: { ...c[id], qty } };
    });
  };

  const submit = async () => {
    if (lines.length === 0) return;
    // popup สรุปออเดอร์ + ยอดรวม ก่อนส่งจริง
    const ok = await confirm({
      title: 'ยืนยันการสั่ง',
      confirmText: 'ยืนยันสั่ง',
      message: (
        <div>
          <ul className="mb-2 space-y-1">
            {lines.map((l) => (
              <li key={l.item.id} className="flex justify-between">
                <span>{l.item.name} × {l.qty}</span>
                <span className="font-mono">{baht(Number(l.item.price) * l.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-dashed border-grounds/20 pt-2 font-medium text-grounds">
            <span>รวม</span>
            <span className="font-mono">{baht(total)}</span>
          </div>
        </div>
      ),
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      const res = await api.createOrder(lines.map((l) => ({ menu_item_id: l.item.id, qty: l.qty })));
      show(`สั่งสำเร็จ ${res.code}`);
      setCart({});
      refresh(); // เพิ่ม badge ทันทีเมื่อสั่งจากหน้า admin
    } catch (e) {
      show(e.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const grid = (
    <>
    <div
      className={`grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem] ${
        embedded ? '' : 'mx-auto max-w-6xl px-4 pb-10'
      }`}
    >
      {/* ซ้าย: เมนู */}
        <section>
          <div className="mb-4 flex flex-wrap gap-2">
            {TABS.map((c) => (
              <button
                key={c}
                onClick={() => setTab(c)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  tab === c ? 'bg-grounds text-foam' : 'bg-paper text-grounds/70 hover:text-grounds'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {shown.map((item) => (
              <button
                key={item.id}
                onClick={() => selectItem(item)}
                className="ticket relative overflow-hidden p-2 text-left transition-transform duration-100 active:scale-95"
              >
                <MenuImage imageUrl={item.image_url} category={item.category} />
                {cart[item.id] && (
                  <span
                    className={`absolute right-3 top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-marigold px-1.5 font-mono text-xs text-grounds ${
                      bumped === item.id ? 'animate-bounce' : ''
                    }`}
                  >
                    {cart[item.id].qty}
                  </span>
                )}
                <div className="mt-2 line-clamp-1 text-sm font-medium text-grounds">{item.name}</div>
                <div className="font-display text-lg text-grounds">{baht(item.price)}</div>
              </button>
            ))}
          </div>
        </section>

        {/* ขวา: ตะกร้า (ticket sticky) */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="ticket p-4">
            <div className="mb-3 font-mono text-sm text-grounds/60">🧾 ตะกร้า</div>
            {lines.length === 0 ? (
              <p className="py-8 text-center text-sm text-grounds/40">ยังไม่มีรายการ</p>
            ) : (
              <ul className="space-y-2">
                {lines.map((l) => (
                  <li
                    key={l.item.id}
                    className="flex items-center justify-between border-b border-dashed border-grounds/15 pb-2 text-sm"
                  >
                    <span className="flex-1 text-grounds">{l.item.name}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => changeQty(l.item.id, -1)} className="h-6 w-6 rounded bg-foam text-grounds">−</button>
                      <span className="w-5 text-center font-mono">{l.qty}</span>
                      <button onClick={() => changeQty(l.item.id, 1)} className="h-6 w-6 rounded bg-foam text-grounds">+</button>
                    </div>
                    <span className="ml-3 w-20 text-right font-mono text-grounds">
                      {baht(Number(l.item.price) * l.qty)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-sm text-grounds/60">รวม</span>
              <span className="font-display text-3xl text-grounds">{baht(total)}</span>
            </div>

            <button
              onClick={submit}
              disabled={lines.length === 0 || submitting}
              className="mt-4 w-full rounded bg-marigold py-3 font-medium text-grounds transition-transform duration-100 active:scale-95 disabled:opacity-40"
            >
              {submitting ? 'กำลังสั่ง…' : 'ยืนยันสั่ง'}
            </button>
          </div>
        </aside>
      </div>

      {/* popup เลือกจำนวน + โชว์รูป ก่อนเพิ่มลงตะกร้า */}
      {picking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-grounds/40 px-4"
          onClick={() => setPicking(null)}
        >
          <div className="ticket w-full max-w-xs p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto w-40">
              <MenuImage imageUrl={picking.image_url} category={picking.category} />
            </div>
            <div className="mt-3 text-center">
              <div className="font-medium text-grounds">{picking.name}</div>
              <div className="font-display text-2xl text-grounds">{baht(picking.price)}</div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-5">
              <button
                onClick={() => setPickQty((q) => Math.max(1, q - 1))}
                className="h-10 w-10 rounded-full bg-foam text-xl text-grounds transition-transform duration-100 active:scale-90"
              >
                −
              </button>
              <span className="w-10 text-center font-mono text-2xl text-grounds">{pickQty}</span>
              <button
                onClick={() => setPickQty((q) => q + 1)}
                className="h-10 w-10 rounded-full bg-foam text-xl text-grounds transition-transform duration-100 active:scale-90"
              >
                +
              </button>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setPicking(null)}
                className="flex-1 rounded px-4 py-2 text-sm text-grounds/60 hover:text-grounds"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmAdd}
                className="flex-1 rounded bg-marigold py-2.5 text-sm font-medium text-grounds transition-transform duration-100 active:scale-95"
              >
                เพิ่ม · {baht(Number(picking.price) * pickQty)}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // ฝังในหน้า admin — ใช้ h1 แบบเดียวกับหน้า admin อื่น ไม่มี gear
  if (embedded) {
    return (
      <>
        <h1 className="mb-4 font-display text-2xl text-grounds">เมนู</h1>
        {grid}
      </>
    );
  }

  // หน้า public แบบเต็มจอ — มีหัวข้อ + ไอคอนลับเข้า admin
  return (
    <div className="min-h-screen bg-foam">
      <header className="px-6 py-4">
        <h1 className="font-display text-2xl text-grounds">สั่งเครื่องดื่ม</h1>
      </header>
      {grid}
    </div>
  );
};

export default Order;
