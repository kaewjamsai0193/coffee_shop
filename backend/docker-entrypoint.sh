#!/bin/sh
set -e

echo "⏳ รอฐานข้อมูลพร้อม แล้วสร้าง admin..."
until node scripts/create-admin.js; do
  echo "   DB ยังไม่พร้อม ลองใหม่ใน 2 วินาที..."
  sleep 2
done

echo "🚀 เริ่ม backend"
exec node server.js
