import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import { useConfirm } from '../components/Confirm.jsx';
import PeriodPicker, { usePeriod } from '../components/PeriodPicker.jsx';
import ShowMore from '../components/ShowMore.jsx';

const baht = (n) => Number(n).toFixed(2) + ' ฿';

// backend ส่งเดือนมาเป็น 'YYYY-MM-DD' (วันที่ 1 ของเดือน) — ประกอบเป็นวันที่ local เอง
// ไม่ผ่าน new Date(string) เพราะสตริงแบบ date-only จะถูกตีความเป็น UTC แล้วเดือนเพี้ยน
const monthLabelOf = (s) => {
  const [y, m] = String(s).split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
};

const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// ตัวเลือกตั้งต้นในช่องประเภท — ผสมกับประเภทที่เคยบันทึกจริง พิมพ์ชื่อใหม่เองก็ได้
const SUGGESTED_KINDS = ['ค่าไฟ', 'ค่าน้ำ', 'ค่าเช่าที่', 'ค่าแรงพนักงาน', 'ค่าแก๊ส', 'อินเทอร์เน็ต'];

const MONTHS_PREVIEW = 6;
const KINDS_PREVIEW = 10;

const fieldClass =
  'w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink';

const IconTrash = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

let rowSeq = 0;
const blankRow = () => ({ key: ++rowSeq, kind: '', note: '', total: '' });

const Expenses = () => {
  const { show } = useToast();
  const confirm = useConfirm();
  const period = usePeriod();
  const { mode, refDate, label } = period;

  const [kinds, setKinds] = useState([]); // ประเภทที่เคยบันทึก ไว้เป็นตัวเลือก
  const [data, setData] = useState(null);
  const [showAllKinds, setShowAllKinds] = useState(false);
  const [showAllMonths, setShowAllMonths] = useState(false);

  // ฟอร์มบันทึก — หลายรายการต่อครั้ง (บิลของเดือนเดียวกันทั้งชุด)
  const [rows, setRows] = useState([blankRow()]);
  const [month, setMonth] = useState(thisMonth);
  const [saving, setSaving] = useState(false);

  const loadKinds = useCallback(() => {
    api.getExpenseKinds().then(setKinds).catch((e) => show(e.message, 'error'));
  }, [show]);

  const loadData = useCallback(() => {
    setShowAllKinds(false);
    setShowAllMonths(false);
    api.getExpenses(mode, refDate).then(setData).catch((e) => show(e.message, 'error'));
  }, [mode, refDate, show]);

  useEffect(() => loadKinds(), [loadKinds]);
  useEffect(() => {
    setData(null);
    loadData();
  }, [loadData]);

  const setField = (key, field, value) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  const addRow = () => setRows((rs) => [...rs, blankRow()]);
  const removeRow = (key) => setRows((rs) => (rs.length === 1 ? [blankRow()] : rs.filter((r) => r.key !== key)));

  // แถวที่ยังว่างทั้งแถวถือว่าไม่ได้กรอก ข้ามไปเลย ไม่ต้องให้ผู้ใช้ลบเอง
  const filled = rows.filter((r) => r.kind.trim() || r.note.trim() || r.total !== '');
  const draftTotal = filled.reduce((s, r) => s + (Number(r.total) || 0), 0);

  const save = async (e) => {
    e.preventDefault();
    if (filled.length === 0) {
      show('ยังไม่ได้กรอกรายการค่าใช้จ่าย', 'error');
      return;
    }
    const bad = filled.find((r) => !r.kind.trim() || r.total === '');
    if (bad) {
      show('มีรายการที่กรอกไม่ครบ (ต้องมีทั้งประเภทและยอด)', 'error');
      return;
    }

    const ok = await confirm({
      title: 'บันทึกค่าใช้จ่ายประจำ',
      confirmText: `บันทึก ${filled.length} รายการ`,
      message: (
        <div>
          <p className="mb-2 text-sm text-muted">บิลของเดือน {monthLabelOf(`${month}-01`)}</p>
          <ul className="mb-2 space-y-1">
            {filled.map((r) => (
              <li key={r.key} className="flex justify-between gap-2">
                <span>
                  {r.kind.trim()}
                  {r.note.trim() && <span className="text-muted"> · {r.note.trim()}</span>}
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
      const res = await api.createExpense({
        period_month: month,
        items: filled.map((r) => ({ kind: r.kind.trim(), note: r.note.trim(), total: Number(r.total) })),
      });
      show(`บันทึก ${res.saved} รายการแล้ว`);
      setRows([blankRow()]); // คงเดือนไว้ เผื่อบันทึกบิลใบถัดไปของเดือนเดียวกัน
      loadKinds();
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
      message: `ยกเลิก "${item.kind}" (${baht(item.total)})? รายการจะไม่ถูกนับเป็นค่าใช้จ่าย`,
      confirmText: 'ยกเลิกรายการ',
      cancelText: 'ไม่ใช่',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.voidExpense(item.id);
      show('ยกเลิกรายการแล้ว');
      loadData();
    } catch (e) {
      show(e.message, 'error');
    }
  };

  const kindOptions = [...new Set([...kinds, ...SUGGESTED_KINDS])].sort();
  const maxTotal = data?.breakdown?.[0]?.total || 0; // breakdown เรียงจากมากไปน้อยมาแล้ว
  const kindRows = data ? (showAllKinds ? data.breakdown : data.breakdown.slice(0, KINDS_PREVIEW)) : [];
  const monthRows = data ? (showAllMonths ? data.months : data.months.slice(0, MONTHS_PREVIEW)) : [];

  return (
    <div>
      {/* ── ฟอร์มบันทึก: หลายรายการต่อครั้ง ── */}
      <form onSubmit={save} className="card p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted">เดือนของบิล</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className={`w-44 tabular-nums ${fieldClass}`}
            />
          </div>
          <span className="text-xs text-muted">
            คือเดือนที่ค่าใช้จ่ายนี้ครอบคลุม ไม่ใช่วันที่จ่ายเงิน
          </span>
        </div>

        {/* หัวคอลัมน์ — โชว์เฉพาะจอกว้าง จอแคบใช้ placeholder ในแต่ละแถวแทน */}
        <div className="hidden gap-2 px-1 pb-1 text-xs text-muted sm:grid sm:grid-cols-[1fr_1fr_8rem_2.25rem]">
          <span>ประเภท</span>
          <span>หมายเหตุ (ไม่บังคับ)</span>
          <span>ยอด (฿)</span>
          <span />
        </div>

        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.key} className="grid gap-2 sm:grid-cols-[1fr_1fr_8rem_2.25rem]">
              <input
                list="expense-kinds"
                value={r.kind}
                onChange={(e) => setField(r.key, 'kind', e.target.value)}
                placeholder="เลือกหรือพิมพ์ประเภทใหม่"
                className={fieldClass}
              />
              <input
                value={r.note}
                onChange={(e) => setField(r.key, 'note', e.target.value)}
                placeholder="หมายเหตุ"
                className={fieldClass}
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={r.total}
                onChange={(e) => setField(r.key, 'total', e.target.value)}
                placeholder="ยอด"
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

        <datalist id="expense-kinds">
          {kindOptions.map((k) => (
            <option key={k} value={k} />
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
            {saving ? 'กำลังบันทึก…' : 'บันทึกค่าใช้จ่าย'}
          </button>
        </div>
      </form>

      <h2 className="mb-3 mt-8 text-lg font-bold text-ink">สรุปตามช่วงเวลา</h2>
      <PeriodPicker period={period} />

      {/* ── ยอดของช่วงที่เลือก — รายวันคือค่าเฉลี่ยต่อวัน ตรงกับที่หน้ากำไรหักจริง ── */}
      <div className="card p-6">
        <div className="text-sm text-muted">
          ค่าใช้จ่ายประจำ{mode === 'day' ? ' (เฉลี่ยต่อวัน)' : ''} · {label}
        </div>
        <div className="mt-1 text-4xl font-bold tabular-nums text-ink">
          {data
            ? Number(data.total).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '0.00'}{' '}
          <span className="text-2xl">฿</span>
        </div>

        <div className="mt-2 min-h-5 text-sm text-muted">
          {data && mode === 'day' && data.billTotal > 0 && (
            <span>
              เฉลี่ยจากบิลของเดือนนี้ {baht(data.billTotal)} ÷ {data.days} วัน
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-8 border-t border-line pt-4">
          <div>
            <div className="text-xs text-muted">จำนวนบิล</div>
            <div className="text-lg tabular-nums text-ink">{data ? data.count : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-muted">{mode === 'day' ? 'ยอดบิลทั้งเดือน' : 'จำนวนเดือนที่มีบิล'}</div>
            <div className="text-lg tabular-nums text-ink">
              {!data ? '—' : mode === 'day' ? baht(data.billTotal) : data.months.length}
            </div>
          </div>
        </div>
      </div>

      {/* ── จ่ายอะไรไปบ้าง (รวมตามประเภท) ── */}
      <div className="mb-2 mt-8 flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-ink">จ่ายอะไรไปบ้าง</h2>
        {data && data.breakdown.length > 0 && (
          <span className="text-xs text-muted">{data.breakdown.length} ประเภท</span>
        )}
      </div>
      <div className="card p-2">
        <div className="divide-y divide-line">
          {!data || data.breakdown.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">ยังไม่มีค่าใช้จ่ายในช่วงเวลานี้</p>
          ) : (
            kindRows.map((b) => (
              <div key={b.kind} className="px-2 py-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex-1 text-ink">{b.kind}</span>
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
            expanded={showAllKinds}
            onToggle={() => setShowAllKinds((v) => !v)}
            total={data.breakdown.length}
            limit={KINDS_PREVIEW}
            unit="ประเภท"
          />
        )}
      </div>

      {/* ── บิลแยกตามเดือน ── */}
      <div className="mb-2 mt-8 flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-ink">บิลตามเดือน</h2>
        {data && data.months.length > 0 && <span className="text-xs text-muted">{data.months.length} เดือน</span>}
      </div>
      <div className="space-y-2">
        {!data || data.months.length === 0 ? (
          <div className="card p-2">
            <p className="py-8 text-center text-sm text-muted">ยังไม่มีค่าใช้จ่ายในช่วงเวลานี้</p>
          </div>
        ) : (
          monthRows.map((m) => (
            <div key={m.month} className="card p-4">
              <div className="flex items-baseline justify-between border-b border-line pb-2">
                <span className="text-sm font-medium text-ink">{monthLabelOf(m.month)}</span>
                <span className="font-bold tabular-nums text-ink">{baht(m.total)}</span>
              </div>
              <ul className="mt-2 space-y-1">
                {m.items.map((it) => (
                  <li key={it.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate text-ink">
                      {it.kind}
                      {it.note && <span className="text-muted"> · {it.note}</span>}
                    </span>
                    <span className="w-24 text-right tabular-nums text-ink">{baht(it.total)}</span>
                    <button
                      onClick={() => voidItem(it)}
                      aria-label={`ยกเลิก ${it.kind}`}
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
            expanded={showAllMonths}
            onToggle={() => setShowAllMonths((v) => !v)}
            total={data.months.length}
            limit={MONTHS_PREVIEW}
            unit="เดือน"
            className="card py-3"
          />
        )}
      </div>
    </div>
  );
};

export default Expenses;
