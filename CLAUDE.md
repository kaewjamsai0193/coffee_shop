# Coffee POS — Project Instructions

## Overview
ระบบ POS สำหรับร้านกาแฟ
- **หน้าสั่งสินค้า** เป็น public — ใครก็สั่งได้ **ไม่ต้อง login** (ให้พนักงาน/บาริสต้าแตะสั่งได้ทันทีเหมือนเครื่อง POS หน้าร้าน)
- **admin** (เจ้าของร้าน/ผู้จัดการ) ต้อง login ผ่านทางลับ เพื่อปลดล็อก: จัดการเมนู, ยืนยันออเดอร์เสร็จ, และดู Dashboard ยอดขาย

มี role เดียวในระบบคือ `admin` (มีได้หลายคน) — ไม่มี role `user` ในฐานข้อมูล

## Stack
- Frontend: React (Vite) + TailwindCSS
- Backend: Node.js + Express
- Database: PostgreSQL (ผ่าน `pg`, ไม่ใช้ ORM)
- Auth: JWT + bcrypt (เฉพาะ admin)
- Image: `multer` (รับไฟล์) + `sharp` (resize/crop/แปลง webp)

## Commands
### แนะนำ: Docker (ครบทั้ง stack — db + backend + frontend)
- รันทั้งหมด: `docker compose up -d --build`
- เปิดใช้งาน: **หน้าสั่งสินค้า** http://localhost:8080 · **admin** http://localhost:8080/admin
- admin ตั้งต้น: `admin` / `admin1234` (แก้ได้ที่ env `ADMIN_USERNAME`/`ADMIN_PASSWORD` ใน `docker-compose.yml`)
- db + seed (34 เมนู) โหลดอัตโนมัติจาก `backend/schema.sql`, admin ถูกสร้างอัตโนมัติตอน backend สตาร์ท
- ดู log: `docker compose logs -f backend` · ปิด: `docker compose down` (ลบข้อมูลด้วย: `docker compose down -v`)

### รันแยกแบบ local (ไม่ใช้ docker)
- Backend: `cd backend && npm install && npm run dev` (ต้องมี `.env` — คัดลอกจาก `.env.example`)
- Frontend: `cd frontend && npm install && npm run dev` (เปิด http://localhost:5173)
- Setup DB: `createdb coffee_pos && psql -d coffee_pos -f backend/schema.sql` แล้ว `npm run create-admin`

## Auth & Access (สำคัญ — ห้ามเปลี่ยนโดยไม่ถาม)
- หน้าสั่งสินค้า (`/`) เปิด public ไม่มี auth guard — เรียก API `GET /menu` และ `POST /orders` ได้โดยไม่ต้องมี token
- ทางเข้า admin: URL `/admin` (มีไอคอนเล็ก ๆ มุมจอเป็นทางลัด ไม่เด่น) → หน้า login
- ทุก endpoint ที่เป็นการจัดการ (จัดการเมนู, ยืนยันออเดอร์, reports) ต้องผ่าน middleware ตรวจ JWT + role `admin`
- ไม่มีหน้า/ปุ่ม login โผล่ให้ผู้ใช้ทั่วไปเห็นในหน้าสั่งสินค้า

## Order Flow (สำคัญ — ห้ามเปลี่ยนโดยไม่ถาม)
1. ผู้ใช้เลือกเมนู → กดสั่ง → order ถูกสร้างด้วย `status = 'pending'` (ไม่ต้อง login)
2. ออเดอร์ที่ pending ทั้งหมดไปโผล่ที่หน้า **Orders** (เหมือนบอร์ดใบสั่งในครัว) — เฉพาะ admin เข้าดูได้
3. เฉพาะ **admin** เท่านั้นที่กด "เสร็จแล้ว" ได้ → status เปลี่ยนเป็น `completed`, บันทึก `completed_at`
4. ออเดอร์ completed จะหายจากหน้า Orders และไปนับรวมในหน้า **Dashboard** (ยอดขายวัน/เดือน/ปี)

## Menu Management (admin เท่านั้น)
- admin เพิ่ม / แก้ไข (ชื่อ, ราคา, หมวด, รูป) / ปิดขาย เมนูได้ผ่านหน้า **Menu Manage**
- **ห้ามลบเมนูออกจาก DB** (จะทำให้ประวัติออเดอร์เก่าเสีย) — ใช้ `is_available = false` เพื่อ "ปิดขาย" แทน
- เมนูที่ `is_available = false` จะไม่โผล่ในหน้าสั่งสินค้า แต่ยังอยู่ใน DB และในออเดอร์เก่า
- ข้อมูลเมนูตั้งต้น seed จาก `Menu.md` ลง `schema.sql` (หมวด: กาแฟสด, เย็น, ปั่น)

## Menu Images (ดู Design.md §7 สำหรับ visual spec)
- เก็บเป็น **ไฟล์บนดิสก์** ที่ `backend/uploads/menu/` — DB เก็บแค่ `menu_items.image_url` (relative path เช่น `/uploads/menu/12.webp`)
- ตอนอัปโหลด: `multer` รับไฟล์ (จำกัด jpg/png/webp, ≤ 5MB) → `sharp` **crop เป็นสี่เหลี่ยมจัตุรัส + resize เป็น 600×600 + แปลงเป็น webp** แล้วค่อยเซฟ (ฟิกขนาดตายตัว ไม่ให้รูปเพี้ยน layout)
- serve ผ่าน `express.static('/uploads')`
- **Fallback เมื่อไม่มีรูป** (`image_url` เป็น null): แสดงการ์ดสีตามหมวด + emoji แทน (ดู mapping ใน Design.md §7) ไม่ใช่รูป broken

## Add-on / เพิ่มพิเศษ
โครงสร้าง 2 ชั้น: **คลังกลาง** (`addons`) + **เลือกเปิดใช้รายเมนู** (`menu_item_addons` many-to-many)
- **คลังกลาง** — ปุ่ม "จัดการ Add-on" ข้างปุ่ม "+ เพิ่มเมนู" หน้า Menu Manage → popup เพิ่ม/แก้/ลบ ชื่อ+ราคา (มีผลทันทีทีละรายการ เพราะเมนูหลายอันอ้าง id เดิม)
- **รายเมนู** — ในฟอร์มแก้ไขเมนูมีลิสต์ให้ติ๊กว่าเมนูนี้ใช้ add-on ตัวไหนบ้าง (ยังไม่มีผลจนกดบันทึก) ส่งผ่าน `PUT /menu/:id/addons` body `{ addon_ids: [] }` — แทนที่ทั้งชุด แก้แค่ตารางเชื่อม ไม่แตะคลัง
- แก้ชื่อ/ราคาในคลังมีผลกับทุกเมนูที่เปิดใช้ตัวนั้น · ลบจากคลังแล้วหลุดจากทุกเมนูด้วย (`ON DELETE CASCADE`)
- `GET /menu` และ `/menu/all` แนบ `addons: [{id, name, price}]` ของเมนูนั้นมาให้แล้ว หน้าสั่งสินค้าไม่ต้องยิง API แยก · `GET /addons` (admin) คืนคลังทั้งหมด + `menu_count`
- ผู้สั่งติ๊กเลือกได้หลายรายการใน popup เลือกเมนู คิดราคาต่อแก้ว — ตะกร้าแยกบรรทัดตามชุด add-on ที่เลือก
- ลบ add-on จริงได้ (ต่างจากเมนู) เพราะตอนสั่งระบบ snapshot ชื่อ+ราคาลง `order_items.addons` (JSONB) และผลรวมลง `order_items.addons_total` แล้ว ไม่มี FK ย้อนกลับ ประวัติออเดอร์ไม่เสีย
- ตอนสั่ง backend ตรวจว่า add-on เป็นตัวที่เมนูนั้นเปิดใช้จริง (join `menu_item_addons`) กันสลับ add-on ข้ามเมนู
- ราคาบรรทัดในออเดอร์ = `(price + addons_total) × qty` — ทุก query ยอดขาย/รายงานต้องใช้สูตรนี้ (orders board, summary, sales, profit)
- `breakdown` ในหน้า Dashboard ("ขายอะไรไปบ้าง") นับเฉพาะเมนู ใช้ `oi.price` ล้วน — **ห้ามเอา add-on ไปปนในอันดับเมนู** และไม่ต้องมีหัวข้อสรุปยอด add-on แยก (ผลรวมของ breakdown จึงน้อยกว่ายอดขายรวมตามจำนวนเงินค่า add-on ซึ่งตั้งใจให้เป็นแบบนั้น)
- แสดงรายการ add-on ใต้ชื่อเมนูเป็น **บรรทัดละรายการ ขึ้นต้นด้วย `-`** (รูปแบบ `ชื่อเมนู ×จำนวน` แล้วตามด้วยบรรทัด `- ชื่อ add-on`)
- ในหน้า Orders/Dashboard **แต่ละบรรทัดโชว์ราคาของตัวเอง**: บรรทัดเมนู = `price × qty` (ราคาเมนูล้วน), บรรทัด add-on = `addon.price × qty` — ไปรวมกันที่บรรทัด "รวม" ของออเดอร์เท่านั้น ดังนั้น `/reports/sales` ต้องส่ง `items[].price` เป็นราคาเมนูล้วน (ห้ามบวก `addons_total` มาให้)
- DB เดิมที่มีข้อมูลแล้วต้องรัน `backend/migrations/2026-08-02_addons.sql` (schema.sql ใช้กับ DB ใหม่เท่านั้น)

## Business Rules
- ห้ามลบออเดอร์ทิ้ง ใช้สถานะ `cancelled` แทน — admin กด "ยกเลิก" ในหน้า Orders ได้ (`PATCH /orders/:id/cancel`), ออเดอร์ที่ยกเลิกไม่นับเป็นยอดขาย
- ทุก action ที่มีผล (เลือกเมนู, ยืนยันสั่ง, เสร็จแล้ว, ยกเลิก) ต้องมี popup ยืนยันก่อน — ใช้ `useConfirm()` จาก `components/Confirm.jsx`
- ราคาสินค้าคำนวณจาก `menu_items.price` ณ เวลาที่สั่ง แล้ว snapshot ลง `order_items.price` (ไม่อ้างอิงราคาปัจจุบันย้อนหลัง — สำคัญเพราะ admin แก้ราคาได้)
- ยอดขายในหน้า Dashboard นับจาก `completed_at` เท่านั้น ไม่ใช่ `created_at`

## Folder Structure
```
coffee-pos/
├── backend/
│   ├── server.js
│   ├── db.js
│   ├── schema.sql          # schema + seed data (จาก Menu.md)
│   ├── uploads/menu/       # ไฟล์รูปเมนู (ไม่ commit เข้า repo, gitignore)
│   ├── routes/             # auth, menu, orders, reports
│   └── middleware/auth.js  # JWT verify + role check (admin)
└── frontend/
    └── src/
        ├── pages/
        │   ├── Order.jsx        # public — หน้าสั่งสินค้า (default route /)
        │   ├── AdminLogin.jsx   # /admin (ทางลับ)
        │   ├── MenuManage.jsx   # admin — จัดการเมนู + อัปโหลดรูป
        │   ├── Orders.jsx       # admin — บอร์ดครัว
        │   └── Dashboard.jsx    # admin — ยอดขาย
        ├── components/
        └── context/AuthContext.jsx
```

## Design Reference
ดู `Design.md` สำหรับ color token, typography, component pattern, และ spec รูป/fallback (§7) — ทุกหน้าที่สร้างใหม่ต้องอ้างอิงไฟล์นี้ ห้ามใช้สี/ฟอนต์ที่ไม่ได้ประกาศไว้

## Conventions
- ข้อความในระบบทั้งหมดเป็นภาษาไทย (label, error message, toast)
- ใช้ arrow function เสมอ
- ราคาแสดงผลทศนิยม 2 ตำแหน่งเสมอ (`55.00 ฿`)
- ห้าม commit ไฟล์ `.env` จริงเข้า repo (มีแค่ `.env.example`)
- ห้าม commit ไฟล์รูปใน `backend/uploads/` เข้า repo
