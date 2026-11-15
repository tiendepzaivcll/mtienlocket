import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function ChatDialog({ title, onClose, busy = false, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return createPortal(
    <dialog ref={ref} aria-label={title}
      className="m-auto w-[calc(100%_-_2rem)] max-w-sm max-h-[80dvh] overflow-y-auto rounded-3xl bg-base-100 p-5 text-base-content shadow-xl backdrop:bg-black/40"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={(event) => { event.stopPropagation(); if (event.target === event.currentTarget && !busy) onClose(); }}
      onTouchStart={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold">{title}</h3>
        <button type="button" className="btn btn-circle btn-ghost btn-sm" aria-label="Đóng hộp thoại" disabled={busy} onClick={onClose}><X size={20} /></button>
      </div>
      {children}
    </dialog>, document.body,
  );
}
