import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import CountUp from '../components/CountUp.jsx';
import PeriodPicker, { usePeriod, prevRefOf, prevLabelOf } from '../components/PeriodPicker.jsx';

const baht = (n) => Number(n).toFixed(2) + ' ฿';

const Profit = () => {
  const { show } = useToast();
  const period = usePeriod();
  const { mode, refDate, label } = period;

  const [data, setData] = useState(null);
  const [prev, setPrev] = useState(null);

  // โหลดช่วงที่เลือก + ช่วงก่อนหน้าพร้อมกัน (alive กันคำตอบเก่ามาทับตอนสลับเร็วๆ)
  useEffect(() => {
    let alive = true;
    setData(null);
    setPrev(null);

    Promise.all([api.getProfit(mode, refDate), api.getProfit(mode, prevRefOf(mode, refDate))])
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

  // เทียบกำไรกับช่วงก่อนหน้า — ใช้ผลต่างเป็นบาท ไม่ใช่ % เพราะกำไรติดลบได้ (% จะอ่านไม่รู้เรื่อง)
  const delta = useMemo(() => {
    if (!data || !prev) return null;
    return { diff: data.profit - prev.profit, before: prev.profit };
  }, [data, prev]);

  // สัดส่วนกำไรต่อยอดขาย — ไม่มียอดขายก็ไม่มีอะไรให้คิด
  const margin = data && data.sales > 0 ? (data.profit / data.sales) * 100 : null;
  const loss = data ? data.profit < 0 : false;

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold text-ink">กำไร</h1>
      <PeriodPicker period={period} />

      {/* กำไรของช่วงที่เลือก */}
      <div className="card p-6">
        <div className="text-sm text-muted">
          {loss ? 'ขาดทุน' : 'กำไร'} · {label}
        </div>
        <div className={`mt-1 text-4xl font-bold tabular-nums ${loss ? 'text-coral' : 'text-ink'}`}>
          {data ? <CountUp value={Math.abs(data.profit)} /> : '0.00'} <span className="text-2xl">฿</span>
        </div>

        <div className="mt-2 min-h-5 text-sm">
          {delta && delta.diff >= 0 && (
            <span className="text-matcha">
              ▲ {baht(delta.diff)} {prevLabelOf(mode)} ({baht(delta.before)})
            </span>
          )}
          {delta && delta.diff < 0 && (
            <span className="text-coral">
              ▼ {baht(Math.abs(delta.diff))} {prevLabelOf(mode)} ({baht(delta.before)})
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-8 border-t border-line pt-4">
          <div>
            <div className="text-xs text-muted">สัดส่วนกำไรต่อยอดขาย</div>
            <div className="text-lg tabular-nums text-ink">
              {margin === null ? '—' : `${margin.toFixed(1)}%`}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted">จำนวนออเดอร์</div>
            <div className="text-lg tabular-nums text-ink">{data ? data.orders : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-muted">รายการที่ซื้อ</div>
            <div className="text-lg tabular-nums text-ink">{data ? data.purchaseItems : '—'}</div>
          </div>
        </div>
      </div>

      {/* ที่มาของตัวเลข */}
      <h2 className="mb-2 mt-8 text-lg font-bold text-ink">ที่มาของตัวเลข</h2>
      <div className="card divide-y divide-line">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-ink">ยอดขาย (ออเดอร์ที่เสร็จแล้ว)</span>
          <span className="font-bold tabular-nums text-matcha">
            {data ? baht(data.sales) : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-ink">ต้นทุนวัตถุดิบที่ซื้อ</span>
          <span className="font-bold tabular-nums text-coral">
            {data ? `− ${baht(data.cost)}` : '—'}
          </span>
        </div>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink">
              ค่าใช้จ่ายประจำ{mode === 'day' ? ' (เฉลี่ยต่อวัน)' : ''}
            </span>
            <span className="font-bold tabular-nums text-coral">
              {data ? `− ${baht(data.expenses)}` : '—'}
            </span>
          </div>
          {/* แยกตามประเภทเป็นบรรทัดละรายการขึ้นต้นด้วย "-" ตามรูปแบบเดียวกับ add-on ในหน้าออเดอร์ */}
          {data?.expenseBreakdown?.map((e) => (
            <div key={e.kind} className="mt-1 flex items-center justify-between text-xs text-muted">
              <span>- {e.kind}</span>
              <span className="tabular-nums">{baht(e.total)}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between bg-surface px-4 py-3">
          <span className="text-sm font-medium text-ink">{loss ? 'ขาดทุน' : 'กำไร'}</span>
          <span className={`text-lg font-bold tabular-nums ${loss ? 'text-coral' : 'text-ink'}`}>
            {data ? baht(data.profit) : '—'}
          </span>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">
        ต้นทุนวัตถุดิบนับจากวันที่ซื้อ ไม่ใช่วันที่ใช้จริง — ถ้าซื้อของล็อตใหญ่วันเดียว
        กำไรของวันนั้นจะดูต่ำผิดปกติ ให้ดูภาพรวมรายเดือนหรือรายปีประกอบด้วย
      </p>
      <p className="mt-2 text-xs text-muted">
        ค่าใช้จ่ายประจำ (ค่าน้ำ ค่าไฟ ฯลฯ) ผูกกับเดือนของบิล{' '}
        {mode === 'day'
          ? 'หน้ารายวันจึงหักเป็นค่าเฉลี่ยต่อวัน (ยอดบิลของเดือนนั้น ÷ จำนวนวันในเดือน) ทุกวันในเดือนจึงหักเท่ากัน'
          : 'ตัวเลขในช่วงนี้จึงเป็นยอดบิลจริง ไม่ได้เฉลี่ย'}{' '}
        แก้ไขบิลได้ที่หน้า <span className="text-ink">ต้นทุน → ค่าใช้จ่ายประจำ</span>
      </p>
    </div>
  );
};

export default Profit;
