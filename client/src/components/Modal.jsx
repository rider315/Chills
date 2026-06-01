import React, { useEffect, useRef } from 'react';

export default function Modal({ isOpen, onClose, title, children, footer }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="card-neo w-full max-w-lg max-h-[90vh] bg-bw border-4 flex flex-col p-0 shadow-neolg overflow-hidden animate-slideUp">
        <div className="flex items-center justify-between p-4 border-b-4 border-border bg-neo-yellow">
          <h3 className="text-xl font-black">{title}</h3>
          <button className="w-8 h-8 flex items-center justify-center font-black text-xl hover:bg-bw border-2 border-transparent hover:border-border rounded-full transition-colors" onClick={onClose}>✕</button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
        {footer && <div className="p-4 border-t-4 border-border bg-gray-50 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}
