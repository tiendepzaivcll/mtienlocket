import React from "react";
import { ChevronDown } from "lucide-react";

const HistoryArrow = ({ setIsBottomOpen }) => {
  const handleClick = () => {
    if (typeof setIsBottomOpen === "function") {
      setIsBottomOpen(true);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center select-none w-full">
      <button
        type="button"
        className="inline-flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95 mx-auto"
        onClick={handleClick}
        aria-label="Xem lịch sử khoảnh khắc"
      >
        <div className="inline-flex items-center justify-center gap-1.5 py-1 hover:opacity-85 transition text-[var(--text-primary)]">
          <span className="text-[17px] font-semibold tracking-wide text-[var(--text-primary)] select-none">
            Lịch sử
          </span>
          <ChevronDown
            size={16}
            strokeWidth={2.5}
            className="text-[var(--text-primary)] opacity-85 shrink-0"
          />
        </div>
      </button>
    </div>
  );
};

export default HistoryArrow;
