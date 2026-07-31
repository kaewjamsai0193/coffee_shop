# glibc base (bookworm-slim) — มี prebuilt binaries ของ bcrypt/sharp ไม่ต้อง compile
FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# uploads เป็น volume (mount ทับตอน run) + ทำ entrypoint ให้ execute ได้
RUN mkdir -p uploads/menu && chmod +x docker-entrypoint.sh

EXPOSE 4000

# รอ DB พร้อม → สร้าง admin (idempotent) → สตาร์ท server
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
