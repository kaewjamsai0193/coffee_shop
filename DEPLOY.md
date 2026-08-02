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
ข้อมูลใน volume ไม่หาย — แต่ **`schema.sql` รันเฉพาะตอน DB ว่างครั้งแรกเท่านั้น** ถ้าเวอร์ชันใหม่มีการเปลี่ยนโครงสร้างตาราง
ต้องรันไฟล์ใน `backend/migrations/` เองก่อน `up -d --build` (ไม่งั้น backend ใหม่จะ query ตารางที่ยังไม่มี)

```bash
cd ~/coffee-pos
git pull

# โหลดค่าจาก .env มาใช้ในเชลล์ (ให้ $POSTGRES_USER / $POSTGRES_DB ใช้งานได้)
set -a; . ./.env; set +a

# 1) สำรอง DB ก่อนเสมอ
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup_$(date +%F).sql

# 2) รัน migration ที่ยังไม่เคยรัน (ทุกไฟล์ปลอดภัยกับข้อมูลเดิมและรันซ้ำได้)
for f in backend/migrations/*.sql; do
  echo "== $f"
  docker compose -f docker-compose.prod.yml exec -T db \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 < "$f"
done

# 3) build + restart
docker compose -f docker-compose.prod.yml up -d --build

# 4) ตรวจว่าขึ้นปกติ
docker compose -f docker-compose.prod.yml ps
curl -s localhost/api/health
docker compose -f docker-compose.prod.yml logs --tail 30 backend
```

> ถ้า migration พังกลางทาง ให้ restore จากไฟล์ backup:
> `docker compose -f docker-compose.prod.yml exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < backup_YYYY-MM-DD.sql`

### migration ที่มีอยู่
| ไฟล์ | เพิ่มอะไร |
|---|---|
| `2026-08-02_addons.sql` | ตาราง `addons`, `menu_item_addons` + คอลัมน์ `order_items.addons` / `addons_total` (ระบบ add-on) |

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
