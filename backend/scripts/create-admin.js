// สร้าง admin คนแรกจากค่าใน .env (ADMIN_USERNAME / ADMIN_PASSWORD)
// รัน: npm run create-admin
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import pool from '../db.js';

dotenv.config();

const run = async () => {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.error('❌ ต้องตั้งค่า ADMIN_USERNAME และ ADMIN_PASSWORD ใน .env ก่อน');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `INSERT INTO admins (username, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (username) DO NOTHING
     RETURNING id`,
    [username, hash]
  );

  if (result.rowCount === 0) {
    console.log(`ℹ️  มี admin ชื่อ "${username}" อยู่แล้ว ไม่ได้สร้างใหม่`);
  } else {
    console.log(`✅ สร้าง admin "${username}" สำเร็จ (id=${result.rows[0].id})`);
  }

  await pool.end();
};

run().catch((err) => {
  console.error('❌ สร้าง admin ไม่สำเร็จ:', err);
  process.exit(1);
});
