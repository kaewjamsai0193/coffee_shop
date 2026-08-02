import express from 'express';
import pool, { query } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { uploadMenuImage, processAndSaveImage } from '../middleware/upload.js';

const router = express.Router();

const CATEGORIES = ['กาแฟสด', 'เย็น', 'ปั่น', 'แอลกอฮอล์', 'อื่นๆ'];

// ราคาต้องเป็นตัวเลข 0 ถึงเพดานของ NUMERIC(8,2) — กันค่าที่ทำให้ DB โยน error
const validPrice = (p) => Number.isFinite(Number(p)) && Number(p) >= 0 && Number(p) <= 999999.99;

// เมนูแต่ละอันแนบ add-on ที่เปิดใช้มาด้วย (ไม่ต้องยิง API แยก)
const SELECT_MENU = `
  SELECT m.id, m.name, m.price, m.category, m.image_url, m.is_available,
         COALESCE(json_agg(
           json_build_object('id', a.id, 'name', a.name, 'price', a.price) ORDER BY a.id
         ) FILTER (WHERE a.id IS NOT NULL), '[]') AS addons
  FROM menu_items m
  LEFT JOIN menu_item_addons ma ON ma.menu_item_id = m.id
  LEFT JOIN addons a ON a.id = ma.addon_id`;

// GET /menu — public — เฉพาะเมนูที่เปิดขาย (สำหรับหน้าสั่งสินค้า)
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `${SELECT_MENU} WHERE m.is_available = true GROUP BY m.id ORDER BY m.id`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /menu/all — admin — ทุกเมนูรวมที่ปิดขาย (สำหรับหน้าจัดการ)
router.get('/all', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await query(`${SELECT_MENU} GROUP BY m.id ORDER BY m.id`);
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
    if (!validPrice(price)) {
      return res.status(400).json({ error: 'ราคาไม่ถูกต้อง' });
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

    // id ต้องเป็นตัวเลขเท่านั้น — ค่านี้ถูกใช้ตั้งชื่อไฟล์รูป ถ้าปล่อยผ่านจะเขียนไฟล์นอกโฟลเดอร์ uploads ได้
    if (!/^\d+$/.test(id)) {
      return res.status(404).json({ error: 'ไม่พบเมนูนี้' });
    }
    if (category && !CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'หมวดไม่ถูกต้อง' });
    }
    if (price != null && !validPrice(price)) {
      return res.status(400).json({ error: 'ราคาไม่ถูกต้อง' });
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

// PUT /menu/:id/addons — admin — ตั้งว่าเมนูนี้เปิดใช้ add-on ตัวไหนบ้าง (แทนที่ทั้งชุด)
// body: { addon_ids: [1, 2] } — ส่ง [] = ไม่ใช้ add-on เลย
// แก้แค่ตารางเชื่อม ไม่แตะคลัง add-on กลาง
router.put('/:id/addons', requireAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { addon_ids: addonIds } = req.body;

    if (!/^\d+$/.test(id)) {
      return res.status(404).json({ error: 'ไม่พบเมนูนี้' });
    }
    if (!Array.isArray(addonIds) || addonIds.length > 50) {
      return res.status(400).json({ error: 'รายการเพิ่มพิเศษต้องเป็นลิสต์ ไม่เกิน 50 รายการ' });
    }

    const ids = [...new Set(addonIds.map((x) => parseInt(x, 10)))];
    if (ids.some((x) => !Number.isInteger(x) || x < 1)) {
      return res.status(400).json({ error: 'รายการเพิ่มพิเศษไม่ถูกต้อง' });
    }

    await client.query('BEGIN');

    const menu = (await client.query('SELECT id FROM menu_items WHERE id = $1', [id])).rows[0];
    if (!menu) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'ไม่พบเมนูนี้' });
    }

    await client.query('DELETE FROM menu_item_addons WHERE menu_item_id = $1', [id]);
    if (ids.length > 0) {
      // add-on ต้องมีอยู่จริงในคลัง — ถ้าไม่ครบแปลว่ามีตัวที่เพิ่งถูกลบไป
      const inserted = await client.query(
        `INSERT INTO menu_item_addons (menu_item_id, addon_id)
         SELECT $1, a.id FROM addons a WHERE a.id = ANY($2)`,
        [id, ids]
      );
      if (inserted.rowCount !== ids.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'มีรายการเพิ่มพิเศษที่ไม่มีอยู่ในคลังแล้ว' });
      }
    }

    await client.query('COMMIT');

    const { rows } = await query(
      `SELECT a.id, a.name, a.price
       FROM addons a
       JOIN menu_item_addons ma ON ma.addon_id = a.id
       WHERE ma.menu_item_id = $1
       ORDER BY a.id`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

export default router;
