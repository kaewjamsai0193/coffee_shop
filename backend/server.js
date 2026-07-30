import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import menuRoutes from './routes/menu.js';
import orderRoutes from './routes/orders.js';
import reportRoutes from './routes/reports.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

// เสิร์ฟไฟล์รูปเมนู
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/menu', menuRoutes);
app.use('/orders', orderRoutes);
app.use('/reports', reportRoutes);

// error handler กลาง (คืน JSON ภาษาไทย)
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'เกิดข้อผิดพลาดบนเซิร์ฟเวอร์' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Coffee POS backend รันที่พอร์ต ${PORT}`));
