-- Migration: ระบบ Add-on — คลังกลาง + เลือกเปิดใช้รายเมนู (2026-08-02)
-- สำหรับ DB เดิมที่มีข้อมูลอยู่แล้ว (DB ใหม่ไม่ต้องรัน — schema.sql มีให้ครบแล้ว)
-- รันใน docker: docker compose exec -T db psql -U postgres -d coffee_pos < backend/migrations/2026-08-02_addons.sql
-- รัน local:    psql -d coffee_pos -f backend/migrations/2026-08-02_addons.sql
--
-- ปลอดภัยกับข้อมูลเดิมและรันซ้ำได้ (idempotent) — ไม่มี DROP/DELETE ถ้ามีตารางอยู่แล้วจะข้ามให้

CREATE TABLE IF NOT EXISTS addons (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  price      NUMERIC(8,2) NOT NULL CHECK (price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS menu_item_addons (
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  addon_id     INTEGER NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
  PRIMARY KEY (menu_item_id, addon_id)
);

CREATE INDEX IF NOT EXISTS idx_menu_item_addons_addon_id ON menu_item_addons(addon_id);

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS addons JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS addons_total NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (addons_total >= 0);

-- ไม่มี seed ตั้งต้น — admin เพิ่มเองที่ปุ่ม "จัดการ Add-on" หน้า Menu Manage
