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
];

const run = async () => {
  for (const sql of STATEMENTS) {
    await pool.query(sql);
  }
  console.log('✅ migration เรียบร้อย (ตารางวัตถุดิบพร้อมใช้งาน)');
  await pool.end();
};

run().catch((err) => {
  console.error('❌ migration ไม่สำเร็จ:', err);
  process.exit(1);
});
