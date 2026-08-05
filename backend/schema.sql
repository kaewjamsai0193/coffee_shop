-- Coffee POS — schema + seed data
-- รัน: createdb coffee_pos && psql -d coffee_pos -f backend/schema.sql

DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS ingredient_purchases CASCADE;
DROP TABLE IF EXISTS ingredients CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS menu_item_addons CASCADE;
DROP TABLE IF EXISTS addons CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS admins CASCADE;

-- แอดมิน (สร้างคนแรกด้วย: npm run create-admin)
CREATE TABLE admins (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- เมนู (admin จัดการได้ — ห้ามลบ ใช้ is_available = false เพื่อปิดขาย)
CREATE TABLE menu_items (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  price        NUMERIC(8,2) NOT NULL CHECK (price >= 0),
  category     TEXT NOT NULL CHECK (category IN ('กาแฟสด', 'เย็น', 'ปั่น', 'แอลกอฮอล์', 'อื่นๆ')),
  image_url    TEXT,                       -- NULL = ใช้ fallback emoji/สี ตามหมวด
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ออเดอร์ (ห้ามลบ — MVP มีแค่ pending/completed)
CREATE TABLE orders (
  id           SERIAL PRIMARY KEY,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- คลัง Add-on กลาง (ชื่อ + ราคา) — admin จัดการที่ปุ่ม "จัดการ Add-on" หน้า Menu Manage
-- ลบจริงได้ เพราะออเดอร์ snapshot ชื่อ+ราคาลง order_items.addons แล้ว ไม่มี FK ย้อนกลับ
CREATE TABLE addons (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  price      NUMERIC(8,2) NOT NULL CHECK (price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- เมนูไหนเปิดใช้ add-on ตัวไหนบ้าง — admin ติ๊กเลือกในฟอร์มแก้ไขเมนูของแต่ละเมนู
CREATE TABLE menu_item_addons (
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  addon_id     INTEGER NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
  PRIMARY KEY (menu_item_id, addon_id)
);

-- รายการในออเดอร์ — snapshot ชื่อ+ราคา ณ เวลาสั่ง (ไม่อ้างอิงราคาปัจจุบันย้อนหลัง)
-- addons = snapshot [{name, price}] ต่อแก้ว, addons_total = ผลรวมราคา add-on ต่อแก้ว
CREATE TABLE order_items (
  id            SERIAL PRIMARY KEY,
  order_id      INTEGER NOT NULL REFERENCES orders(id),
  menu_item_id  INTEGER NOT NULL REFERENCES menu_items(id),
  name_snapshot TEXT NOT NULL,
  price         NUMERIC(8,2) NOT NULL CHECK (price >= 0),
  qty           INTEGER NOT NULL CHECK (qty > 0),
  addons        JSONB NOT NULL DEFAULT '[]',
  addons_total  NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (addons_total >= 0)
);

-- คลังชื่อวัตถุดิบ — เติมอัตโนมัติเมื่อบันทึกชื่อใหม่ ใช้เป็นตัวเลือกในช่องชื่อ
CREATE TABLE ingredients (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- รายการซื้อวัตถุดิบ — snapshot ชื่อ/ราคา ณ วันที่ซื้อ (ราคาแต่ละวันไม่เท่ากัน)
-- ห้ามลบทิ้ง ใช้ voided_at เพื่อยกเลิกรายการ (รายการที่ยกเลิกไม่นับเป็นต้นทุน)
CREATE TABLE ingredient_purchases (
  id            SERIAL PRIMARY KEY,
  ingredient_id INTEGER REFERENCES ingredients(id),
  name_snapshot TEXT NOT NULL,
  qty           NUMERIC(10,2) NOT NULL CHECK (qty > 0),
  total         NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  purchased_at  DATE NOT NULL DEFAULT CURRENT_DATE,
  voided_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ค่าใช้จ่ายประจำ (ค่าน้ำ ค่าไฟ ค่าเช่า ฯลฯ) — เก็บเป็น "บิลของเดือนไหน" ไม่ใช่วันที่จ่ายจริง
-- บิลมาเดือนละครั้งแต่ค่าใช้จ่ายเกิดตลอดเดือน ถ้าผูกกับวันที่จ่ายกำไรของวันนั้นจะดิ่งผิดความจริง
-- period_month = วันที่ 1 ของเดือนที่บิลครอบคลุม · หน้ากำไรรายวันเฉลี่ยเอง (ยอด ÷ จำนวนวันในเดือน)
-- ห้ามลบทิ้ง ใช้ voided_at เหมือน ingredient_purchases
CREATE TABLE expenses (
  id           SERIAL PRIMARY KEY,
  kind         TEXT NOT NULL,              -- ชื่อประเภทอิสระ (ค่าไฟ/ค่าน้ำ/...) เติมคลังตัวเลือกจากที่เคยบันทึก
  note         TEXT,
  total        NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  period_month DATE NOT NULL,
  voided_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_menu_item_addons_addon_id ON menu_item_addons(addon_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_completed_at ON orders(completed_at);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_purchases_purchased_at ON ingredient_purchases(purchased_at);
CREATE INDEX idx_purchases_voided_at ON ingredient_purchases(voided_at);
CREATE INDEX idx_expenses_period_month ON expenses(period_month);
CREATE INDEX idx_expenses_voided_at ON expenses(voided_at);

-- code ออเดอร์แบบ ORD-00000123 (คำนวณจาก id ตอน query ในฝั่ง backend)

-- ───────────────────────────── Seed เมนู (จาก Menu.md) ─────────────────────────────

-- กาแฟสด
INSERT INTO menu_items (name, price, category) VALUES
  ('เอสเพรสโซ่', 45, 'กาแฟสด'),
  ('คาปูชิโน่', 50, 'กาแฟสด'),
  ('ลาเต้', 45, 'กาแฟสด'),
  ('มอคค่า', 50, 'กาแฟสด'),
  ('อเมริกาโน่', 40, 'กาแฟสด'),
  ('อเมริกาโน่ น้ำส้ม', 50, 'กาแฟสด'),
  ('คาราเมลมัคคิโต้', 50, 'กาแฟสด'),
  ('มัจฉะลาเต้', 50, 'กาแฟสด');

-- เย็น
INSERT INTO menu_items (name, price, category) VALUES
  ('ชาไทย', 30, 'เย็น'),
  ('ชาเขียว', 35, 'เย็น'),
  ('น้ำผึ้งมะนาว', 45, 'เย็น'),
  ('ชามะนาว', 35, 'เย็น'),
  ('โกโก้นมสด', 35, 'เย็น'),
  ('นมชมพู', 30, 'เย็น'),
  ('โกโก้นมสดคาราเมล', 45, 'เย็น'),
  ('แดงมะนาวโซดา', 35, 'เย็น'),
  ('แดงโซดา', 30, 'เย็น'),
  ('น้ำมะนาว', 35, 'เย็น');

-- ปั่น
INSERT INTO menu_items (name, price, category) VALUES
  ('สตอเบอรี่ปั่น', 45, 'ปั่น'),
  ('สตอเบอรี่โยเกิร์ตปั่น', 50, 'ปั่น'),
  ('สตรอว์เบอร์รีนมสด', 50, 'ปั่น'),
  ('เอ็ม 100 ปีโป้ปั่น', 35, 'ปั่น'),
  ('ปังเย็น', 35, 'ปั่น'),
  ('โกโก้ปั่น', 40, 'ปั่น'),
  ('กล้วยโกโก้ปั่น', 45, 'ปั่น'),
  ('แตงโมปั่น', 40, 'ปั่น'),
  ('มะม่วงปั่น', 45, 'ปั่น'),
  ('มะม่วงสมูทตี้โยเกิร์ต', 50, 'ปั่น'),
  ('น้ำมะนาวปั่น', 40, 'ปั่น'),
  ('เสาวรสปั่น', 40, 'ปั่น'),
  ('สับปะรดปั่น', 40, 'ปั่น'),
  ('มะพร้าวปั่น', 40, 'ปั่น'),
  ('ชาไทยปั่น', 35, 'ปั่น'),
  ('ชาเขียวปั่น', 40, 'ปั่น');

-- add-on ไม่มี seed ตั้งต้น — admin เพิ่มเองผ่านหน้าจัดการเมนู
