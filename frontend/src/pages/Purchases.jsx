import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import { useConfirm } from '../components/Confirm.jsx';
import PeriodPicker, { usePeriod, ymd } from '../components/PeriodPicker.jsx';
import ShowMore from '../components/ShowMore.jsx';

const baht = (n) => Number(n).toFixed(2) + ' ฿';
const qtyOf = (n) => Number(n).toLocaleString('th-TH', { maximumFractionDigits: 2 });

// backend ส่งมาเป็น 'YYYY-MM-DD' — ประกอบเป็นวันที่ local เอง ไม่ผ่าน new Date(string)
// เพราะสตริงแบบ date-only จะถูกตีความเป็น UTC แล้ววันเพี้ยนไป 1 วัน
const dateOf = (s) => {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const DAYS_PREVIEW = 10;
const ITEMS_PREVIEW = 10;

const fieldClass =
  'w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink';

const IconTrash = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

let rowSeq = 0;
const blankRow = () => ({ key: ++rowSeq, name: '', qty: '', total: '' });

const Purchases = () => {
  const { show } = useToast();
  const confirm = useConfirm();
  const period = usePeriod();
  const { mode, refDate, label } = period;

  const [names, setNames] = useState([]); // ชื่อที่เคยบันทึก ไว้เป็นตัวเลือก
  const [data, setData] = useState(null);
  const [showAllItems, setShowAllItems] = useState(false);
  const [showAllDays, setShowAllDays] = useState(false);

  // ฟอร์มบันทึก — หลายรายการต่อครั้ง (เหมือนใบเสร็จ 1 ใบ ใช้วันที่เดียวกันทั้งใบ)
  const [rows, setRows] = useState([blankRow()]);
  const [date, setDate] = useState(() => ymd(new Date()));
  const [saving, setSaving] = useState(false);

  const loadNames = useCallback(() => {
    api.getIngredients().then(setNames).catch((e) => show(e.message, 'error'));
  }, [show]);

  const loadData = useCallback(() => {
    setShowAllItems(false);
    setShowAllDays(false);
    api.getPurchases(mode, refDate).then(setData).catch((e) => show(e.message, 'error'));
  }, [mode, refDate, show]);

  useEffect(() => loadNames(), [loadNames]);
  useEffect(() => {
    setData(null);
    loadData();
  }, [loadData]);

  const setField = (key, field, value) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  const addRow = () => setRows((rs) => [...rs, blankRow()]);
  const removeRow = (key) => setRows((rs) => (rs.length === 1 ? [blankRow()] : rs.filter((r) => r.key !== key)));

  // แถวที่ยังว่างทั้งแถวถือว่าไม่ได้กรอก ข้ามไปเลย ไม่ต้องให้ผู้ใช้ลบเอง
  const filled = rows.filter((r) => r.name.trim() || r.qty !== '' || r.total !== '');
  const draftTotal = filled.reduce((s, r) => s + (Number(r.total) || 0), 0);

  const save = async (e) => {
    e.preventDefault();
    if (filled.length === 0) {
      show('ยังไม่ได้กรอกรายการวัตถุดิบ', 'error');
      return;
    }
    const bad = filled.find((r) => !r.name.trim() || r.qty === '' || r.total === '');
    if (bad) {
      show('มีรายการที่กรอกไม่ครบ (ต้องมีทั้งชื่อ จำนวน และราคา)', 'error');
      return;
    }

    const ok = await confirm({
      title: 'บันทึกการซื้อ',
      confirmText: `บันทึก ${filled.length} รายการ`,
      message: (
        <div>
          <ul className="mb-2 space-y-1">
            {filled.map((r) => (
              <li key={r.key} className="flex justify-between">
                <span>
                  {r.name.trim()} × {qtyOf(r.qty)}
                </span>
                <span className="tabular-nums">{baht(r.total)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-line pt-2 font-medium text-ink">
            <span>รวม</span>
            <span className="tabular-nums">{baht(draftTotal)}</span>
          </div>
        </div>
      ),
    });
    if (!ok) return;

    setSaving(true);
    try {
      const res = await api.createPurchase({
        purchased_at: date,
        items: filled.map((r) => ({ name: r.name.trim(), qty: Number(r.qty), total: Number(r.total) })),
      });
      show(`บันทึก ${res.saved} รายการแล้ว`);
      setRows([blankRow()]); // คงวันที่ไว้ เผื่อบันทึกใบถัดไปของวันเดียวกัน
      loadNames();
      loadData();
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const voidItem = async (item) => {
    const ok = await confirm({
      title: 'ยกเลิกรายการนี้',
      message: `ยกเลิก "${item.name}" (${baht(item.total)})? รายการจะไม่ถูกนับเป็นต้นทุน`,
      confirmText: 'ยกเลิกรายการ',
      cancelText: 'ไม่ใช่',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.voidPurchase(item.id);
      show('ยกเลิกรายการแล้ว');
      loadData();
    } catch (e) {
      show(e.message, 'error');
    }
  };

  const maxTotal = data?.breakdown?.[0]?.total || 0; // breakdown เรียงจากมากไปน้อยมาแล้ว
  const itemRows = data ? (showAllItems ? data.breakdown : data.breakdown.slice(0, ITEMS_PREVIEW)) : [];
  const dayRows = data ? (showAllDays ? data.days : data.days.slice(0, DAYS_PREVIEW)) : [];

  return (
    <div>
      {/* ── ฟอร์มบันทึก: หลายรายการต่อครั้ง ── */}
      <form onSubmit={save} className="card p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted">วันที่ซื้อ</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`w-44 tabular-nums ${fieldClass}`}
            />
          </div>
          <span className="text-xs text-muted">ทุกรายการด้านล่างจะถูกบันทึกเป็นวันที่นี้</span>
        </div>

        {/* หัวคอลัมน์ — โชว์เฉพาะจอกว้าง จอแคบใช้ label ในแต่ละแถวแทน */}
        <div className="hidden gap-2 px-1 pb-1 text-xs text-muted sm:grid sm:grid-cols-[1fr_6rem_8rem_2.25rem]">
          <span>ชื่อวัตถุดิบ</span>
          <span>จำนวน</span>
          <span>ราคา (฿)</span>
          <span />
        </div>

        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.key} className="grid gap-2 sm:grid-cols-[1fr_6rem_8rem_2.25rem]">
              <input
                list="ingredient-names"
                value={r.name}
                onChange={(e) => setField(r.key, 'name', e.target.value)}
                placeholder="เลือกหรือพิมพ์ชื่อใหม่"
                className={fieldClass}
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={r.qty}
                onChange={(e) => setField(r.key, 'qty', e.target.value)}
                placeholder="จำนวน"
                className={`tabular-nums ${fieldClass}`}
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={r.total}
                onChange={(e) => setField(r.key, 'total', e.target.value)}
                placeholder="ราคา"
                className={`tabular-nums ${fieldClass}`}
              />
              <button
                type="button"
                onClick={() => removeRow(r.key)}
                aria-label="ลบแถวนี้"
                title="ลบแถวนี้"
                className="flex h-9 w-9 items-center justify-center justify-self-end rounded-lg text-muted transition-colors hover:bg-coral/10 hover:text-coral sm:self-center"
              >
                <IconTrash />
              </button>
            </div>
          ))}
        </div>

        <datalist id="ingredient-names">
          {names.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>

        <button
          type="button"
          onClick={addRow}
          className="mt-3 rounded-lg border border-line px-3 py-1.5 text-sm text-ink transition-colors hover:bg-surface"
        >
          + เพิ่มรายการ
        </button>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div>
            <span className="text-sm text-muted">รวม{filled.length > 0 ? ` · ${filled.length} รายการ` : ''}</span>
            <span className="ml-3 text-2xl font-bold tabular-nums text-ink">{baht(draftTotal)}</span>
          </div>
          <button
            type="submit"
            disabled={saving || filled.length === 0}
            className="rounded-lg bg-amber px-5 py-2.5 text-sm font-medium text-ink transition-transform duration-100 active:scale-95 disabled:opacity-40"
          >
            {saving ? 'กำลังบันทึก…' : 'บันทึกการซื้อ'}
          </button>
        </div>
      </form>

      <h2 className="mb-3 mt-8 text-lg font-bold text-ink">สรุปตามช่วงเวลา</h2>
      <PeriodPicker period={period} />

      {/* ── ยอดซื้อรวมของช่วงที่เลือก ── */}
      <div className="card p-6">
        <div className="text-sm text-muted">ยอดซื้อวัตถุดิบ · {label}</div>
        <div className="mt-1 text-4xl font-bold tabular-nums text-ink">
          {data
            ? Number(data.total).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '0.00'}{' '}
          <span className="text-2xl">฿</span>
        </div>
        <div className="mt-4 flex gap-8 border-t border-line pt-4">
          <div>
            <div className="text-xs text-muted">จำนวนรายการ</div>
            <div className="text-lg tabular-nums text-ink">{data ? data.count : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-muted">จำนวนวันที่ซื้อ</div>
            <div className="text-lg tabular-nums text-ink">{data ? data.days.length : '—'}</div>
          </div>
        </div>
      </div>

      {/* ── ซื้ออะไรไปบ้าง (รวมตามวัตถุดิบ) ── */}
      <div className="mb-2 mt-8 flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-ink">ซื้ออะไรไปบ้าง</h2>
        {data && data.breakdown.length > 0 && (
          <span className="text-xs text-muted">{data.breakdown.length} รายการ</span>
        )}
      </div>
      <div className="card p-2">
        <div className="divide-y divide-line">
          {!data || data.breakdown.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">ยังไม่มีการซื้อในช่วงเวลานี้</p>
          ) : (
            itemRows.map((b) => (
              <div key={b.name} className="px-2 py-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex-1 text-ink">{b.name}</span>
                  <span className="w-20 text-right tabular-nums text-muted">×{qtyOf(b.qty)}</span>
                  <span className="w-24 text-right tabular-nums text-ink">{baht(b.total)}</span>
                </div>
                <div className="mt-1.5 h-1 rounded-full bg-surface">
                  <div
                    className="h-1 rounded-full bg-amber"
                    style={{ width: maxTotal ? `${(b.total / maxTotal) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
        {data && (
          <ShowMore
            expanded={showAllItems}
            onToggle={() => setShowAllItems((v) => !v)}
            total={data.breakdown.length}
            limit={ITEMS_PREVIEW}
          />
        )}
      </div>

      {/* ── รายการแยกตามวัน (ใบเสร็จ 1 ใบต่อ 1 วัน) ── */}
      <div className="mb-2 mt-8 flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-ink">รายการตามวัน</h2>
        {data && data.days.length > 0 && <span className="text-xs text-muted">{data.days.length} วัน</span>}
      </div>
      <div className="space-y-2">
        {!data || data.days.length === 0 ? (
          <div className="card p-2">
            <p className="py-8 text-center text-sm text-muted">ยังไม่มีการซื้อในช่วงเวลานี้</p>
          </div>
        ) : (
          dayRows.map((d) => (
            <div key={d.date} className="card p-4">
              <div className="flex items-baseline justify-between border-b border-line pb-2">
                <span className="text-sm font-medium text-ink">{dateOf(d.date)}</span>
                <span className="font-bold tabular-nums text-ink">{baht(d.total)}</span>
              </div>
              <ul className="mt-2 space-y-1">
                {d.items.map((it) => (
                  <li key={it.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate text-ink">{it.name}</span>
                    <span className="w-20 text-right tabular-nums text-muted">×{qtyOf(it.qty)}</span>
                    <span className="w-24 text-right tabular-nums text-ink">{baht(it.total)}</span>
                    <button
                      onClick={() => voidItem(it)}
                      aria-label={`ยกเลิก ${it.name}`}
                      title="ยกเลิกรายการ"
                      className="rounded-md p-1 text-muted transition-colors hover:bg-coral/10 hover:text-coral"
                    >
                      <IconTrash />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
        {data && (
          <ShowMore
            expanded={showAllDays}
            onToggle={() => setShowAllDays((v) => !v)}
            total={data.days.length}
            limit={DAYS_PREVIEW}
            unit="วัน"
            className="card py-3"
          />
        )}
      </div>
    </div>
  );
};

export default Purchases;
