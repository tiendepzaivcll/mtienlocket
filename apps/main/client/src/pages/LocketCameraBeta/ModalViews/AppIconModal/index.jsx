import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Check, Copy, Globe } from "lucide-react";
import { isRunningPWA, setPWAIcon, updateFavicons } from "@/utils";
import { SonnerSuccess } from "@/components/ui/SonnerToast";

export const APP_ICONS = [
  { id: "3D-heart-gold", name: "Tim vàng" },
  { id: "gold-on-black-2D", name: "Locket vàng" },
  { id: "3D-heart-pink", name: "Tim hồng" },
  { id: "3D-heart-blue", name: "Tim xanh dương" },
  { id: "3D-heart-green", name: "Tim xanh ngọc" },
  { id: "3D-tunnel", name: "Đường hầm 3D" },
  { id: "3D-tunnel-pendant", name: "Mặt dây chuyền" },
  { id: "flat-blue", name: "Xanh lam tối giản" },
  { id: "flat-pink", name: "Hồng tối giản" },
  { id: "flat-purple", name: "Tím tối giản" },
  { id: "flat-yellow", name: "Vàng tối giản" },
  { id: "flowers-autumn", name: "Hoa mùa thu" },
  { id: "flowers-beige", name: "Hoa be" },
  { id: "flowers-magenta", name: "Hoa cánh sen" },
  { id: "flowers-pink", name: "Hoa hồng pastel" },
  { id: "gem-bg-candy", name: "Kẹo ngọt ngào" },
  { id: "gem-bg-mono", name: "Kim cương đen" },
  { id: "gem-bg-multi", name: "Cầu vồng rực rỡ" },
  { id: "gem-bg-pink", name: "Thạch anh hồng" },
  { id: "black-on-gold-2D", name: "Vàng đen cổ điển" },
  { id: "gold-on-black-2D-outline", name: "Viền vàng neon" },
  { id: "rainbow-hearts", name: "Tim ngũ sắc" },
  { id: "light-hearts", name: "Trái tim lấp lánh" },
  { id: "photos-hearts", name: "Khung ảnh tim" },
  { id: "neon-blue", name: "Neon xanh dương" },
  { id: "neon-green", name: "Neon xanh lá" },
  { id: "neon-pink", name: "Neon hồng" },
  { id: "neon-yellow", name: "Neon vàng" },
  { id: "waves-black", name: "Sóng đen bí ẩn" },
  { id: "waves-blue", name: "Sóng xanh biếc" },
  { id: "waves-gold", name: "Sóng cát vàng" },
  { id: "waves-purple", name: "Sóng tím huyền ảo" },
  { id: "default", name: "Mặc định (Tim vàng)" },
];

export default function AppIconModal({ isOpen, onClose, onIconChange }) {
  const [selectedIcon, setSelectedIcon] = useState("3D-heart-gold");
  const [isPWA, setIsPWA] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("pwa_icon");
    const running = isRunningPWA();
    setIsPWA(running);

    if (saved && APP_ICONS.some((item) => item.id === saved)) {
      setSelectedIcon(saved);
    } else {
      setSelectedIcon("3D-heart-gold");
    }
  }, [isOpen]);

  const currentIconObj =
    APP_ICONS.find((item) => item.id === selectedIcon) || APP_ICONS[0];

  const domain =
    typeof window !== "undefined" && window.location?.host
      ? window.location.host
      : "locket-pro.online";

  const handleCopyLink = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const urlToCopy = "https://locket-pro.online";
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(urlToCopy);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = urlToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedLink(true);
      SonnerSuccess("Đã sao chép link!", "Dán vào Safari hoặc Chrome để cài lại biểu tượng.");
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err) {
      console.warn("Could not copy link:", err);
    }
  };

  const handleSelectIcon = (iconId) => {
    setSelectedIcon(iconId);
    try {
      localStorage.setItem("pwa_icon", iconId);
      setPWAIcon(iconId);
      updateFavicons(iconId);
    } catch (e) {
      console.warn("Could not update icon:", e);
    }
    onIconChange?.(iconId);
    const iconName = APP_ICONS.find((i) => i.id === iconId)?.name || iconId;
    if (isPWA) {
      SonnerSuccess(
        "Xem trước biểu tượng!",
        `Đang xem trước "${iconName}". Mở trình duyệt để cài đặt.`
      );
    } else {
      SonnerSuccess(
        `Đã chọn biểu tượng ${iconName}!`,
        "Hãy bấm Chia sẻ → Thêm vào MH chính (iPhone) hoặc Menu 3 chấm → Cài đặt ứng dụng (Android) để lưu biểu tượng này."
      );
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/80 transition-all duration-300"
      style={{ zIndex: 9999 }}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-[#2d221f] sm:bg-[#2b201d] border border-white/10 rounded-t-[32px] sm:rounded-[32px] max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up"
        style={{ zIndex: 9999 }}
      >
        {/* Header: Title + Close Button */}
        <div
          className="relative flex items-center justify-center pt-5 pb-2 px-5"
          style={{ paddingTop: "max(1.25rem, calc(env(safe-area-inset-top) + 8px))" }}
        >
          <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
            Biểu tượng ứng dụng
          </h2>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute right-4 top-4.5 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-gray-200 hover:text-white transition cursor-pointer"
            aria-label="Đóng"
          >
            <X size={18} strokeWidth={2.4} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-4">
          {/* Active Preview */}
          <div className="flex flex-col items-center justify-center text-center pt-1">
            <div className="relative w-20 h-20 rounded-2xl shadow-xl overflow-hidden ring-1 ring-white/15">
              <img
                src={`/pwa-icons/${selectedIcon}/android-chrome-192x192.png`}
                alt={currentIconObj.name}
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-white font-bold text-base mt-2">
              {currentIconObj.name}
            </p>
            <p className="text-xs text-amber-300/80 mt-0.5">
              {isPWA ? "Chế độ xem trước biểu tượng" : "Biểu tượng WebApp đã chọn"}
            </p>
          </div>

          {/* Khung hướng dẫn theo 2 trạng thái PWA vs Trình duyệt thường */}
          {isPWA ? (
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-3.5 text-xs text-amber-200/90 shadow-md space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-base">💡</span>
                <h4 className="font-bold text-amber-300 text-xs sm:text-sm">
                  Cách đổi biểu tượng ngoài Màn hình chính
                </h4>
              </div>

              <div className="rounded-xl bg-amber-500/15 border border-amber-400/20 p-2 text-[11px] text-amber-200 leading-relaxed font-medium">
                ⚠️ Lưu ý: Hãy sao chép đường dẫn locket-pro.online bên dưới TRƯỚC KHI xóa ứng dụng để không bị mất trang web.
              </div>

              <div className="space-y-1 text-gray-200 text-[11.5px] leading-relaxed pl-0.5">
                <p>1. Bấm sao chép link hoặc mở trang web trên trình duyệt (Safari / Chrome).</p>
                <p>2. Xóa ứng dụng cũ ngoài Màn hình chính.</p>
                <p>3. Chọn lại biểu tượng bạn thích trên trình duyệt rồi cài đặt lại ra Màn hình chính.</p>
              </div>

              {/* 2 nút bấm ngang hàng */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow cursor-pointer text-center ${
                    copiedLink
                      ? "bg-emerald-500 text-white"
                      : "bg-amber-400 hover:bg-amber-300 text-black"
                  }`}
                >
                  {copiedLink ? (
                    <>
                      <Check size={13} strokeWidth={2.8} />
                      <span>✅ Đã sao chép!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span className="truncate">📋 Sao chép link</span>
                    </>
                  )}
                </button>

                <a
                  href="https://locket-pro.online"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 border border-white/15 shadow cursor-pointer text-center"
                >
                  <Globe size={13} />
                  <span className="truncate">🌐 Mở trên web</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-emerald-500/15 border border-emerald-500/30 p-3 text-xs text-emerald-200/95 leading-relaxed shadow-md">
              <div className="flex items-start gap-2">
                <span className="text-base shrink-0">✅</span>
                <p className="text-[11.5px] leading-relaxed">
                  <span className="font-bold text-emerald-300">
                    Đã chọn biểu tượng {currentIconObj.name}!
                  </span>{" "}
                  Hãy bấm <strong>Chia sẻ → Thêm vào MH chính</strong> (iPhone) hoặc{" "}
                  <strong>Menu 3 chấm → Cài đặt ứng dụng</strong> (Android) ngay bây giờ để lưu biểu tượng này.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-1 pt-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Chọn biểu tượng ({APP_ICONS.length})
            </span>
            <span className={`text-[11px] font-medium ${isPWA ? "text-amber-400" : "text-emerald-400"}`}>
              {isPWA ? "Xem trước biểu tượng" : "Chạm để chọn biểu tượng cài đặt"}
            </span>
          </div>

          {/* Grid 6 columns */}
          <div className="grid grid-cols-6 gap-2.5 pt-2 pb-2">
            {APP_ICONS.map((icon) => {
              const active = selectedIcon === icon.id;
              return (
                <button
                  key={icon.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectIcon(icon.id);
                  }}
                  aria-label={icon.name}
                  className={`relative aspect-square rounded-2xl overflow-hidden transition-all duration-200 active:scale-90 cursor-pointer ${
                    active
                      ? "ring-2.5 ring-[#ff6347] scale-105 shadow-lg shadow-[#ff6347]/30"
                      : "opacity-85 hover:opacity-100 hover:scale-102"
                  }`}
                >
                  <img
                    src={`/pwa-icons/${icon.id}/android-chrome-192x192.png`}
                    alt={icon.name}
                    className="w-full h-full object-cover rounded-2xl"
                    loading="lazy"
                  />
                  {active && (
                    <div className="absolute inset-0 bg-[#ff6347]/10 pointer-events-none" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Action Button: Xong */}
        <div className="p-4 pt-2 border-t border-white/5 bg-[#251b19]/90 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="w-full py-3.5 rounded-2xl bg-[#ff6347] hover:bg-[#ff5236] active:scale-98 text-white font-bold text-base transition shadow-lg shadow-[#ff6347]/25 cursor-pointer"
          >
            Xong
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
