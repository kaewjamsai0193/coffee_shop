import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';

// จำนวนออเดอร์ที่รอดำเนินการ — ใช้ร่วมกันระหว่าง Navbar / Orders / Order
// refresh() = ดึงใหม่ทันที (เรียกหลังสั่ง/กดเสร็จ ให้ badge เด้งทันที ไม่ต้องรอ poll)
const PendingContext = createContext({ count: 0, refresh: () => {} });

export const PendingProvider = ({ children }) => {
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    api.getPendingCount().then((d) => setCount(d.count)).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000); // fallback สำหรับออเดอร์ที่เข้ามาจากหน้าร้าน
    return () => clearInterval(t);
  }, [refresh]);

  return <PendingContext.Provider value={{ count, refresh }}>{children}</PendingContext.Provider>;
};

export const usePending = () => useContext(PendingContext);
