import { useEffect } from 'react';

let locks = 0; // นับ popup ที่ซ้อนกัน (เช่น Confirm เปิดทับ popup จัดการ add-on)
let savedY = 0;

// ล็อกไม่ให้พื้นหลังเลื่อนตอนเปิด popup
// บน iPad/Safari การลากบน overlay จะไปเลื่อน body ข้างหลังแทน ทำให้ตำแหน่งที่เห็น
// กับที่แตะจริงไม่ตรงกัน — `overflow: hidden` อย่างเดียวเอาไม่อยู่ ต้อง fix ตำแหน่ง body
export const useBodyScrollLock = (active) => {
  useEffect(() => {
    if (!active) return;

    if (locks === 0) {
      savedY = window.scrollY;
      const { style } = document.body;
      style.position = 'fixed';
      style.top = `-${savedY}px`;
      style.left = '0';
      style.right = '0';
    }
    locks += 1;

    return () => {
      locks -= 1;
      if (locks === 0) {
        const { style } = document.body;
        style.position = '';
        style.top = '';
        style.left = '';
        style.right = '';
        window.scrollTo(0, savedY); // คืนตำแหน่งเดิม ไม่ให้หน้ากระโดดขึ้นบนสุด
      }
    };
  }, [active]);
};
