import React, { useEffect, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { useAuthStore, useMomentsStoreV2, useViewedMomentsStore } from "@/stores";
import { ChevronDown } from "lucide-react";

const HistoryArrow = ({ setIsBottomOpen }) => {
  const { navigation } = useApp();
  const { user } = useAuthStore();
  const isPWA =
    Boolean(navigation?.isPWA) ||
    (typeof window !== "undefined" &&
      (window.matchMedia?.("(display-mode: standalone)").matches ||
        window.navigator?.standalone === true));

  const currentUserId = user?.uid || user?.localId || null;
  const initViewed = useViewedMomentsStore((s) => s.init);
  const viewedIds = useViewedMomentsStore((s) => s.viewedIds);
  const moments = useMomentsStoreV2((s) => s.momentsByUser["all"]?.items) || [];

  useEffect(() => {
    if (currentUserId) {
      initViewed(currentUserId);
    }
  }, [currentUserId, initViewed]);

  // Chỉ đếm những ảnh chưa xem và không phải ảnh của chính mình
  const unreadCount = useMemo(() => {
    if (!Array.isArray(moments) || moments.length === 0) return 0;
    return moments.filter((m) => {
      if (!m?.id) return false;
      const ownerId = typeof m.user === "string" ? m.user : m.user?.uid || m.userUid;
      if (ownerId && currentUserId && ownerId === currentUserId) return false;
      return !viewedIds.has(m.id);
    }).length;
  }, [moments, viewedIds, currentUserId]);

  const handleClick = () => {
    setIsBottomOpen(true);
  };

  return (
    <div className="flex flex-col items-center justify-center select-none w-full">
      <button
        className="inline-flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95 mx-auto"
        onClick={handleClick}
        aria-label="Xem lịch sử khoảnh khắc"
      >
        {isPWA ? (
          <div className="inline-flex items-center gap-2 py-1 hover:opacity-85 transition text-[var(--text-primary)]">
            {unreadCount > 0 && (
              <span
                className="w-[26px] h-[26px] rounded-[8px] text-black text-[14px] font-bold flex items-center justify-center shadow-xs shrink-0 animate-in fade-in zoom-in duration-200"
                style={{ background: "var(--accent-primary)" }}
              >
                {unreadCount}
              </span>
            )}
            <span className="text-[17px] font-semibold tracking-wide text-[var(--text-primary)] select-none">
              Lịch sử
            </span>
            <ChevronDown size={16} strokeWidth={2.5} className="text-[var(--text-primary)] opacity-85 shrink-0" />
          </div>
        ) : (
          <div className="flex flex-col items-center text-[var(--text-primary)]">
            <span className="text-sm font-bold tracking-wide">
              Lịch sử
            </span>
            <svg
              width="22"
              height="14"
              viewBox="0 0 24 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="mt-0.5 text-[var(--text-primary)]"
            >
              <path
                d="M3 3L12 11L21 3"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
      </button>
    </div>
  );
};

export default HistoryArrow;
