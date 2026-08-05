import express from 'express';
import pool, { query } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// ค่าใช้จ่ายประจำผูกกับ "เดือนของบิล" (period_month = วันที่ 1 ของเดือนนั้น) ไม่ใช่วันที่จ่ายจริง
// เพราะบิลมาเดือนละครั้งแต่ค่าใช้จ่ายเกิดตลอดเดือน — ถ้าผูกกับวันที่จ่าย กำไรของวันนั้นจะดิ่งผิดความจริง
//   รายวัน  → เฉลี่ย: ยอดบิลของเดือนนั้น ÷ จำนวนวันในเดือน
//   รายเดือน → ยอดบิลของเดือนนั้นเต็มๆ
//   รายปี   → รวมทุกบิลในปีนั้น
// เงื่อนไขคงที่ต่อ period (ไม่รับค่าจากผู้ใช้ตรงๆ กัน SQL injection) — ref ผ่าน parameter
const COND = {
  day: "e.period_month = date_trunc('month', $1::date)::date",
  month: "e.period_month = date_trunc('month', $1::date)::date",
  year: "date_trunc('year', e.period_month) = date_trunc('year', $1::date)",
};

// ตัวหารของโหมดรายวัน = จำนวนวันในเดือนอ้างอิง · โหมดอื่นไม่เฉลี่ย (หารด้วย 1)
// cast เป็น numeric เพราะ EXTRACT บาง version คืน double แล้ว ROUND(double, int) ไม่มีใน pg
const divisorOf = (period) =>
  period === 'day'
    ? "EXTRACT(DAY FROM (date_trunc('month', $1::date) + INTERVAL '1 month' - INTERVAL '1 day'))::numeric"
    : '1::numeric';

// จำนวนวันในเดือนของวันอ้างอิง (ฝั่ง JS ไว้บอกผู้ใช้ว่าเฉลี่ยจากกี่วัน) — day 0 = วันสุดท้ายของเดือนก่อน
const daysInMonthOf = (ref) => {
  const [y, m] = String(ref).split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

// ยอดค่าใช้จ่ายประจำของช่วงที่เลือก (เฉลี่ยแล้วตามกฎด้านบน) แยกตามประเภท
// export ให้ reports.js /profit ใช้ร่วม เพื่อให้ตัวเลขสองหน้าตรงกันเสมอ
export const expenseBreakdown = async (period, ref) => {
  const cond = COND[period];
  if (!cond) return [];

  const { rows } = await query(
    `SELECT e.kind, ROUND(SUM(e.total) / ${divisorOf(period)}, 2) AS total
     FROM expenses e
     WHERE e.voided_at IS NULL AND ${cond}
     GROUP BY e.kind
     ORDER BY total DESC, e.kind`,
    [ref]
  );
  return rows.map((r) => ({ kind: r.kind, total: Number(r.total) }));
};

// GET /expenses/kinds — admin — ประเภทที่เคยบันทึก (ไว้เป็นตัวเลือกในช่องประเภท)
router.get('/kinds', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT DISTINCT kind FROM expenses ORDER BY kind');
    res.json(rows.map((r) => r.kind));
  } catch (err) {
    next(err);
  }
});

// POST /expenses — admin — บันทึกหลายรายการในครั้งเดียว (บิลของเดือนเดียวกันทั้งชุด)
// body: { period_month: 'YYYY-MM', items: [{ kind, note?, total }] }
router.post('/', requireAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { items } = req.body;
    const month = String(req.body.period_month || '');

    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw Object.assign(new Error('เดือนของบิลไม่ถูกต้อง'), { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw Object.assign(new Error('ยังไม่ได้กรอกรายการค่าใช้จ่าย'), { status: 400 });
    }

    await client.query('BEGIN');

    let saved = 0;
    for (const line of items) {
      const kind = String(line.kind || '').trim();
      const note = String(line.note || '').trim() || null;
      const total = Number(line.total);

      if (!kind) {
        throw Object.assign(new Error('มีรายการที่ยังไม่ได้กรอกประเภทค่าใช้จ่าย'), { status: 400 });
      }
      // เพดานตาม NUMERIC(10,2) — เกินแล้ว DB จะโยน error กลายเป็น 500 ไม่รู้เรื่อง
      if (!Number.isFinite(total) || total < 0 || total > 99999999.99) {
        throw Object.assign(new Error(`ยอดของ "${kind}" ไม่ถูกต้อง`), { status: 400 });
      }

      await client.query(
        `INSERT INTO expenses (kind, note, total, period_month) VALUES ($1, $2, $3, $4::date)`,
        [kind, note, total, `${month}-01`]
      );
      saved += 1;
    }

    await client.query('COMMIT');
    res.status(201).json({ saved });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  } finally {
    client.release();
  }
});

// GET /expenses?period=day|month|year&date=YYYY-MM-DD — admin
// total = ยอดที่ไปหักในหน้ากำไรของช่วงนี้ (รายวัน = เฉลี่ยต่อวัน) · billTotal = ยอดบิลจริง
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const period = req.query.period || 'day';
    const ref = req.query.date;
    const cond = COND[period];

    if (!cond || !ref) {
      return res.status(400).json({ error: 'ช่วงเวลาหรือวันที่ไม่ถูกต้อง' });
    }

    const breakdown = await expenseBreakdown(period, ref);

    // บิลแยกตามเดือน — คืนวันที่เป็นสตริงตรงๆ ถ้าปล่อยเป็น DATE ตัว driver จะแปลงเป็น Date
    // แล้ว JSON กลายเป็น UTC ทำให้เดือนเพี้ยนบนเครื่องที่ timezone ต่างกัน
    const months = await query(
      `SELECT to_char(e.period_month, 'YYYY-MM-DD') AS month,
              SUM(e.total) AS total,
              json_agg(
                json_build_object('id', e.id, 'kind', e.kind, 'note', e.note, 'total', e.total)
                ORDER BY e.id
              ) AS items
       FROM expenses e
       WHERE e.voided_at IS NULL AND ${cond}
       GROUP BY e.period_month
       ORDER BY e.period_month DESC`,
      [ref]
    );

    const rows = months.rows.map((m) => ({
      month: m.month,
      total: Number(m.total),
      items: m.items.map((it) => ({ ...it, total: Number(it.total) })),
    }));

    res.json({
      period,
      date: ref,
      total: breakdown.reduce((s, b) => s + b.total, 0),
      billTotal: rows.reduce((s, m) => s + m.total, 0),
      days: period === 'day' ? daysInMonthOf(ref) : null, // ตัวหารที่ใช้เฉลี่ย (null = ไม่ได้เฉลี่ย)
      count: rows.reduce((s, m) => s + m.items.length, 0),
      breakdown,
      months: rows,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /expenses/:id/void — admin — ยกเลิกบิลที่บันทึกผิด (ไม่ลบทิ้ง ตามกฎโปรเจกต์)
router.patch('/:id/void', requireAdmin, async (req, res, next) => {
  try {
    const { rowCount } = await query(
      `UPDATE expenses SET voided_at = now() WHERE id = $1 AND voided_at IS NULL`,
      [req.params.id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'ไม่พบรายการนี้ หรือถูกยกเลิกไปแล้ว' });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
