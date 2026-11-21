import { useEffect, useState } from "react";
import { SonnerSuccess } from "@/components/ui/SonnerToast";
import { Wrench, Loader2, Copy, Check, Globe } from "lucide-react";
import { isRunningPWA, setPWAIcon, updateFavicons } from "@/utils";

const ICONS = [
  "default",
  "3D-heart-blue",
  "3D-heart-gold",
  "3D-heart-green",
  "3D-heart-pink",
  "3D-tunnel-pendant",
  "3D-tunnel",
  "black-on-gold-2D",
  "flat-blue",
  "flat-pink",
  "flat-purple",
  "flat-yellow",
  "flowers-autumn",
  "flowers-beige",
  "flowers-magenta",
  "flowers-pink",
  "gem-bg-candy",
  "gem-bg-mono",
  "gem-bg-multi",
  "gem-bg-pink",
  "gold-on-black-2D-outline",
  "gold-on-black-2D",
  "light-hearts",
  "neon-blue",
  "neon-green",
  "neon-pink",
  "neon-yellow",
  "photos-hearts",
  "rainbow-hearts",
  "waves-black",
  "waves-blue",
  "waves-gold",
  "waves-purple",
];
export default function SettingAppIcon() {
  const [selectedIcon, setSelectedIcon] = useState("default");
  const [isPWA, setIsPWA] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("pwa_icon");
    const running = isRunningPWA();
    setIsPWA(running);

    if (saved) {
      setSelectedIcon(saved);

      if (!running) {
        setPWAIcon(saved);
        updateFavicons(saved);
      }
    } else {
      setSelectedIcon("default");
    }
  }, []);

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

  const handleChangeIcon = async (icon) => {
    setSelectedIcon(icon);
    localStorage.setItem("pwa_icon", icon);
    setPWAIcon(icon);
    updateFavicons(icon);

    if (isPWA) {
      SonnerSuccess(
        "Xem trước biểu tượng!",
        "Mở trên trình duyệt web để cài đặt biểu tượng này ra màn hình chính."
      );
    } else {
      SonnerSuccess(
        `Đã chọn biểu tượng ${icon}!`,
        "Hãy bấm Chia sẻ → Thêm vào MH chính (iPhone) hoặc Menu 3 chấm → Cài đặt ứng dụng (Android) để lưu biểu tượng này."
      );
    }
  };

  return (
    <div className="bg-base-100 rounded-2xl shadow-xl mb-8 overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-base-200">
        <h2 className="text-xl sm:text-2xl font-bold text-base-content flex items-center gap-2">
          <Wrench className="w-5 h-5 text-purple-600" />
          Chọn biểu tượng ứng dụng
        </h2>
        <span className={`text-xs font-semibold ${isPWA ? "text-amber-500" : "text-emerald-500"}`}>
          {isPWA ? "Xem trước biểu tượng" : "Chạm để chọn biểu tượng cài đặt"}
        </span>
      </div>

      <div className="relative flex flex-col gap-4 p-4 sm:p-5">
        {/* Preview */}
        <div className="flex items-center flex-col justify-center">
          <div className="relative w-20 h-20 rounded-2xl shadow-lg overflow-hidden ring-2 ring-primary/30">
            <img
              src={`/pwa-icons/${selectedIcon}/android-chrome-192x192.png`}
              alt="preview"
              className="w-20 h-20 rounded-2xl shadow object-cover"
            />
          </div>
          <p className="text-sm font-bold text-base-content mt-2">{selectedIcon}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isPWA ? "Chế độ xem trước biểu tượng" : "Biểu tượng WebApp đã chọn"}
          </p>
        </div>

        {/* Khung hướng dẫn theo 2 trạng thái PWA vs Trình duyệt thường */}
        {isPWA ? (
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-4 text-xs text-amber-900 dark:text-amber-200 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-base">💡</span>
              <h4 className="font-bold text-amber-700 dark:text-amber-300 text-sm">
                Cách đổi biểu tượng ngoài Màn hình chính
              </h4>
            </div>

            <div className="rounded-xl bg-amber-500/15 border border-amber-400/25 p-2.5 text-[11.5px] font-medium leading-relaxed">
              ⚠️ Lưu ý: Hãy sao chép đường dẫn locket-pro.online bên dưới TRƯỚC KHI xóa ứng dụng để không bị mất trang web.
            </div>

            <div className="space-y-1.5 text-[12px] opacity-90 leading-relaxed">
              <p>1. Bấm sao chép link hoặc mở trang web trên trình duyệt (Safari / Chrome).</p>
              <p>2. Xóa ứng dụng cũ ngoài Màn hình chính.</p>
              <p>3. Chọn lại biểu tượng bạn thích trên trình duyệt rồi cài đặt lại ra Màn hình chính.</p>
            </div>

            {/* 2 nút bấm ngang hàng */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleCopyLink}
                className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow cursor-pointer text-center ${
                  copiedLink
                    ? "bg-emerald-500 text-white"
                    : "bg-amber-400 hover:bg-amber-300 text-black"
                }`}
              >
                {copiedLink ? (
                  <>
                    <Check size={14} strokeWidth={2.8} />
                    <span>✅ Đã sao chép!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span className="truncate">📋 Sao chép link</span>
                  </>
                )}
              </button>

              <a
                href="https://locket-pro.online"
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 rounded-xl bg-base-200 hover:bg-base-300 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 border border-base-300 shadow cursor-pointer text-center"
              >
                <Globe size={14} />
                <span className="truncate">🌐 Mở trên trình duyệt</span>
              </a>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-emerald-500/15 border border-emerald-500/30 p-3.5 text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed shadow-sm">
            <div className="flex items-start gap-2">
              <span className="text-base shrink-0">✅</span>
              <p className="text-[12px] leading-relaxed">
                <span className="font-bold text-emerald-700 dark:text-emerald-300">
                  Đã chọn biểu tượng {selectedIcon}!
                </span>{" "}
                Hãy bấm <strong>Chia sẻ → Thêm vào MH chính</strong> (iPhone) hoặc{" "}
                <strong>Menu 3 chấm → Cài đặt ứng dụng</strong> (Android) ngay bây giờ để lưu biểu tượng này.
              </p>
            </div>
          </div>
        )}

        {/* List icon */}
        <div className="grid grid-cols-5 gap-3">
          {ICONS.map((icon) => {
            const active = selectedIcon === icon;

            return (
              <button
                key={icon}
                onClick={() => handleChangeIcon(icon)}
                className={`
                    relative p-1 rounded-xl border transition-all duration-300 cursor-pointer
                    ${
                      active
                        ? "border-primary border-3 scale-110 shadow-lg"
                        : "border-base-300 hover:scale-105"
                    }
                  `}
              >
                {active && (
                  <div className="absolute inset-0 rounded-xl bg-primary/10 blur-md animate-pulse"></div>
                )}

                <img
                  src={`/pwa-icons/${icon}/android-chrome-192x192.png`}
                  alt={icon}
                  className={`w-full h-auto rounded-lg ${active ? "scale-105" : ""}`}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
