// ปุ่มขยาย/ย่อรายการยาว (Design.md §6) — ใช้แทน scroll ซ้อน scroll
// ซ่อนตัวเองเมื่อรายการยังไม่เกิน limit เพราะไม่มีอะไรให้ขยาย
const ShowMore = ({ expanded, onToggle, total, limit, unit = 'รายการ', className = '' }) => {
  if (total <= limit) return null;

  return (
    <button
      onClick={onToggle}
      className={`w-full py-2.5 text-sm text-muted transition-colors hover:text-ink ${className}`}
    >
      {expanded ? `ดูน้อยลง (เหลือ ${limit} ${unit})` : `ดูทั้งหมด ${total} ${unit}`}
    </button>
  );
};

export default ShowMore;
