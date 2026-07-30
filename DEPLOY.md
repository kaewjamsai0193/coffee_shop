# Deploy ขึ้น VPS (Docker, HTTP port 80)

คู่มือนำ Coffee POS ขึ้น VPS ด้วย Docker Compose แบบ HTTP port 80 (เพิ่ม HTTPS ทีหลังได้ — ดูท้ายไฟล์)

## 1. สิ่งที่ต้องมีบน VPS
- Docker + Docker Compose plugin
  ```bash
  curl -fsSL https://get.docker.com | sh
  ```
- เปิด firewall เฉพาะพอร์ตที่ใช้ (SSH + HTTP)
  ```bash
  ufw allow 22
  ufw allow 80
  ufw enable
  ```

## 2. เอาโค้ดขึ้น VPS
```bash
git clone <repo-url> coffee-pos    # หรือ scp โฟลเดอร์ขึ้นไป
cd coffee-pos
```

## 3. ตั้งค่า secrets
```bash
cp .env.example .env
nano .env
```
กรอกให้ครบ (อย่าใช้ค่า default):
- `POSTGRES_PASSWORD` — รหัสผ่าน DB ที่คาดเดายาก
- `JWT_SECRET` — สร้างด้วย `openssl rand -hex 32`
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — บัญชี admin คนแรก
- `CLIENT_ORIGIN` — `http://<ไอพี-VPS>` (หรือโดเมน)

## 4. รัน
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
- DB สร้าง schema + seed เมนู 34 รายการอัตโนมัติ (เฉพาะครั้งแรก)
- admin ถูกสร้างอัตโนมัติจากค่าใน `.env`
- ตรวจสถานะ: `docker compose -f docker-compose.prod.yml ps`
- ดู log: `docker compose -f docker-compose.prod.yml logs -f backend`

## 5. เข้าใช้งาน
- หน้าร้าน: `http://<ไอพี-VPS>`
- admin: `http://<ไอพี-VPS>/admin`

## สถาปัตยกรรม (production)
```
Internet ──▶ :80  frontend (nginx)
                    ├── /            เสิร์ฟไฟล์ static (React build)
                    ├── /api/   ─▶ backend:4000   (docker network)
                    └── /uploads/ ─▶ backend:4000
                                       └─▶ db:5432 (docker network)
```
- **db และ backend ไม่เปิดพอร์ตออก host** — เข้าถึงได้เฉพาะภายใน docker network (ปลอดภัยกว่า)
- ข้อมูลถาวรใน named volume: `db_data` (ฐานข้อมูล), `uploads` (รูปเมนู)
- ทุก service ตั้ง `restart: unless-stopped` — รีบูต VPS แล้วกลับมาเองอัตโนมัติ

## อัปเดตเวอร์ชันใหม่
```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```
ข้อมูลใน volume ไม่หาย (schema.sql รันเฉพาะตอน DB ยังว่างครั้งแรกเท่านั้น)

## Backup / Restore
```bash
# backup ฐานข้อมูล
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U "$POSTGRES_USER" coffee_pos > backup_$(date +%F).sql

# backup รูปเมนู
docker run --rm -v coffee-pos_uploads:/data -v "$PWD":/out alpine \
  tar czf /out/uploads_$(date +%F).tar.gz -C /data .
```

## เพิ่ม HTTPS ทีหลัง (เมื่อมีโดเมน)
ชี้ A record ของโดเมนมาที่ IP ของ VPS แล้วเลือกทางใดทางหนึ่ง:
- **ง่ายสุด**: วาง Caddy/Traefik เป็น reverse proxy หน้า frontend (ออก SSL อัตโนมัติจาก Let's Encrypt) แล้วเปลี่ยน frontend ให้ฟังพอร์ตภายใน (`127.0.0.1:8080` แทน `80:80`)
- อัปเดต `CLIENT_ORIGIN` ใน `.env` เป็น `https://your-domain.com` แล้ว `up -d` ใหม่

บอกได้ครับถ้าต้องการให้เพิ่ม service Caddy สำหรับ HTTPS อัตโนมัติ

## หมายเหตุความปลอดภัย
- อย่า commit `.env` (อยู่ใน `.gitignore` แล้ว)
- เปลี่ยนรหัส admin ทันทีหลัง deploy ถ้าตั้งไว้ชั่วคราว
- อย่าเปิดพอร์ต 4000 / 5432 ออก public (compose นี้ไม่เปิดอยู่แล้ว)
