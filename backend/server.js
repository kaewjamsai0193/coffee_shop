import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import menuRoutes from './routes/menu.js';
import addonRoutes from './routes/addons.js';
import orderRoutes from './routes/orders.js';
import reportRoutes from './routes/reports.js';
import purchaseRoutes from './routes/purchases.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.disable('x-powered-by'); // ไม่ป่าวประกาศว่าเป็น Express

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

// เสิร์ฟไฟล์รูปเมนู
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/menu', menuRoutes);
app.use('/addons', addonRoutes);
app.use('/orders', orderRoutes);
app.use('/reports', reportRoutes);
app.use('/purchases', purchaseRoutes);

// error handler กลาง (คืน JSON ภาษาไทย)
// 500 = error ที่ไม่ได้ตั้งใจ (เช่นจาก DB) — log ไว้ฝั่ง server พอ ไม่ส่งรายละเอียดภายในออกไป
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  const message = status >= 500 ? 'เกิดข้อผิดพลาดบนเซิร์ฟเวอร์' : err.message || 'เกิดข้อผิดพลาด';
  res.status(status).json({ error: message });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Coffee POS backend รันที่พอร์ต ${PORT}`));
