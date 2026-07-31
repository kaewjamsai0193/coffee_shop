import { useMemo, useState } from 'react';

// ตัวเลือกช่วงเวลา วัน/เดือน/ปี — ใช้ร่วมกัน 3 หน้า (ยอดขาย, ซื้อวัตถุดิบ, กำไร)
const MODES = [
  { key: 'day', label: 'รายวัน' },
  { key: 'month', label: 'รายเดือน' },
  { key: 'year', label: 'รายปี' },
];

const PREV_LABEL = { day: 'จากเมื่อวาน', month: 'จากเดือนที่แล้ว', year: 'จากปีที่แล้ว' };

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const prevLabelOf = (mode) => PREV_LABEL[mode];

// วันอ้างอิงของช่วงก่อนหน้า ใช้ยิง API ซ้ำเพื่อเทียบยอด
// (mode month/year ส่ง refDate เป็นวันที่ 1 เสมอ จึงไม่เจอปัญหาเดือนสั้น-ยาว)
export const prevRefOf = (mode, ref) => {
  const d = new Date(ref);
  if (mode === 'day') d.setDate(d.getDate() - 1);
  else if (mode === 'month') d.setMonth(d.getMonth() - 1);
  else d.setFullYear(d.getFullYear() - 1);
  return ymd(d);
};

export const usePeriod = (initialMode = 'day') => {
  const now = new Date();
  const today = ymd(now);
  const thisMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;

  const [mode, setMode] = useState(initialMode);
  const [day, setDay] = useState(today);
  const [month, setMonth] = useState(thisMonth);
  const [year, setYear] = useState(now.getFullYear());

  // แปลงค่าที่เลือกเป็นวันอ้างอิง YYYY-MM-DD ส่งให้ backend
  const refDate = useMemo(() => {
    if (mode === 'day') return day;
    if (mode === 'month') return `${month}-01`;
    return `${year}-01-01`;
  }, [mode, day, month, year]);

  const label = useMemo(() => {
    if (mode === 'day') return new Date(refDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
    if (mode === 'month') return new Date(refDate).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    return `ปี ${year}`;
  }, [mode, refDate, year]);

  // กระโดดไปดูช่วงนั้นของปัจจุบัน (ใช้ตอนกดการ์ดภาพรวม)
  const jumpTo = (key) => {
    setDay(today);
    setMonth(thisMonth);
    setYear(now.getFullYear());
    setMode(key);
  };

  return { mode, setMode, jumpTo, day, setDay, month, setMonth, year, setYear, refDate, label };
};

const inputClass =
  'rounded-lg border border-line bg-paper px-3 py-1.5 text-sm tabular-nums text-ink outline-none focus:border-ink';

const PeriodPicker = ({ period }) => {
  const { mode, setMode, day, setDay, month, setMonth, year, setYear } = period;

  return (
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
  );
};

export default PeriodPicker;
