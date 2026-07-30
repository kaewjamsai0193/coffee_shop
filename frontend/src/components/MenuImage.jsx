// รูปเมนู: กรอบ 1:1 เสมอ (Design.md §7). ไม่มีรูป → fallback emoji + สีตามหมวด
const FALLBACK = {
  'กาแฟสด': { emoji: '☕', bg: 'bg-grounds/10', fg: 'text-grounds' },
  'เย็น': { emoji: '🧊', bg: 'bg-matcha/10', fg: 'text-matcha' },
  'ปั่น': { emoji: '🥤', bg: 'bg-marigold/15', fg: 'text-marigold' },
};

const MenuImage = ({ imageUrl, category, className = '' }) => {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={`aspect-square w-full rounded object-cover ${className}`}
      />
    );
  }

  const fb = FALLBACK[category] || FALLBACK['กาแฟสด'];
  return (
    <div
      className={`flex aspect-square w-full items-center justify-center rounded ${fb.bg} ${className}`}
    >
      <span className={`text-5xl ${fb.fg}`}>{fb.emoji}</span>
    </div>
  );
};

export default MenuImage;
