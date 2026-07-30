import express from 'express';
import { query } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { uploadMenuImage, processAndSaveImage } from '../middleware/upload.js';

const router = express.Router();

const CATEGORIES = ['กาแฟสด', 'เย็น', 'ปั่น'];

// GET /menu — public — เฉพาะเมนูที่เปิดขาย (สำหรับหน้าสั่งสินค้า)
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, price, category, image_url, is_available
       FROM menu_items
       WHERE is_available = true
       ORDER BY id`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /menu/all — admin — ทุกเมนูรวมที่ปิดขาย (สำหรับหน้าจัดการ)
router.get('/all', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, price, category, image_url, is_available
       FROM menu_items
       ORDER BY id`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /menu — admin — สร้างเมนูใหม่ (multipart, รูป optional)
router.post('/', requireAdmin, uploadMenuImage, async (req, res, next) => {
  try {
    const { name, price, category } = req.body;
    if (!name || price == null || !CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'ข้อมูลไม่ครบ: ต้องมีชื่อ ราคา และหมวดที่ถูกต้อง' });
    }

    const { rows } = await query(
      `INSERT INTO menu_items (name, price, category)
       VALUES ($1, $2, $3) RETURNING *`,
      [name, price, category]
    );
    let item = rows[0];

    // มีรูปแนบมา → process แล้ว update image_url
    if (req.file) {
      const imageUrl = await processAndSaveImage(req.file.buffer, item.id);
      const updated = await query(
        'UPDATE menu_items SET image_url = $1 WHERE id = $2 RETURNING *',
        [imageUrl, item.id]
      );
      item = updated.rows[0];
    }

    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

// PATCH /menu/:id — admin — แก้ชื่อ/ราคา/หมวด/รูป/ปิดขาย (ห้ามลบ ใช้ is_available)
router.patch('/:id', requireAdmin, uploadMenuImage, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, price, category, is_available } = req.body;

    if (category && !CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'หมวดไม่ถูกต้อง' });
    }

    const fields = [];
    const values = [];
    let i = 1;
    if (name != null) { fields.push(`name = $${i++}`); values.push(name); }
    if (price != null) { fields.push(`price = $${i++}`); values.push(price); }
    if (category != null) { fields.push(`category = $${i++}`); values.push(category); }
    if (is_available != null) {
      // multipart ส่งมาเป็น string 'true'/'false'
      const val = is_available === true || is_available === 'true';
      fields.push(`is_available = $${i++}`); values.push(val);
    }
    if (req.file) {
      const imageUrl = await processAndSaveImage(req.file.buffer, id);
      fields.push(`image_url = $${i++}`); values.push(imageUrl);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'ไม่มีข้อมูลที่จะแก้ไข' });
    }

    values.push(id);
    const { rows } = await query(
      `UPDATE menu_items SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบเมนูนี้' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
