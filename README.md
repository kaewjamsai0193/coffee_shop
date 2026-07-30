# Coffee POS ☕

ระบบ POS สำหรับร้านกาแฟ — หน้าสั่งสินค้าเปิด public (ไม่ต้อง login), admin จัดการเมนู/ยืนยันออเดอร์/ดูยอดขายได้

## Stack
- **Frontend**: React (Vite) + TailwindCSS
- **Backend**: Node.js + Express
- **Database**: PostgreSQL (ผ่าน `pg`, ไม่ใช้ ORM)
- **Auth**: JWT + bcrypt (เฉพาะ admin)
- **Deploy**: Docker Compose

## เริ่มใช้งานเร็วสุด (Docker)
```bash
docker compose up -d --build
```
- หน้าร้าน: http://localhost:8080
- admin: http://localhost:8080/admin  (ค่าเริ่มต้น `admin` / `admin1234`)

DB + seed เมนู 34 รายการ และ admin ถูกสร้างให้อัตโนมัติ

## รันแยกแบบ local (ไม่ใช้ Docker)
```bash
# backend
cd backend && cp .env.example .env   # แก้ค่าใน .env ก่อน
npm install && npm run dev
npm run create-admin                 # สร้าง admin คนแรกจาก .env

# frontend
cd frontend && npm install && npm run dev   # http://localhost:5173
```
ต้องมี PostgreSQL: `createdb coffee_pos && psql -d coffee_pos -f backend/schema.sql`

## ฟีเจอร์หลัก
- 🧾 สั่งสินค้า: เลือกเมนู (มี popup เลือกจำนวน + รูป), ตะกร้าแบบใบเสร็จ, ยืนยันสั่ง
- 👨‍🍳 บอร์ดออเดอร์ในครัว: กด "เสร็จแล้ว" / "ยกเลิก" (มี badge แจ้งจำนวนออเดอร์ค้าง)
- 🍹 จัดการเมนู (admin): เพิ่ม/แก้/ปิดขาย + อัปโหลดรูป (ย่อเป็น 600×600 webp อัตโนมัติ)
- 📊 ยอดขาย: เลือกดูรายวัน/เดือน/ปี + สรุปว่าขายอะไรไปบ้าง

## เอกสารเพิ่มเติม
- [`DEPLOY.md`](./DEPLOY.md) — วิธี deploy ขึ้น VPS ด้วย Docker
- [`Design.md`](./Design.md) — design system (สี, ฟอนต์, component)
- [`CLAUDE.md`](./CLAUDE.md) — โครงสร้างโปรเจกต์ + business rules

## โครงสร้าง
```
backend/    Express API (routes, middleware, schema.sql)
frontend/   React app (pages, components, context)
docker-compose.yml         dev stack
docker-compose.prod.yml    production stack (สำหรับ VPS)
```
