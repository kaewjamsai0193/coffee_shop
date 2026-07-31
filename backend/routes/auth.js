import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';

const router = express.Router();

// กันเดารหัสผ่าน: ล้มเหลวเกิน MAX_FAIL ครั้งในช่วง WINDOW_MS → บล็อก IP นั้นชั่วคราว
// เก็บใน memory พอ (รีสตาร์ทแล้วรีเซ็ต — ยอมรับได้ เพราะแค่ถ่วงเวลา brute force)
const MAX_FAIL = 10;
const WINDOW_MS = 15 * 60 * 1000;
const failures = new Map(); // ip → { count, resetAt }

// อยู่หลัง nginx — ใช้ X-Real-IP ที่ nginx ตั้งให้ (backend ไม่เปิดออก public ใน prod)
const ipOf = (req) => req.headers['x-real-ip'] || req.ip;

const isBlocked = (ip) => {
  const f = failures.get(ip);
  if (!f) return false;
  if (Date.now() > f.resetAt) {
    failures.delete(ip);
    return false;
  }
  return f.count >= MAX_FAIL;
};

const recordFailure = (ip) => {
  const f = failures.get(ip);
  if (!f || Date.now() > f.resetAt) {
    failures.set(ip, { count: 1, resetAt: Date.now() + WINDOW_MS });
  } else {
    f.count += 1;
  }
  // กัน map โตไม่จำกัดจาก IP ปลอมจำนวนมาก
  if (failures.size > 10000) failures.clear();
};

// POST /auth/login — admin เท่านั้น (ไม่มี public register)
router.post('/login', async (req, res, next) => {
  try {
    const ip = ipOf(req);
    if (isBlocked(ip)) {
      return res.status(429).json({ error: 'พยายามเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่' });
    }

    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    }

    const { rows } = await query('SELECT * FROM admins WHERE username = $1', [username]);
    const admin = rows[0];
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      recordFailure(ip);
      return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }
    failures.delete(ip);

    const token = jwt.sign(
      { sub: admin.id, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
    );

    res.json({ token, username: admin.username });
  } catch (err) {
    next(err);
  }
});

export default router;
