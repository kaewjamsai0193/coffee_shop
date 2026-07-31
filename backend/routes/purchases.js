import express from 'express';
import pool, { query } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// เงื่อนไขคงที่ต่อ period (ไม่รับค่าจากผู้ใช้ตรงๆ กัน SQL injection) — ref ผ่าน parameter
const COND = {
  day: 'p.purchased_at = $1::date',
  month: "date_trunc('month', p.purchased_at) = date_trunc('month', $1::date)",
  year: "date_trunc('year', p.purchased_at) = date_trunc('year', $1::date)",
};

// GET /purchases/ingredients — admin — ชื่อวัตถุดิบที่เคยบันทึก (ไว้เป็นตัวเลือกในช่องชื่อ)
router.get('/ingredients', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT name FROM ingredients ORDER BY name');
    res.json(rows.map((r) => r.name));
  } catch (err) {
    next(err);
  }
});

// POST /purchases — admin — บันทึกการซื้อหลายรายการในครั้งเดียว (เหมือนใบเสร็จ 1 ใบ)
// body: { purchased_at?, items: [{ name, qty, total }] }
router.post('/', requireAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { items } = req.body;
    const purchasedAt = req.body.purchased_at || null; // ว่าง = วันนี้

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'ยังไม่ได้กรอกรายการวัตถุดิบ' });
    }

    await client.query('BEGIN');

    let saved = 0;
    for (const line of items) {
      const name = String(line.name || '').trim();
      const qty = Number(line.qty);
      const total = Number(line.total);

      if (!name) {
        throw Object.assign(new Error('มีรายการที่ยังไม่ได้กรอกชื่อวัตถุดิบ'), { status: 400 });
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        throw Object.assign(new Error(`จำนวนของ "${name}" ต้องมากกว่า 0`), { status: 400 });
      }
      if (!Number.isFinite(total) || total < 0) {
        throw Object.assign(new Error(`ราคาของ "${name}" ไม่ถูกต้อง`), { status: 400 });
      }

      // ชื่อใหม่ → เก็บเข้าคลังชื่ออัตโนมัติ ครั้งหน้าจะโผล่ในตัวเลือกเอง
      const ing = await client.query(
        `INSERT INTO ingredients (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [name]
      );

      await client.query(
        `INSERT INTO ingredient_purchases (ingredient_id, name_snapshot, qty, total, purchased_at)
         VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE))`,
        [ing.rows[0].id, name, qty, total, purchasedAt]
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

// GET /purchases?period=day|month|year&date=YYYY-MM-DD — admin
// ยอดซื้อรวม + สรุปรายวัตถุดิบ + รายการแยกตามวัน (แบบใบเสร็จ)
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const period = req.query.period || 'day';
    const ref = req.query.date;
    const cond = COND[period];

    if (!cond || !ref) {
      return res.status(400).json({ error: 'ช่วงเวลาหรือวันที่ไม่ถูกต้อง' });
    }

    // สรุปรายวัตถุดิบ (ซื้ออะไรไปบ้างในช่วงนี้)
    const bd = await query(
      `SELECT p.name_snapshot AS name, SUM(p.qty) AS qty, SUM(p.total) AS total
       FROM ingredient_purchases p
       WHERE p.voided_at IS NULL AND ${cond}
       GROUP BY p.name_snapshot
       ORDER BY total DESC, qty DESC`,
      [ref]
    );

    // รายการแยกตามวัน — ใบเสร็จ 1 ใบต่อ 1 วัน
    // คืนวันที่เป็นสตริง YYYY-MM-DD ตรงๆ ถ้าปล่อยเป็น DATE ตัว driver จะแปลงเป็น Date
    // แล้ว JSON กลายเป็น UTC ทำให้วันเพี้ยนไป 1 วันบนเครื่องที่ timezone ต่างกัน
    const days = await query(
      `SELECT to_char(p.purchased_at, 'YYYY-MM-DD') AS date,
              SUM(p.total) AS total,
              json_agg(
                json_build_object('id', p.id, 'name', p.name_snapshot, 'qty', p.qty, 'total', p.total)
                ORDER BY p.id
              ) AS items
       FROM ingredient_purchases p
       WHERE p.voided_at IS NULL AND ${cond}
       GROUP BY p.purchased_at
       ORDER BY p.purchased_at DESC`,
      [ref]
    );

    const breakdown = bd.rows.map((r) => ({
      name: r.name,
      qty: Number(r.qty),
      total: Number(r.total),
    }));

    res.json({
      period,
      date: ref,
      total: breakdown.reduce((s, b) => s + b.total, 0),
      count: days.rows.reduce((s, d) => s + d.items.length, 0),
      breakdown,
      days: days.rows.map((d) => ({
        date: d.date,
        total: Number(d.total),
        items: d.items.map((it) => ({ ...it, qty: Number(it.qty), total: Number(it.total) })),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /purchases/:id/void — admin — ยกเลิกรายการที่บันทึกผิด (ไม่ลบทิ้ง ตามกฎโปรเจกต์)
router.patch('/:id/void', requireAdmin, async (req, res, next) => {
  try {
    const { rowCount } = await query(
      `UPDATE ingredient_purchases SET voided_at = now()
       WHERE id = $1 AND voided_at IS NULL`,
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
