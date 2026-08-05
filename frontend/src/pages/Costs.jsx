import { useState } from 'react';
import Purchases from './Purchases.jsx';
import Expenses from './Expenses.jsx';

// ต้นทุนสองก้อนที่หน้ากำไรเอาไปหัก — แยกกันคนละแท็บเพราะคิดคนละแบบ
// วัตถุดิบผูกกับวันที่ซื้อ · ค่าใช้จ่ายประจำผูกกับเดือนของบิลแล้วเฉลี่ยลงรายวัน
const TABS = [
  { key: 'ingredients', label: 'วัตถุดิบ' },
  { key: 'expenses', label: 'ค่าใช้จ่ายประจำ' },
];

// ชิปตาม Design.md §3 — ตั้งใจให้ต่างจากปุ่มช่วงเวลาใน PeriodPicker ที่อยู่ถัดลงไปในหน้าเดียวกัน
const tabClass = (active) =>
  `rounded-full border px-4 py-1.5 text-sm transition-colors ${
    active
      ? 'border-line bg-paper font-semibold text-ink'
      : 'border-transparent bg-surface font-medium text-muted hover:text-ink'
  }`;

const Costs = () => {
  const [tab, setTab] = useState('ingredients');

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold text-ink">ต้นทุน</h1>

      <div className="mb-5 flex gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={tabClass(tab === t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ingredients' ? <Purchases /> : <Expenses />}
    </div>
  );
};

export default Costs;
