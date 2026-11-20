import React from "react";
import { CONFIG } from "@/config";
import { useTheme } from "@/hooks/useTheme";
import { Check } from "lucide-react";

export const LOCKET_THEMES_INFO = {
  "midnight-black": {
    name: "Midnight Black",
    desc: "Đen tuyền huyền bí",
    primary: "#FFB800",
    shutterGradient: "linear-gradient(135deg, #FFB800, #FF7A00)",
    bg: "#000000",
    textColor: "#ffffff",
  },
  "crimson-wine": {
    name: "Crimson Wine",
    desc: "Đỏ rượu vang",
    primary: "#FF2E93",
    shutterGradient: "linear-gradient(135deg, #FF2E93, #FF5E3A)",
    bg: "linear-gradient(180deg, #4A1525 0%, #260A12 100%)",
    textColor: "#ffffff",
  },
  "royal-purple": {
    name: "Royal Purple",
    desc: "Tím mộng mơ",
    primary: "#C084FC",
    shutterGradient: "linear-gradient(135deg, #C084FC, #EC4899)",
    bg: "linear-gradient(180deg, #2D1B4E 0%, #160D29 100%)",
    textColor: "#ffffff",
  },
  "ocean-blue": {
    name: "Ocean Blue",
    desc: "Xanh biển sâu",
    primary: "#38BDF8",
    shutterGradient: "linear-gradient(135deg, #38BDF8, #3B82F6)",
    bg: "linear-gradient(180deg, #0F2942 0%, #071524 100%)",
    textColor: "#ffffff",
  },
  "matcha-forest": {
    name: "Matcha Forest",
    desc: "Xanh rêu trầm",
    primary: "#4ADE80",
    shutterGradient: "linear-gradient(135deg, #4ADE80, #10B981)",
    bg: "linear-gradient(180deg, #143326 0%, #0A1A13 100%)",
    textColor: "#ffffff",
  },
  "soft-pastel-pink": {
    name: "Soft Pastel Pink",
    desc: "Hồng phấn sáng",
    primary: "#F472B6",
    shutterGradient: "linear-gradient(135deg, #F472B6, #FB7185)",
    bg: "linear-gradient(180deg, #FFF0F5 0%, #FCE7F3 100%)",
    textColor: "#18181B",
  },
};

const ThemeSelector = () => {
  const { theme, changeTheme } = useTheme();

  return (
    <div className="w-full flex flex-col">
      <div className="flex items-center justify-between px-1 mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          Chủ đề màu sắc (Vuốt để chọn)
        </h2>
        <span className="text-xs font-semibold text-[var(--accent-primary)]">
          {LOCKET_THEMES_INFO[theme]?.name || "Midnight Black"}
        </span>
      </div>

      {/* Thanh vuốt ngang chọn màu kiểu Locket real */}
      <div className="w-full overflow-x-auto no-scrollbar py-2 px-1 flex items-center gap-4 scroll-smooth">
        {CONFIG.ui.themes.map((t) => {
          const info = LOCKET_THEMES_INFO[t] || {
            name: t,
            desc: "Locket",
            primary: "#FFB800",
            shutterGradient: "linear-gradient(135deg, #FFB800, #FF7A00)",
            bg: "#000000",
            textColor: "#ffffff",
          };
          const isSelected = theme === t;

          return (
            <button
              key={t}
              type="button"
              onClick={() => changeTheme(t)}
              className="flex flex-col items-center gap-1.5 shrink-0 group focus:outline-none cursor-pointer"
            >
              <div
                className={`relative w-13 h-13 rounded-full flex items-center justify-center transition-all duration-200 shadow-md ${
                  isSelected
                    ? "ring-3 ring-[var(--accent-primary)] scale-105 shadow-lg"
                    : "ring-1 ring-white/20 group-hover:scale-102 opacity-85 hover:opacity-100"
                }`}
                style={{
                  background: info.bg,
                }}
              >
                {/* Vòng màu chính ở giữa theo gradient shutter */}
                <div
                  className="w-7 h-7 rounded-full shadow-sm flex items-center justify-center border border-white/20"
                  style={{ background: info.shutterGradient }}
                >
                  {isSelected && (
                    <Check
                      size={14}
                      strokeWidth={3}
                      className={t === "soft-pastel-pink" ? "text-zinc-900" : "text-white"}
                    />
                  )}
                </div>
              </div>

              <span
                className={`text-[11px] font-medium transition-colors ${
                  isSelected ? "text-[var(--accent-primary)] font-bold" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"
                }`}
              >
                {info.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ThemeSelector;
