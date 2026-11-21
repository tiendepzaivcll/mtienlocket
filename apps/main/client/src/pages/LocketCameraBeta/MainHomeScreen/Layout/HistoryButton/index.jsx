import React from "react";
import { useApp } from "@/context/AppContext";
import { useMomentsStoreV2 } from "@/stores";
import { ChevronDown } from "lucide-react";

const HistoryArrow = ({ setIsBottomOpen }) => {
  const { navigation } = useApp();
  const isPWA =
    Boolean(navigation?.isPWA) ||
    (typeof window !== "undefined" &&
      (window.matchMedia?.("(display-mode: standalone)").matches ||
        window.navigator?.standalone === true));
  const moments = useMomentsStoreV2((s) => s.momentsByUser["all"]?.items) || [];
  const count = moments.length > 0 ? moments.length : 6;

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
          <div className="inline-flex items-center gap-2 py-1 hover:opacity-85 transition text-[var(--text-primary)]">
            <span
              className="w-[26px] h-[26px] rounded-[8px] text-black text-[14px] font-bold flex items-center justify-center shadow-xs shrink-0"
              style={{ background: "var(--accent-primary)" }}
            >
              {count}
            </span>
            <span className="text-[17px] font-semibold tracking-wide text-[var(--text-primary)] select-none">
              Lịch sử
            </span>
            <ChevronDown size={16} strokeWidth={2.5} className="text-[var(--text-primary)] opacity-85 shrink-0" />
          </div>
      </button>
    </div>
  );
};

export default HistoryArrow;
