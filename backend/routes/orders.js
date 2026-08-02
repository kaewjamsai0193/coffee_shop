import express from 'express';
import pool, { query } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// ฟอร์แมตเลขออเดอร์ ORD-00000123 จาก id
const formatCode = (id) => `ORD-${String(id).padStart(8, '0')}`;

// POST /orders — public — สร้างออเดอร์ (ไม่ต้อง login)
// body: { items: [{ menu_item_id, qty, addon_ids?: [id] }] }
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'ยังไม่ได้เลือกรายการสินค้า' });
    }
    // endpoint นี้เปิด public — จำกัดเพดานกันยิงออเดอร์ขยะขนาดมหึมา
    if (items.length > 50) {
      return res.status(400).json({ error: 'รายการสินค้าต่อออเดอร์ต้องไม่เกิน 50 รายการ' });
    }

    await client.query('BEGIN');

    const order = (
      await client.query(`INSERT INTO orders (status) VALUES ('pending') RETURNING *`)
    ).rows[0];

    for (const line of items) {
      const qty = parseInt(line.qty, 10);
      if (!line.menu_item_id || !qty || qty < 1 || qty > 999) {
        throw Object.assign(new Error('รายการสินค้าไม่ถูกต้อง'), { status: 400 });
      }
      // ดึงชื่อ+ราคาปัจจุบันมา snapshot (business rule) และกันสั่งเมนูที่ปิดขาย
      const mi = (
        await client.query(
          'SELECT name, price FROM menu_items WHERE id = $1 AND is_available = true',
          [line.menu_item_id]
        )
      ).rows[0];
      if (!mi) {
        throw Object.assign(new Error('มีเมนูที่ไม่พร้อมขายอยู่ในตะกร้า'), { status: 400 });
      }

      // add-on: ดึงชื่อ+ราคาปัจจุบันมา snapshot เช่นเดียวกับเมนู และกัน add-on ที่ปิดขาย
      let addons = [];
      if (line.addon_ids != null) {
        if (!Array.isArray(line.addon_ids) || line.addon_ids.length > 20) {
          throw Object.assign(new Error('รายการเพิ่มพิเศษไม่ถูกต้อง'), { status: 400 });
        }
        const ids = [...new Set(line.addon_ids.map((x) => parseInt(x, 10)))];
        if (ids.some((x) => !Number.isInteger(x) || x < 1)) {
          throw Object.assign(new Error('รายการเพิ่มพิเศษไม่ถูกต้อง'), { status: 400 });
        }
        if (ids.length > 0) {
          // add-on ต้องเป็นตัวที่เมนูนั้นเปิดใช้จริง (กันสลับ add-on ข้ามเมนู)
          const found = (
            await client.query(
              `SELECT a.id, a.name, a.price
               FROM addons a
               JOIN menu_item_addons ma ON ma.addon_id = a.id
               WHERE a.id = ANY($1) AND ma.menu_item_id = $2
               ORDER BY a.id`,
              [ids, line.menu_item_id]
            )
          ).rows;
          if (found.length !== ids.length) {
            throw Object.assign(new Error('มีรายการเพิ่มพิเศษที่ไม่พร้อมขายอยู่ในตะกร้า'), { status: 400 });
          }
          addons = found.map((a) => ({ name: a.name, price: Number(a.price) }));
        }
      }
      const addonsTotal = addons.reduce((s, a) => s + a.price, 0);

      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, name_snapshot, price, qty, addons, addons_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [order.id, line.menu_item_id, mi.name, mi.price, qty, JSON.stringify(addons), addonsTotal]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ id: order.id, code: formatCode(order.id), status: order.status });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  } finally {
    client.release();
  }
});

// GET /orders?status=pending — admin — บอร์ดครัว
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const status = req.query.status || 'pending';
    const { rows } = await query(
      `SELECT o.id, o.status, o.created_at, o.completed_at,
              COALESCE(json_agg(
                json_build_object('name', oi.name_snapshot, 'price', oi.price, 'qty', oi.qty,
                                  'addons', oi.addons, 'addons_total', oi.addons_total)
                ORDER BY oi.id
              ) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items,
              COALESCE(SUM((oi.price + oi.addons_total) * oi.qty), 0) AS total
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.status = $1
       GROUP BY o.id
       ORDER BY o.created_at ASC`,
      [status]
    );
    res.json(rows.map((r) => ({ ...r, code: formatCode(r.id) })));
  } catch (err) {
    next(err);
  }
});

// GET /orders/pending-count — admin — นับจำนวนออเดอร์ที่รอ (เบา ไว้ทำ badge)
router.get('/pending-count', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT COUNT(*)::int AS count FROM orders WHERE status = 'pending'"
    );
    res.json({ count: rows[0].count });
  } catch (err) {
    next(err);
  }
});

// PATCH /orders/:id/complete — admin — ยืนยันเสร็จ
router.patch('/:id/complete', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE orders
       SET status = 'completed', completed_at = now()
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบออเดอร์ที่รอดำเนินการนี้' });
    }
    res.json({ ...rows[0], code: formatCode(rows[0].id) });
  } catch (err) {
    next(err);
  }
});

// PATCH /orders/:id/cancel — admin — ยกเลิกออเดอร์ (ใช้สถานะ cancelled ไม่ลบทิ้ง)
router.patch('/:id/cancel', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE orders
       SET status = 'cancelled'
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบออเดอร์ที่รอดำเนินการนี้' });
    }
    res.json({ ...rows[0], code: formatCode(rows[0].id) });
  } catch (err) {
    next(err);
  }
});

export default router;
