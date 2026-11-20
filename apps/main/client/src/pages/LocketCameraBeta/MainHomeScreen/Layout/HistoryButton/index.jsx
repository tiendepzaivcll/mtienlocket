import React from "react";
import { useApp } from "@/context/AppContext";
import { useMomentsStoreV2 } from "@/stores";
import { ChevronDown } from "lucide-react";

const HistoryArrow = ({ setIsBottomOpen }) => {
  const { navigation } = useApp();
  const isPWA = navigation?.isPWA;
  const moments = useMomentsStoreV2((s) => s.momentsByUser["all"]?.items) || [];
  const count = moments.length > 0 ? moments.length : 6;

  const handleClick = () => {
    setIsBottomOpen(true);
  };

  return (
    <div className="flex flex-col items-center select-none">
      <button
        className="flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95"
        onClick={handleClick}
        aria-label="Xem lịch sử khoảnh khắc"
      >
        {isPWA ? (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full hover:opacity-80 transition text-[var(--text-primary)]">
            <span
              className="w-5.5 h-5.5 rounded-lg text-black text-xs font-black flex items-center justify-center shadow-sm"
              style={{ background: "var(--accent-primary)" }}
            >
              {count}
            </span>
            <span className="text-sm font-bold tracking-wide text-[var(--text-primary)]">
              Lịch sử
            </span>
            <ChevronDown size={16} strokeWidth={2.5} className="text-[var(--text-primary)] opacity-80" />
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
