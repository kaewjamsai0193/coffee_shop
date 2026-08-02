import express from 'express';
import { query } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// ราคาต้องเป็นตัวเลข 0 ถึงเพดานของ NUMERIC(8,2) — กันค่าที่ทำให้ DB โยน error
const validPrice = (p) => Number.isFinite(Number(p)) && Number(p) >= 0 && Number(p) <= 999999.99;

// GET /addons — admin — คลัง add-on กลางทั้งหมด + จำนวนเมนูที่เปิดใช้อยู่
// หน้าสั่งสินค้าไม่ต้องเรียก endpoint นี้ เพราะ GET /menu แนบ add-on ของแต่ละเมนูมาให้แล้ว
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT a.id, a.name, a.price, COUNT(ma.menu_item_id)::int AS menu_count
       FROM addons a
       LEFT JOIN menu_item_addons ma ON ma.addon_id = a.id
       GROUP BY a.id
       ORDER BY a.id`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /addons — admin — เพิ่มเข้าคลัง (ยังไม่ผูกกับเมนูไหน)
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { name, price } = req.body;
    if (!name || !String(name).trim() || price == null || !validPrice(price)) {
      return res.status(400).json({ error: 'ข้อมูลไม่ครบ: ต้องมีชื่อและราคาที่ถูกต้อง' });
    }
    const { rows } = await query(
      'INSERT INTO addons (name, price) VALUES ($1, $2) RETURNING id, name, price',
      [String(name).trim(), price]
    );
    res.status(201).json({ ...rows[0], menu_count: 0 });
  } catch (err) {
    next(err);
  }
});

// PATCH /addons/:id — admin — แก้ชื่อ/ราคา (มีผลกับเมนูทุกอันที่เปิดใช้ add-on ตัวนี้)
router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { name, price } = req.body;
    if (price != null && !validPrice(price)) {
      return res.status(400).json({ error: 'ราคาไม่ถูกต้อง' });
    }
    if (name != null && !String(name).trim()) {
      return res.status(400).json({ error: 'ชื่อห้ามว่าง' });
    }

    const fields = [];
    const values = [];
    let i = 1;
    if (name != null) { fields.push(`name = $${i++}`); values.push(String(name).trim()); }
    if (price != null) { fields.push(`price = $${i++}`); values.push(price); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'ไม่มีข้อมูลที่จะแก้ไข' });
    }

    values.push(req.params.id);
    const { rows } = await query(
      `UPDATE addons SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, name, price`,
      values
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบรายการนี้' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /addons/:id — admin — ลบออกจากคลัง (หลุดจากทุกเมนูที่เปิดใช้ด้วย ผ่าน ON DELETE CASCADE)
// ประวัติออเดอร์ปลอดภัย เพราะ snapshot ชื่อ+ราคาอยู่ใน order_items.addons แล้ว
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await query('DELETE FROM addons WHERE id = $1 RETURNING id', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบรายการนี้' });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
