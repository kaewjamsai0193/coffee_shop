// migration แบบ idempotent — รันทุกครั้งที่ backend สตาร์ท (docker-entrypoint.sh)
// จำเป็นเพราะ schema.sql รันครั้งเดียวตอน DB ว่างเท่านั้น ตารางใหม่จึงไม่เกิดบน DB ที่มีข้อมูลอยู่แล้ว
// รันเองได้ด้วย: npm run migrate
import pool from '../db.js';

const STATEMENTS = [
  // คลังชื่อวัตถุดิบ — เติมอัตโนมัติเมื่อบันทึกชื่อใหม่ ใช้เป็นตัวเลือกในช่องชื่อ
  `CREATE TABLE IF NOT EXISTS ingredients (
     id         SERIAL PRIMARY KEY,
     name       TEXT NOT NULL UNIQUE,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,

  // รายการซื้อวัตถุดิบ — snapshot ชื่อ/ราคา ณ วันที่ซื้อ
  // (ราคาแต่ละวันไม่เท่ากัน ยึดหลักเดียวกับ order_items คือไม่อ้างอิงราคาปัจจุบันย้อนหลัง)
  `CREATE TABLE IF NOT EXISTS ingredient_purchases (
     id            SERIAL PRIMARY KEY,
     ingredient_id INTEGER REFERENCES ingredients(id),
     name_snapshot TEXT NOT NULL,
     qty           NUMERIC(10,2) NOT NULL CHECK (qty > 0),
     total         NUMERIC(10,2) NOT NULL CHECK (total >= 0),
     purchased_at  DATE NOT NULL DEFAULT CURRENT_DATE,
     voided_at     TIMESTAMPTZ,
     created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,

  // ยกเลิกช่อง "หน่วย" — DB ที่สร้างจาก migration รุ่นก่อนหน้าจะมีคอลัมน์นี้ค้างอยู่
  `ALTER TABLE ingredients DROP COLUMN IF EXISTS unit`,
  `ALTER TABLE ingredient_purchases DROP COLUMN IF EXISTS unit`,

  `CREATE INDEX IF NOT EXISTS idx_purchases_purchased_at ON ingredient_purchases(purchased_at)`,
  `CREATE INDEX IF NOT EXISTS idx_purchases_voided_at ON ingredient_purchases(voided_at)`,

  // คลัง add-on กลาง (ชื่อ + ราคา) — admin จัดการที่ปุ่ม "จัดการ Add-on" หน้า Menu Manage
  `CREATE TABLE IF NOT EXISTS addons (
     id         SERIAL PRIMARY KEY,
     name       TEXT NOT NULL,
     price      NUMERIC(8,2) NOT NULL CHECK (price >= 0),
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,

  // เมนูไหนเปิดใช้ add-on ตัวไหนบ้าง (ต้องมาหลัง addons เพราะอ้าง FK)
  `CREATE TABLE IF NOT EXISTS menu_item_addons (
     menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
     addon_id     INTEGER NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
     PRIMARY KEY (menu_item_id, addon_id)
   )`,

  `CREATE INDEX IF NOT EXISTS idx_menu_item_addons_addon_id ON menu_item_addons(addon_id)`,

  // snapshot add-on ต่อบรรทัดออเดอร์ — ราคาไม่เปลี่ยนย้อนหลังแม้แก้/ลบ add-on ทีหลัง
  `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS addons JSONB NOT NULL DEFAULT '[]'`,
  `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS addons_total NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (addons_total >= 0)`,

  // เพิ่มหมวด 'แอลกอฮอล์' + 'อื่นๆ' — DB เดิม CHECK ไว้แค่ 3 หมวด ต้อง drop ก่อนแล้วสร้างใหม่
  // (drop-then-add จึงรันซ้ำได้ปลอดภัย ไม่ต้องเช็คว่ามี constraint อยู่ไหม)
  `ALTER TABLE menu_items DROP CONSTRAINT IF EXISTS menu_items_category_check`,
  `ALTER TABLE menu_items ADD CONSTRAINT menu_items_category_check
     CHECK (category IN ('กาแฟสด', 'เย็น', 'ปั่น', 'แอลกอฮอล์', 'อื่นๆ'))`,
];

const run = async () => {
  for (const sql of STATEMENTS) {
    await pool.query(sql);
  }
  console.log('✅ migration เรียบร้อย (ตารางวัตถุดิบ + add-on พร้อมใช้งาน)');
  await pool.end();
};

run().catch((err) => {
  console.error('❌ migration ไม่สำเร็จ:', err);
  process.exit(1);
});
