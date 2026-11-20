import React from "react";

const HistoryArrow = ({ setIsBottomOpen }) => {
  const handleClick = () => {
    setIsBottomOpen(true);
  };

  return (
    <div className="flex flex-col items-center select-none">
      <button
        className="flex flex-col items-center cursor-pointer transition-transform hover:scale-105 active:scale-95 text-base-content"
        onClick={handleClick}
        aria-label="Xem lịch sử khoảnh khắc"
      >
        <span className="text-sm font-bold tracking-wide">
          Lịch sử
        </span>
        <svg
          width="22"
          height="14"
          viewBox="0 0 24 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="mt-0.5"
        >
          <path
            d="M3 3L12 11L21 3"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
};

export default HistoryArrow;
