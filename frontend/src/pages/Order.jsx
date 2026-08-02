import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import { usePending } from '../context/PendingContext.jsx';
import { useConfirm } from '../components/Confirm.jsx';
import MenuImage from '../components/MenuImage.jsx';

const SHOP_NAME = 'Coffee POS';
const ALL = 'ทั้งหมด';
const CAT_ORDER = ['กาแฟสด', 'เย็น', 'ปั่น', 'แอลกอฮอล์', 'อื่นๆ']; // ลำดับที่อยากให้ชิปเรียง หมวดอื่นต่อท้ายอัตโนมัติ
const baht = (n) => Number(n).toFixed(2) + ' ฿';

const IconSearch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.6-3.6" strokeLinecap="round" />
  </svg>
);

const IconTrash = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// embedded=true → ฝังในหน้า admin (ใช้ layout ของ admin, ไม่มีแถบบนของตัวเอง)
const Order = ({ embedded = false }) => {
  const { show } = useToast();
  const { refresh } = usePending(); // no-op บนหน้า public (ไม่มี provider)
  const confirm = useConfirm();
  const [menu, setMenu] = useState([]);
  const [tab, setTab] = useState(ALL);
  const [q, setQ] = useState('');
  // ตะกร้าแยกบรรทัดตามชุด add-on — key = `${itemId}|${addonIds เรียงแล้ว}`
  const [cart, setCart] = useState({}); // { [key]: { item, qty, addons: [{id,name,price}] } }
  const [bumped, setBumped] = useState(null); // id ที่เพิ่ง +1 (ให้ badge เด้ง)
  const [submitting, setSubmitting] = useState(false);
  const [picking, setPicking] = useState(null); // เมนูที่กำลังเลือกจำนวนใน popup
  const [pickQty, setPickQty] = useState(1);
  const [pickAddons, setPickAddons] = useState([]); // id ของ add-on ที่ติ๊กใน popup
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    api.getMenu().then(setMenu).catch((e) => show(e.message, 'error'));
  }, [show]);

  // นาฬิกาบนแถบหัว — ละเอียดระดับนาที เลยเดินทุก 30 วิพอ ไม่ต้อง re-render ทุกวินาที
  useEffect(() => {
    if (embedded) return;
    const t = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(t);
  }, [embedded]);

  const clockLabel = useMemo(
    () =>
      `${clock.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })} · ${clock.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`,
    [clock]
  );

  // ชิปหมวด + จำนวนเมนูในหมวด (นับจากเมนูทั้งหมด ไม่ขึ้นกับคำค้น)
  const tabs = useMemo(() => {
    const counts = {};
    menu.forEach((m) => {
      counts[m.category] = (counts[m.category] || 0) + 1;
    });
    const known = CAT_ORDER.filter((c) => counts[c]);
    const extra = Object.keys(counts).filter((c) => !CAT_ORDER.includes(c));
    return [
      { key: ALL, count: menu.length },
      ...[...known, ...extra].map((c) => ({ key: c, count: counts[c] })),
    ];
  }, [menu]);

  const shown = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return menu.filter(
      (m) => (tab === ALL || m.category === tab) && (!kw || m.name.toLowerCase().includes(kw))
    );
  }, [menu, tab, q]);

  // ราคาต่อแก้ว = ราคาเมนู + add-on ที่เลือก
  const unitPrice = (l) =>
    Number(l.item.price) + l.addons.reduce((s, a) => s + Number(a.price), 0);

  const lines = Object.entries(cart).map(([key, l]) => ({ key, ...l }));
  const total = lines.reduce((sum, l) => sum + unitPrice(l) * l.qty, 0);
  const totalQty = lines.reduce((sum, l) => sum + l.qty, 0);

  // จำนวนรวมต่อเมนู (นับทุกบรรทัดของเมนูนั้น ไม่สน add-on) — ใช้กับ badge บนการ์ด
  const qtyByItem = useMemo(() => {
    const m = {};
    lines.forEach((l) => {
      m[l.item.id] = (m[l.item.id] || 0) + l.qty;
    });
    return m;
  }, [cart]); // eslint-disable-line react-hooks/exhaustive-deps

  const addToCartQty = (item, qty, selAddons = []) => {
    const key = `${item.id}|${selAddons.map((a) => a.id).sort((a, b) => a - b).join('.')}`;
    setCart((c) => ({
      ...c,
      [key]: { item, qty: (c[key]?.qty || 0) + qty, addons: selAddons },
    }));
    setBumped(item.id);
    setTimeout(() => setBumped(null), 400);
  };

  // แตะการ์ด → เปิด popup โชว์รูป + เลือกจำนวน/add-on (เริ่มที่ 1, ไม่ติ๊ก add-on)
  const selectItem = (item) => {
    setPickQty(1);
    setPickAddons([]);
    setPicking(item);
  };

  const toggleAddon = (id) =>
    setPickAddons((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));

  // ราคาต่อแก้วใน popup — คิด add-on ที่ติ๊กไว้ด้วย ให้เลขบนหัวขยับตามทันทีเหมือนปุ่มเพิ่ม
  const pickedAddons = (picking?.addons || []).filter((a) => pickAddons.includes(a.id));
  const pickUnit = picking
    ? Number(picking.price) + pickedAddons.reduce((s, a) => s + Number(a.price), 0)
    : 0;

  const confirmAdd = () => {
    addToCartQty(picking, pickQty, pickedAddons);
    setPicking(null);
  };

  const changeQty = (key, delta) => {
    setCart((c) => {
      const qty = (c[key]?.qty || 0) + delta;
      if (qty <= 0) {
        const { [key]: _, ...rest } = c;
        return rest;
      }
      return { ...c, [key]: { ...c[key], qty } };
    });
  };

  // ลบทีละรายการไม่ต้องถามยืนยัน (กด − จนหมดก็ได้ผลเดียวกัน) แต่ล้างทั้งตะกร้าต้องถาม
  const removeLine = (key) =>
    setCart((c) => {
      const { [key]: _, ...rest } = c;
      return rest;
    });

  const clearCart = async () => {
    const ok = await confirm({
      title: 'ล้างรายการทั้งหมด',
      message: `ลบทั้ง ${lines.length} รายการออกจากตะกร้า?`,
      confirmText: 'ล้างทั้งหมด',
      cancelText: 'ไม่ใช่',
      danger: true,
    });
    if (ok) setCart({});
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
              <li key={l.key} className="flex justify-between gap-2">
                <span>
                  {l.item.name} <span className="tabular-nums">×{l.qty}</span>
                  {l.addons.map((a) => (
                    <span key={a.id} className="block pl-3 text-xs text-muted">
                      - {a.name}
                    </span>
                  ))}
                </span>
                <span className="shrink-0 tabular-nums">{baht(unitPrice(l) * l.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-line pt-2 font-medium text-ink">
            <span>รวม</span>
            <span className="tabular-nums">{baht(total)}</span>
          </div>
        </div>
      ),
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      const res = await api.createOrder(
        lines.map((l) => ({ menu_item_id: l.item.id, qty: l.qty, addon_ids: l.addons.map((a) => a.id) }))
      );
      show(`สั่งสำเร็จ ${res.code}`);
      setCart({});
      refresh(); // เพิ่ม badge ทันทีเมื่อสั่งจากหน้า admin
    } catch (e) {
      show(e.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const body = (
    <>
      <div className={`grid grid-cols-1 gap-5 lg:grid-cols-[1fr_22rem] ${embedded ? '' : 'mx-auto max-w-7xl px-4 pb-10 pt-5'}`}>
        {/* แถบหัวเมนู = แถวบนของคอลัมน์ซ้าย (ตะกร้าไปเริ่มแถว 2 พร้อมการ์ดเมนู) */}
        <div className="lg:col-start-1 lg:row-start-1">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-ink">เมนู</h2>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                <IconSearch />
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหาเมนู"
                className="w-56 rounded-lg border border-line bg-paper py-2 pl-9 pr-3 text-sm text-ink outline-none placeholder:text-muted focus:border-ink"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  tab === t.key
                    ? 'border-line bg-paper font-semibold text-ink'
                    : 'border-transparent bg-surface font-medium text-muted hover:text-ink'
                }`}
              >
                {t.key}
                <span
                  className={`rounded px-1.5 text-xs tabular-nums ${
                    tab === t.key ? 'bg-amber text-ink' : 'bg-paper text-muted'
                  }`}
                >
                  {t.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ซ้าย: การ์ดเมนู */}
        <section className="lg:col-start-1 lg:row-start-2">
          {shown.length === 0 ? (
            <div className="card p-10 text-center text-sm text-muted">
              {q.trim() ? `ไม่พบเมนูที่ตรงกับ "${q.trim()}"` : 'ยังไม่มีเมนูในหมวดนี้'}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {shown.map((item) => (
                <div key={item.id} className="card relative">
                  <button
                    onClick={() => selectItem(item)}
                    className="block w-full p-2 text-left transition-transform duration-100 active:scale-[0.98]"
                  >
                    <div className="relative">
                      <MenuImage imageUrl={item.image_url} category={item.category} />
                      {qtyByItem[item.id] > 0 && (
                        <span
                          className={`absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-ink px-1.5 text-xs tabular-nums text-paper ${
                            bumped === item.id ? 'animate-bounce' : ''
                          }`}
                        >
                          {qtyByItem[item.id]}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 line-clamp-1 px-1 text-sm font-medium text-ink">{item.name}</div>
                    <div className="mt-0.5 px-1 pb-10 text-base font-bold tabular-nums text-ink">
                      {baht(item.price)}
                    </div>
                  </button>

                  {/* ทำงานเหมือนกดที่การ์ด — เปิด popup ให้เลือกจำนวน/add-on ก่อน */}
                  <button
                    onClick={() => selectItem(item)}
                    aria-label={`เลือก ${item.name}`}
                    className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-lg text-paper transition-transform duration-100 active:scale-90"
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ขวา: ตะกร้า — เริ่มแถวเดียวกับการ์ดเมนู */}
        <aside className="lg:sticky lg:top-4 lg:col-start-2 lg:row-start-2 lg:self-start">
          <div className="card flex flex-col">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="font-bold text-ink">รายการสั่ง</h2>
              {lines.length > 0 && (
                <button onClick={clearCart} className="text-sm text-muted transition-colors hover:text-coral">
                  ล้างทั้งหมด
                </button>
              )}
            </div>

            <div className="lg:max-h-[52vh] lg:overflow-y-auto">
              {lines.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-muted">ยังไม่มีรายการ</p>
              ) : (
                lines.map((l) => (
                  <div key={l.key} className="flex gap-3 border-b border-line px-4 py-3 last:border-b-0">
                    <div className="w-12 shrink-0">
                      <MenuImage imageUrl={l.item.image_url} category={l.item.category} size="sm" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="line-clamp-1 text-sm font-medium text-ink">{l.item.name}</span>
                        <button
                          onClick={() => removeLine(l.key)}
                          aria-label={`ลบ ${l.item.name}`}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-coral text-paper transition-transform duration-100 active:scale-90"
                        >
                          <IconTrash />
                        </button>
                      </div>
                      {l.addons.map((a) => (
                        <div key={a.id} className="mt-0.5 flex justify-between gap-2 text-xs text-muted">
                          <span className="truncate">- {a.name}</span>
                          <span className="shrink-0 tabular-nums">{baht(a.price)}</span>
                        </div>
                      ))}
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-sm font-bold tabular-nums text-ink">
                          {baht(unitPrice(l) * l.qty)}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => changeQty(l.key, -1)}
                            className="h-7 w-7 rounded-md border border-line text-ink transition-transform duration-100 active:scale-90"
                          >
                            −
                          </button>
                          <span className="w-7 text-center text-sm tabular-nums text-ink">{l.qty}</span>
                          <button
                            onClick={() => changeQty(l.key, 1)}
                            className="h-7 w-7 rounded-md border border-line text-ink transition-transform duration-100 active:scale-90"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-line p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted">ยอดรวม{totalQty > 0 ? ` · ${totalQty} ชิ้น` : ''}</span>
                <span className="text-2xl font-bold tabular-nums text-ink">{baht(total)}</span>
              </div>
              <button
                onClick={submit}
                disabled={lines.length === 0 || submitting}
                className="mt-3 w-full rounded-lg bg-amber py-3 font-medium text-ink transition-transform duration-100 active:scale-95 disabled:opacity-40"
              >
                {submitting ? 'กำลังสั่ง…' : 'ยืนยันสั่ง'}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* popup เลือกจำนวน + โชว์รูป ก่อนเพิ่มลงตะกร้า */}
      {picking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
          onClick={() => setPicking(null)}
        >
          <div className="card w-full max-w-xs p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto w-40">
              <MenuImage imageUrl={picking.image_url} category={picking.category} />
            </div>
            <div className="mt-3 text-center">
              <div className="font-medium text-ink">{picking.name}</div>
              <div className="text-xl font-bold tabular-nums text-ink">{baht(pickUnit)}</div>
              {pickedAddons.length > 0 && (
                <div className="text-xs tabular-nums text-muted">
                  {baht(picking.price)} + เพิ่มพิเศษ {baht(pickUnit - Number(picking.price))}
                </div>
              )}
            </div>

            {/* add-on ของเมนูนี้ — ติ๊กเลือกได้หลายรายการ คิดราคาต่อแก้ว */}
            {picking.addons?.length > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 text-sm text-muted">เพิ่มพิเศษ</div>
                <div className="max-h-36 space-y-1.5 overflow-y-auto">
                  {picking.addons.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => toggleAddon(a.id)}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                        pickAddons.includes(a.id)
                          ? 'border-ink bg-surface font-medium text-ink'
                          : 'border-line text-muted hover:text-ink'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                            pickAddons.includes(a.id)
                              ? 'border-ink bg-ink text-paper'
                              : 'border-line'
                          }`}
                        >
                          {pickAddons.includes(a.id) ? '✓' : ''}
                        </span>
                        {a.name}
                      </span>
                      <span className="tabular-nums">+{baht(a.price)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center justify-center gap-5">
              <button
                onClick={() => setPickQty((n) => Math.max(1, n - 1))}
                className="h-10 w-10 rounded-lg border border-line text-xl text-ink transition-transform duration-100 active:scale-90"
              >
                −
              </button>
              <span className="w-10 text-center text-2xl font-bold tabular-nums text-ink">{pickQty}</span>
              <button
                onClick={() => setPickQty((n) => n + 1)}
                className="h-10 w-10 rounded-lg border border-line text-xl text-ink transition-transform duration-100 active:scale-90"
              >
                +
              </button>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setPicking(null)}
                className="flex-1 rounded-lg px-4 py-2 text-sm text-muted hover:text-ink"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmAdd}
                className="flex-1 rounded-lg bg-amber py-2.5 text-sm font-medium text-ink transition-transform duration-100 active:scale-95"
              >
                เพิ่ม · {baht(pickUnit * pickQty)}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // ฝังในหน้า admin — ไม่ต้องมีหัวข้อหน้าซ้ำ เพราะมี "เมนู" คู่กับช่องค้นหาอยู่แล้ว
  if (embedded) return body;

  // หน้า public แบบเต็มจอ — มีแถบบนชื่อร้าน + วันเวลา
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-paper">☕</div>
          <div className="font-bold text-ink">{SHOP_NAME}</div>
          <span className="mr-auto flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm text-ink">
            <span className="h-1.5 w-1.5 rounded-full bg-matcha" />
            เปิดให้บริการ
          </span>
          <span className="rounded-lg border border-line px-3 py-1.5 text-sm tabular-nums text-muted">
            {clockLabel}
          </span>
        </div>
      </header>
      {body}
    </div>
  );
};

export default Order;
