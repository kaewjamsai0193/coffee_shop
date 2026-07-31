import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'menu');

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

// รับไฟล์ไว้ใน memory ก่อน แล้วค่อยให้ sharp จัดการ
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) return cb(null, true);
    cb(new Error('รองรับเฉพาะไฟล์รูป jpg, png หรือ webp เท่านั้น'));
  },
}).single('image');

// ตีตรา error จาก multer เป็น 400 พร้อมข้อความไทย — ไม่งั้น error handler กลางจะมองเป็น 500
export const uploadMenuImage = (req, res, next) =>
  upload(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') err = new Error('ไฟล์รูปต้องไม่เกิน 5MB');
    err.status = 400;
    next(err);
  });

// crop เป็นสี่เหลี่ยมจัตุรัส 600x600 + แปลงเป็น webp → เซฟลงดิสก์
// คืน relative path สำหรับเก็บใน DB (เช่น /uploads/menu/12.webp)
export const processAndSaveImage = async (buffer, menuItemId) => {
  const filename = `${menuItemId}.webp`;
  const filepath = path.join(UPLOAD_DIR, filename);
  await sharp(buffer)
    .resize(600, 600, { fit: 'cover', position: 'centre' })
    .webp({ quality: 82 })
    .toFile(filepath);
  return `/uploads/menu/${filename}`;
};
