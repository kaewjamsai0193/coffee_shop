// รูปเมนู: กรอบ 1:1 เสมอ (Design.md §7). ไม่มีรูป → fallback emoji บนพื้น surface
const FALLBACK = {
  'กาแฟสด': '☕',
  'เย็น': '🧊',
  'ปั่น': '🥤',
};

// size: 'lg' = การ์ดเมนู/popup, 'sm' = รูปย่อในตะกร้า
const MenuImage = ({ imageUrl, category, className = '', size = 'lg' }) => {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={`aspect-square w-full rounded-lg object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex aspect-square w-full items-center justify-center rounded-lg bg-surface ${className}`}
    >
      <span className={size === 'sm' ? 'text-xl' : 'text-5xl'}>{FALLBACK[category] || '☕'}</span>
    </div>
  );
};

export default MenuImage;
