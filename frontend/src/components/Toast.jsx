import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

// toast ง่ายๆ ภาษาไทย — type: 'success' | 'error'
export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);

  const show = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div
            className={`rounded px-4 py-2 text-sm font-medium text-paper shadow-lg ${
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
