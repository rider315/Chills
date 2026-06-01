import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type, duration }]);
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
    return id;
  }, [removeToast]);

  const toast = useCallback({
    success: (msg, dur) => addToast(msg, 'success', dur),
    error:   (msg, dur) => addToast(msg, 'error', dur),
    info:    (msg, dur) => addToast(msg, 'info', dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
  }, [addToast]);

  // Wrap toast methods so they're stable
  const contextValue = useRef(null);
  if (!contextValue.current) {
    contextValue.current = {
      addToast,
      removeToast,
      success: (msg, dur) => addToast(msg, 'success', dur),
      error:   (msg, dur) => addToast(msg, 'error', dur),
      info:    (msg, dur) => addToast(msg, 'info', dur),
      warning: (msg, dur) => addToast(msg, 'warning', dur),
    };
  }
  // Update refs
  contextValue.current.addToast = addToast;
  contextValue.current.removeToast = removeToast;

  return (
    <ToastContext.Provider value={contextValue.current}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }) {
  const [exiting, setExiting] = useState(false);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(onDismiss, 280);
  };

  const typeConfig = {
    success: { icon: '✓', bg: 'bg-neo-green' },
    error: { icon: '✕', bg: 'bg-neo-red text-bw' },
    info: { icon: 'ℹ', bg: 'bg-neo-blue text-bw' },
    warning: { icon: '⚠', bg: 'bg-neo-yellow' },
  };

  const config = typeConfig[toast.type] || typeConfig.info;

  return (
    <div className={`card-neo flex items-center gap-3 p-4 min-w-[300px] border-4 pointer-events-auto transition-all duration-300 ${config.bg} ${exiting ? 'opacity-0 translate-x-10' : 'animate-slideUp'}`}>
      <div className="text-xl font-black">{config.icon}</div>
      <div className="flex-1 font-bold">{toast.message}</div>
      <button className="text-xl font-black opacity-70 hover:opacity-100 transition-opacity" onClick={handleDismiss}>✕</button>
      {toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 h-1 bg-bw/50" style={{ width: '100%', animation: `shrink ${toast.duration}ms linear forwards` }} />
      )}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

export default ToastProvider;
