-- Migration: ระบบ Add-on — คลังกลาง + เลือกเปิดใช้รายเมนู (2026-08-02)
-- สำหรับ DB เดิมที่มีข้อมูลอยู่แล้ว (DB ใหม่ไม่ต้องรัน — schema.sql มีให้ครบแล้ว)
-- รันใน docker: docker compose exec -T db psql -U postgres -d coffee_pos < backend/migrations/2026-08-02_addons.sql
-- รัน local:    psql -d coffee_pos -f backend/migrations/2026-08-02_addons.sql

-- ตาราง addons ยังไม่เคยมีข้อมูลจริง (เพิ่มมาในรอบเดียวกันนี้) — สร้างใหม่ได้เลย
-- ออเดอร์เก่าไม่กระทบ เพราะ snapshot ชื่อ+ราคาอยู่ใน order_items.addons ไม่มี FK ย้อนกลับ
DROP TABLE IF EXISTS menu_item_addons CASCADE;
DROP TABLE IF EXISTS addons CASCADE;

CREATE TABLE addons (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  price      NUMERIC(8,2) NOT NULL CHECK (price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE menu_item_addons (
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  addon_id     INTEGER NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
  PRIMARY KEY (menu_item_id, addon_id)
);

CREATE INDEX IF NOT EXISTS idx_menu_item_addons_addon_id ON menu_item_addons(addon_id);

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS addons JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS addons_total NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (addons_total >= 0);

-- ไม่มี seed ตั้งต้น — admin เพิ่มเองที่ปุ่ม "จัดการ Add-on" หน้า Menu Manage
