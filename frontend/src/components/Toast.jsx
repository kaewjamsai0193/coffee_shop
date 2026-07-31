import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const ToastContext = createContext(null);

// toast ง่ายๆ ภาษาไทย — type: 'success' | 'error'
// วางไว้ขอบบนของจอ (Design.md §3) ต่ำพอที่จะไม่ทับแถบหัว/navbar
export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);
  const timer = useRef();

  const show = useCallback((message, type = 'success') => {
    setToast({ message, type });
    // เคลียร์ตัวเก่าก่อน ไม่งั้น toast ที่ขึ้นติดๆ กันจะถูกตัวแรกสั่งปิดก่อนเวลา
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <div className="pointer-events-none fixed left-1/2 top-20 z-50 w-full max-w-md -translate-x-1/2 px-4">
          <div
            className={`animate-toast-in rounded-lg px-4 py-2.5 text-center text-sm font-medium text-paper ${
              toast.type === 'error' ? 'bg-cherry' : 'bg-matcha'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
