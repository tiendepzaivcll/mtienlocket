import React from "react";
import { CONFIG } from "@/config";
import { useTheme } from "@/hooks/useTheme";
import { Check } from "lucide-react";

export const LOCKET_THEMES_INFO = {
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
  black: {
    name: "Đen AMOLED",
    desc: "Đen sâu tuyệt đối",
    primary: "#eab308",
    bg: "#000000",
    textColor: "#ffffff",
  },
  light: {
    name: "Locket Sáng",
    desc: "Trắng sáng thanh lịch",
    primary: "#f59e0b",
    bg: "#ffffff",
    textColor: "#18181b",
  },
  valentine: {
    name: "Hồng Valentine",
    desc: "Hồng pastel ngọt ngào",
    primary: "#e11d48",
    bg: "#fce7f3",
    textColor: "#831843",
  },
  winter: {
    name: "Xanh Biển",
    desc: "Xanh đại dương tươi mát",
    primary: "#0284c7",
    bg: "#f0f9ff",
    textColor: "#0369a1",
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
    <div className="w-full flex flex-col items-center">
      <div className="w-full">
        <h2 className="text-sm font-semibold text-gray-300 mb-2 px-1">
          🎨 Giao diện Locket chính thức
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto px-1 py-1">
          {CONFIG.ui.themes.map((t) => {
            const info = LOCKET_THEMES_INFO[t] || {
              name: t,
              desc: "Giao diện Locket",
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
                className={`relative flex items-center gap-3 p-2.5 rounded-2xl border transition-all text-left ${
                  isSelected
                    ? "border-amber-400 bg-white/10 ring-1 ring-amber-400 shadow-md"
                    : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
                }`}
              >
                {/* Visual Color Preview Capsule */}
                <div
                  className="w-11 h-11 rounded-xl shadow-md flex items-center justify-center shrink-0 border border-white/10"
                  style={{ backgroundColor: info.bg }}
                >
                  <div
                    className="w-5 h-5 rounded-full shadow-inner ring-2 ring-white/30"
                    style={{ backgroundColor: info.primary }}
                  />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-white truncate">
                      {info.name}
                    </p>
                    {t === "bumblebee" && (
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md bg-amber-400/20 text-amber-300">
                        Gốc
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">
                    {info.desc}
                  </p>
                </div>

                {/* Checked Icon */}
                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-amber-400 text-black flex items-center justify-center shrink-0 shadow-sm">
                    <Check size={14} strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ThemeSelector;
