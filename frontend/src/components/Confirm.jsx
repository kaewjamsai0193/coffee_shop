import { createContext, useCallback, useContext, useRef, useState } from 'react';

// popup ยืนยันแบบ reusable — เรียก const confirm = useConfirm(); const ok = await confirm({...})
const ConfirmContext = createContext(() => Promise.resolve(false));

export const ConfirmProvider = ({ children }) => {
  const [opts, setOpts] = useState(null); // { title, message, confirmText, cancelText, danger }
  const resolver = useRef(null);

  const confirm = useCallback(
    (o) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setOpts(o);
      }),
    []
  );

  const close = (result) => {
    setOpts(null);
    resolver.current?.(result);
    resolver.current = null;
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-grounds/40 px-4"
          onClick={() => close(false)}
        >
          <div className="ticket w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 font-display text-xl text-grounds">{opts.title}</h2>
            {opts.message && <div className="mb-5 text-sm text-grounds/70">{opts.message}</div>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => close(false)}
                className="rounded px-4 py-2 text-sm text-grounds/60 hover:text-grounds"
              >
                {opts.cancelText || 'ยกเลิก'}
              </button>
              <button
                onClick={() => close(true)}
                className={`rounded px-5 py-2 text-sm font-medium transition-transform duration-100 active:scale-95 ${
                  opts.danger ? 'bg-cherry text-paper' : 'bg-marigold text-grounds'
                }`}
              >
                {opts.confirmText || 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => useContext(ConfirmContext);
