import React from "react";
import { useApp } from "@/context/AppContext.jsx";

const AaSparkleIcon = ({ size = 38, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 44 44"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Caption & Overlays"
  >
    {/* Vòng tròn viền ngoài mở ở góc trên bên phải */}
    <path
      d="M 21 8.5 A 15.5 15.5 0 1 0 36.5 24"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
    />
    {/* Chữ Aa ở trung tâm */}
    <text
      x="20"
      y="24"
      fill="currentColor"
      fontSize="15"
      fontWeight="700"
      fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif"
      textAnchor="middle"
      dominantBaseline="central"
    >
      Aa
    </text>
    {/* Ngôi sao lấp lánh lớn ở góc trên bên phải */}
    <path
      d="M 34.5 5.5 C 34.5 8.5 35.8 9.8 39 10 C 35.8 10.2 34.5 11.5 34.5 14.5 C 34.5 11.5 33.2 10.2 30 10 C 33.2 9.8 34.5 8.5 34.5 5.5 Z"
      fill="currentColor"
    />
    {/* Ngôi sao nhỏ bên cạnh */}
    <path
      d="M 40.5 13.5 C 40.5 15.2 41.2 15.8 43 16 C 41.2 16.2 40.5 16.8 40.5 18.5 C 40.5 16.8 39.8 16.2 38 16 C 39.8 15.8 40.5 15.2 40.5 13.5 Z"
      fill="currentColor"
    />
  </svg>
);

const OverlayButton = () => {
  const { navigation, useloading } = useApp();
  const { setIsFilterOpen } = navigation;
  const { uploadLoading } = useloading;

  return (
    <>
      <button
        className="cursor-pointer active:scale-95 transition-transform flex items-center justify-center text-[var(--accent-primary)]"
        onClick={() => {
          setIsFilterOpen(true);
        }}
        disabled={uploadLoading}
        title="Tùy chỉnh Caption & Chủ đề"
      >
        <AaSparkleIcon size={38} />
      </button>
    </>
  );
};

export default OverlayButton;
