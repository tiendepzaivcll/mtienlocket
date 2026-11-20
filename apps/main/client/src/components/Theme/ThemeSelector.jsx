import React from "react";
import { CONFIG } from "@/config";
import { useTheme } from "@/hooks/useTheme";
import { Check } from "lucide-react";

export const LOCKET_THEMES_INFO = {
  black: {
    name: "Đen AMOLED",
    desc: "Đen sâu tuyệt đối",
    primary: "#eab308",
    bg: "#000000",
    textColor: "#ffffff",
  },
  bumblebee: {
    name: "Locket Vàng",
    desc: "Vàng Locket chuẩn",
    primary: "#EAA900",
    bg: "#18181b",
    textColor: "#ffffff",
  },
  dark: {
    name: "Locket Tối",
    desc: "Chế độ tối cổ điển",
    primary: "#f59e0b",
    bg: "#1d232a",
    textColor: "#ffffff",
  },
  emerald: {
    name: "Xanh Ngọc",
    desc: "Xanh ngọc may mắn",
    primary: "#10b981",
    bg: "#064e3b",
    textColor: "#ffffff",
  },
  dracula: {
    name: "Tím Huyền Ảo",
    desc: "Tím đêm huyền bí",
    primary: "#c084fc",
    bg: "#282a36",
    textColor: "#f8f8f2",
  },
  autumn: {
    name: "Cam Hoàng Hôn",
    desc: "Cam ấm áp rực rỡ",
    primary: "#f97316",
    bg: "#431407",
    textColor: "#ffffff",
  },
};

const ThemeSelector = () => {
  const { theme, changeTheme } = useTheme();

  return (
    <div className="w-full flex flex-col">
      <div className="flex items-center justify-between px-1 mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-300">
          Chủ đề màu sắc (Vuốt để chọn)
        </h2>
        <span className="text-xs text-amber-400 font-medium">
          {LOCKET_THEMES_INFO[theme]?.name || "Mặc định"}
        </span>
      </div>

      {/* Thanh vuốt ngang chọn màu kiểu Locket real */}
      <div className="w-full overflow-x-auto no-scrollbar py-2 px-1 flex items-center gap-4 scroll-smooth">
        {CONFIG.ui.themes.map((t) => {
          const info = LOCKET_THEMES_INFO[t] || {
            name: t,
            desc: "Locket",
            primary: "#f59e0b",
            bg: "#1f2937",
            textColor: "#ffffff",
          };
          const isSelected = theme === t;

          return (
            <button
              key={t}
              type="button"
              onClick={() => changeTheme(t)}
              className="flex flex-col items-center gap-1.5 shrink-0 group focus:outline-none"
            >
              <div
                className={`relative w-13 h-13 rounded-full flex items-center justify-center transition-all duration-200 shadow-md ${
                  isSelected
                    ? "ring-3 ring-amber-400 scale-105 shadow-amber-400/30"
                    : "ring-1 ring-white/20 group-hover:scale-102 opacity-85 hover:opacity-100"
                }`}
                style={{
                  background: info.bg,
                }}
              >
                {/* Vòng màu chính ở giữa */}
                <div
                  className="w-7 h-7 rounded-full shadow-sm flex items-center justify-center border border-white/20"
                  style={{ backgroundColor: info.primary }}
                >
                  {isSelected && (
                    <Check
                      size={14}
                      strokeWidth={3}
                      className={t === "bumblebee" || t === "light" ? "text-black" : "text-white"}
                    />
                  )}
                </div>
              </div>

              <span
                className={`text-[11px] font-medium transition-colors ${
                  isSelected ? "text-amber-400 font-bold" : "text-gray-300 group-hover:text-white"
                }`}
              >
                {info.name.replace("Locket ", "")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ThemeSelector;
