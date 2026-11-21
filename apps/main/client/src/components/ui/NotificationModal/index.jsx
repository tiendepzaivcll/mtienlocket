import React, { useEffect } from "react";
import { Bell, X } from "lucide-react";
import { TbPinned } from "react-icons/tb";
import { useNotificationStore } from "@/stores/useNotificationStore";
import "@/components/ui/FloatingWidget/styles.css";

function parseMessage(text = "") {
  const parts = String(text).split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) => {
    if (/^https?:\/\//i.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-400 font-semibold underline hover:text-amber-300 transition-colors"
        >
          {part}
        </a>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

/**
 * Chuông thông báo dành riêng cho thanh Header của màn hình Camera (Locket)
 * Đặt ngay cạnh nút Rollcall / X ở góc trên bên trái
 */
export const NotificationBellCamera = () => {
  const unread = useNotificationStore((s) => s.unread);
  const isShaking = useNotificationStore((s) => s.isShaking);
  const openModal = useNotificationStore((s) => s.openModal);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    window.addEventListener("focus", fetchNotifications);
    window.addEventListener("mtien-notifications-updated", fetchNotifications);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", fetchNotifications);
      window.removeEventListener("mtien-notifications-updated", fetchNotifications);
    };
  }, [fetchNotifications]);

  const unreadCount = unread.length;

  return (
    <button
      type="button"
      onClick={openModal}
      className="relative w-[38px] h-[38px] flex items-center justify-center bg-[var(--surface-pill)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:opacity-90 rounded-full active:scale-95 transition shadow-sm cursor-pointer pointer-events-auto shrink-0"
      aria-label="Thông báo hệ thống"
      title="Thông báo hệ thống"
    >
      <Bell
        size={18}
        strokeWidth={2.2}
        className={isShaking ? "shake-animation" : ""}
      />
      {unreadCount > 0 && (
        <span
          data-testid="notification-camera-badge"
          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-black text-[10px] font-black flex items-center justify-center ring-2 ring-black shadow-xs animate-in zoom-in duration-200"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
};

/**
 * Chuông thông báo dành cho thanh điều hướng Trang chủ Web
 */
export const NotificationBellHeader = () => {
  const unread = useNotificationStore((s) => s.unread);
  const isShaking = useNotificationStore((s) => s.isShaking);
  const openModal = useNotificationStore((s) => s.openModal);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    window.addEventListener("focus", fetchNotifications);
    window.addEventListener("mtien-notifications-updated", fetchNotifications);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", fetchNotifications);
      window.removeEventListener("mtien-notifications-updated", fetchNotifications);
    };
  }, [fetchNotifications]);

  const unreadCount = unread.length;

  return (
    <button
      type="button"
      onClick={openModal}
      className="mtien-bell-trigger"
      aria-label="Thông báo hệ thống"
      title="Thông báo hệ thống"
    >
      <Bell
        size={19}
        className={isShaking ? "shake-animation" : ""}
      />
      {unreadCount > 0 && (
        <span
          data-testid="notification-header-badge"
          className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#f5c542] text-black text-[10px] font-black flex items-center justify-center ring-2 ring-[#101418] shadow-xs"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
};

/**
 * Modal hiển thị danh sách các thông báo từ Admin
 */
export const NotificationModal = () => {
  const isOpen = useNotificationStore((s) => s.isOpen);
  const closeModal = useNotificationStore((s) => s.closeModal);
  const notifications = useNotificationStore((s) => s.notifications);
  const isLoading = useNotificationStore((s) => s.isLoading);
  const loadError = useNotificationStore((s) => s.loadError);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) closeModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeModal]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
      onClick={closeModal}
    >
      <div
        className="relative w-full max-w-lg bg-[#14181d] border border-[#262e38] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] text-[#e8ecf0] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 py-4 flex items-center justify-between border-b border-[#262e38] bg-[#1a2027]/70 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 id="notification-modal-title" className="text-lg font-bold tracking-tight text-white">
                Thông báo LOCKET-PRO
              </h2>
              <p className="text-xs text-neutral-400">Cập nhật tin tức & tính năng mới</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Đóng thông báo"
            onClick={closeModal}
            className="w-9 h-9 rounded-full bg-neutral-800/80 hover:bg-neutral-700 active:scale-95 text-neutral-300 hover:text-white flex items-center justify-center transition border border-neutral-700/60 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 overscroll-contain">
          {loadError && (
            <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-300">
              <p>{loadError}</p>
              <button
                type="button"
                className="mt-2 text-xs font-semibold underline text-red-400 hover:text-red-200 cursor-pointer"
                onClick={fetchNotifications}
              >
                Thử tải lại thông báo
              </button>
            </div>
          )}

          {isLoading && notifications.length === 0 ? (
            <div className="py-16 text-center text-sm text-neutral-400">
              <div className="inline-block w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mb-2" />
              <p>Đang tải thông báo…</p>
            </div>
          ) : notifications.length === 0 && !loadError ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-16 h-16 rounded-full bg-neutral-800/80 border border-neutral-700/50 flex items-center justify-center mb-3 text-neutral-500">
                <Bell className="w-8 h-8" />
              </div>
              <p className="text-base font-semibold text-neutral-200">Không có thông báo nào</p>
              <p className="text-xs text-neutral-400 mt-1 max-w-xs">
                Khi admin cập nhật tin tức hoặc tính năng mới, bạn sẽ nhận được thông báo tại đây.
              </p>
            </div>
          ) : (
            notifications.map((item, index) => (
              <div
                key={item.id || index}
                className={`relative p-4 rounded-2xl border transition-all ${
                  item.pinned
                    ? "bg-gradient-to-br from-amber-500/10 via-[#1c222b] to-[#161a20] border-amber-500/40 shadow-sm"
                    : index === 0
                    ? "bg-[#1c222b] border-neutral-700/80"
                    : "bg-[#181c22] border-neutral-800/80"
                }`}
              >
                {/* Title & Badge */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h3 className="font-semibold text-[15px] leading-snug text-white">
                    {item.title || "Thông báo từ Admin"}
                  </h3>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.pinned && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        <TbPinned size={13} />
                        Ghim
                      </span>
                    )}
                    {index === 0 && !item.pinned && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        Mới
                      </span>
                    )}
                  </div>
                </div>

                {/* Message text with clickable links */}
                <div className="whitespace-pre-line text-sm leading-relaxed text-neutral-300 mb-2.5 [overflow-wrap:anywhere]">
                  {parseMessage(item.message)}
                </div>

                {/* Author & Timestamp */}
                <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                  <span className="font-medium text-amber-400/90">
                    Admin {item.author || "LOCKET-PRO"}
                  </span>
                  {item.time && (
                    <>
                      <span>·</span>
                      <span>{item.time}</span>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
export default NotificationModal;
