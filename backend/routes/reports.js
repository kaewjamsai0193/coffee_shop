import express from 'express';
import { query } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

const formatCode = (id) => `ORD-${String(id).padStart(8, '0')}`;

// GET /reports/summary — admin — ยอดขายวัน/เดือน/ปี (นับจาก completed_at เท่านั้น)
router.get('/summary', requireAdmin, async (req, res, next) => {
  try {
    // ใช้ timezone ของ server (ตั้ง TZ ที่ระบบ/DB ให้เป็น Asia/Bangkok)
    const totals = await query(
      `SELECT
         COALESCE(SUM(item_total) FILTER (WHERE completed_at::date = CURRENT_DATE), 0) AS today,
         COALESCE(SUM(item_total) FILTER (WHERE date_trunc('month', completed_at) = date_trunc('month', CURRENT_DATE)), 0) AS month,
         COALESCE(SUM(item_total) FILTER (WHERE date_trunc('year', completed_at) = date_trunc('year', CURRENT_DATE)), 0) AS year
       FROM (
         SELECT o.completed_at, SUM((oi.price + oi.addons_total) * oi.qty) AS item_total
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         WHERE o.status = 'completed'
         GROUP BY o.id, o.completed_at
       ) t`
    );

    // รายการ completed ล่าสุด 10 รายการ
    const recent = await query(
      `SELECT o.id, o.completed_at, SUM((oi.price + oi.addons_total) * oi.qty) AS total
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.status = 'completed'
       GROUP BY o.id, o.completed_at
       ORDER BY o.completed_at DESC
       LIMIT 10`
    );

    res.json({
      today: Number(totals.rows[0].today),
      month: Number(totals.rows[0].month),
      year: Number(totals.rows[0].year),
      recent: recent.rows.map((r) => ({
        id: r.id,
        code: formatCode(r.id),
        completed_at: r.completed_at,
        total: Number(r.total),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /reports/sales?period=day|month|year&date=YYYY-MM-DD — admin
// ยอดขาย + รายการของช่วงเวลาที่เลือก (อ้างอิงจาก completed_at เท่านั้น)
router.get('/sales', requireAdmin, async (req, res, next) => {
  try {
    const period = req.query.period || 'day';
    const ref = req.query.date; // วันอ้างอิง YYYY-MM-DD (day=วันนั้น, month=เดือนนั้น, year=ปีนั้น)

    // เงื่อนไขคงที่ต่อ period (ไม่รับค่าจากผู้ใช้ตรงๆ กัน SQL injection) — ref ผ่าน parameter
    const cond = {
      day: 'o.completed_at::date = $1::date',
      month: "date_trunc('month', o.completed_at) = date_trunc('month', $1::date)",
      year: "date_trunc('year', o.completed_at) = date_trunc('year', $1::date)",
    }[period];

    if (!cond || !ref) {
      return res.status(400).json({ error: 'ช่วงเวลาหรือวันที่ไม่ถูกต้อง' });
    }

    // ออเดอร์ + รายการสินค้าในแต่ละออเดอร์
    const { rows } = await query(
      `SELECT o.id, o.completed_at,
              SUM((oi.price + oi.addons_total) * oi.qty) AS total,
              json_agg(
                json_build_object('name', oi.name_snapshot, 'qty', oi.qty,
                                  'price', oi.price, 'addons', oi.addons)
                ORDER BY oi.id
              ) AS items
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.status = 'completed' AND ${cond}
       GROUP BY o.id, o.completed_at
       ORDER BY o.completed_at DESC`,
      [ref]
    );

    // สรุปยอดขายรายเมนู (ขายอะไรไปบ้างในช่วงนี้) — ราคาเมนูล้วน ไม่รวม add-on
    const bd = await query(
      `SELECT oi.name_snapshot AS name,
              SUM(oi.qty)::int AS qty,
              SUM(oi.price * oi.qty) AS total
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.status = 'completed' AND ${cond}
       GROUP BY oi.name_snapshot
       ORDER BY total DESC, qty DESC`,
      [ref]
    );

    const orders = rows.map((r) => ({
      id: r.id,
      code: formatCode(r.id),
      completed_at: r.completed_at,
      total: Number(r.total),
      items: r.items.map((it) => ({ name: it.name, qty: it.qty, price: Number(it.price), addons: it.addons })),
    }));

    res.json({
      period,
      date: ref,
      total: orders.reduce((s, o) => s + o.total, 0),
      count: orders.length,
      breakdown: bd.rows.map((r) => ({ name: r.name, qty: r.qty, total: Number(r.total) })),
      orders,
    });
  } catch (err) {
    next(err);
  }
});

// GET /reports/profit?period=day|month|year&date=YYYY-MM-DD — admin
// กำไร = ยอดขาย (completed_at) − ต้นทุนวัตถุดิบ (purchased_at) ของช่วงเดียวกัน
router.get('/profit', requireAdmin, async (req, res, next) => {
  try {
    const period = req.query.period || 'day';
    const ref = req.query.date;

    const salesCond = {
      day: 'o.completed_at::date = $1::date',
      month: "date_trunc('month', o.completed_at) = date_trunc('month', $1::date)",
      year: "date_trunc('year', o.completed_at) = date_trunc('year', $1::date)",
    }[period];

    const costCond = {
      day: 'purchased_at = $1::date',
      month: "date_trunc('month', purchased_at) = date_trunc('month', $1::date)",
      year: "date_trunc('year', purchased_at) = date_trunc('year', $1::date)",
    }[period];

    if (!salesCond || !ref) {
      return res.status(400).json({ error: 'ช่วงเวลาหรือวันที่ไม่ถูกต้อง' });
    }

    const sales = await query(
      `SELECT COALESCE(SUM((oi.price + oi.addons_total) * oi.qty), 0) AS total, COUNT(DISTINCT o.id)::int AS orders
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.status = 'completed' AND ${salesCond}`,
      [ref]
    );

    const cost = await query(
      `SELECT COALESCE(SUM(total), 0) AS total, COUNT(*)::int AS items
       FROM ingredient_purchases
       WHERE voided_at IS NULL AND ${costCond}`,
      [ref]
    );

    const salesTotal = Number(sales.rows[0].total);
    const costTotal = Number(cost.rows[0].total);

    res.json({
      period,
      date: ref,
      sales: salesTotal,
      orders: sales.rows[0].orders,
      cost: costTotal,
      purchaseItems: cost.rows[0].items,
      profit: salesTotal - costTotal,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
