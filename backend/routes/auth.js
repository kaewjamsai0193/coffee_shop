import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';

const router = express.Router();

// POST /auth/login — admin เท่านั้น (ไม่มี public register)
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    }

    const { rows } = await query('SELECT * FROM admins WHERE username = $1', [username]);
    const admin = rows[0];
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

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
