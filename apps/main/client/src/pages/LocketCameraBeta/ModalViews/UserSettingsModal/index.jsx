import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Palette,
  Users,
  UserRoundPen,
  Mail,
  Hash,
  Calendar,
  Eye,
  LogOut,
  Trash2,
  Smartphone,
  Camera,
  Wrench,
  CalendarClock,
  Newspaper,
  MessageCircle,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Copy,
  Check,
  Crown,
  Clock,
  Sparkles,
  Gift,
  Loader2,
  User,
  LogIn,
  UserPlus,
  Globe,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { instanceMain } from "@/libs/instanceMain";
import { useAuthStore, useUploadQueueStore } from "@/stores";
import { useApp } from "@/context/AppContext";
import { useTheme } from "@/hooks/useTheme";
import { getAvatarSource, handleAvatarError } from "@/utils/avatar";
import { setPWAIcon, updateFavicons } from "@/utils";
import { SonnerSuccess, SonnerError } from "@/components/ui/SonnerToast";
import ThemeSelector from "@/components/Theme/ThemeSelector";
import { APP_ICONS } from "../AppIconModal";
import {
  getSavedAccounts,
  removeAccountFromPool,
  switchToAccount,
} from "@/utils/auth/accountManager";

export default function UserSettingsModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const {
    user,
    isAuth,
    clearAndlogout,
    accessRole,
    vipPlanId,
    vipPlanName,
    vipExpireAt,
    aiCredits,
    hasUsedTrial,
    refreshAccessRole,
  } = useAuthStore();
  const { camera, useloading, navigation } = useApp();
  const isPWA =
    Boolean(navigation?.isPWA) ||
    (typeof window !== "undefined" &&
      (window.matchMedia?.("(display-mode: standalone)").matches ||
        window.navigator?.standalone === true ||
        document.body.classList.contains("is-pwa")));
  const [copiedLink, setCopiedLink] = useState(false);
  const queueBusy = useUploadQueueStore((state) => state.isQueueRunning ||
    state.uploadItems.some((item) => item.status === "queued" || item.status === "uploading"));
  const operationsBusy = Boolean(queueBusy || camera.isHolding || useloading.sendLoading ||
    useloading.uploadLoading || useloading.isAiGenerating);
  const { theme } = useTheme();
  const [sessionAction, setSessionAction] = useState(null);
  const endingSessionRef = useRef(false);
  const [claimingTrial, setClaimingTrial] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState([]);
  const [isSwitching, setIsSwitching] = useState(false);

  const handleClaimTrial = async () => {
    const rawUsername = user?.username || "";
    const trimmed = rawUsername.trim().replace(/^@+/, "");
    if (!trimmed) {
      SonnerError("Không tìm thấy username của bạn", "Vui lòng kiểm tra lại tài khoản.");
      return;
    }
    setClaimingTrial(true);
    try {
      const res = await instanceMain.post("/api/payment/claim-trial", {
        username: trimmed,
      });
      if (res.data?.success) {
        SonnerSuccess(
          "Kích hoạt dùng thử thành công!",
          "Bạn có 24 giờ VIP trọn bộ + 1 lượt tạo ảnh AI miễn phí!"
        );
        await refreshAccessRole();
      } else {
        SonnerError("Không thể kích hoạt", res.data?.message || "Vui lòng thử lại sau.");
      }
    } catch (err) {
      SonnerError(
        "Lỗi kích hoạt dùng thử",
        err.response?.data?.message || "Không thể kết nối đến máy chủ."
      );
    } finally {
      setClaimingTrial(false);
    }
  };

  const [copiedUid, setCopiedUid] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [currentView, setCurrentView] = useState("main"); // "main" | "appIcon"
  const [showNameModal, setShowNameModal] = useState(false);
  const [currentAppIcon, setCurrentAppIcon] = useState(
    () => localStorage.getItem("pwa_icon") || "3D-heart-gold"
  );
  const currentIconObj = APP_ICONS.find((i) => i.id === currentAppIcon) || APP_ICONS[0];

  const domain =
    typeof window !== "undefined" && window.location?.host
      ? window.location.host
      : "locket-pro.online";

  const handleAppIconClick = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setCurrentView("appIcon");
  };

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

  const handleSelectAppIcon = (iconId) => {
    setCurrentAppIcon(iconId);
    try {
      localStorage.setItem("pwa_icon", iconId);
      setPWAIcon(iconId);
      updateFavicons(iconId);
    } catch (err) {
      console.warn("Could not update icon:", err);
    }
    const iconName = APP_ICONS.find((i) => i.id === iconId)?.name || iconId;
    if (isPWA) {
      SonnerSuccess("Xem trước biểu tượng!", `Đang xem trước "${iconName}". Mở trình duyệt để cài đặt.`);
    } else {
      SonnerSuccess(
        `Đã chọn biểu tượng ${iconName}!`,
        "Hãy bấm Chia sẻ → Thêm vào MH chính (iPhone) hoặc Menu 3 chấm → Cài đặt ứng dụng (Android) để lưu biểu tượng này."
      );
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCurrentView("main");
      setCurrentAppIcon(localStorage.getItem("pwa_icon") || "3D-heart-gold");
      setSavedAccounts(getSavedAccounts());
      navigation?.setSettingTabOpen?.(true);
      document.body.style.overflow = "hidden";
      return () => {
        navigation?.setSettingTabOpen?.(false);
        document.body.style.overflow = "";
      };
    }
  }, [isOpen, navigation]);
  const [customName, setCustomName] = useState(
    user?.displayName || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || ""
  );

  // Trạng thái xem moments (lưu vào localStorage)
  const [showSeenStatus, setShowSeenStatus] = useState(() => {
    const saved = localStorage.getItem("setting_show_seen_status");
    return saved !== null ? saved === "true" : true;
  });

  const handleToggleSeenStatus = () => {
    const newVal = !showSeenStatus;
    setShowSeenStatus(newVal);
    localStorage.setItem("setting_show_seen_status", String(newVal));
    SonnerSuccess("Đã cập nhật", newVal ? "Đã bật trạng thái xem" : "Đã tắt trạng thái xem");
  };

  const handleCopyUid = () => {
    if (!user?.uid) return;
    navigator.clipboard.writeText(user.uid);
    setCopiedUid(true);
    SonnerSuccess("Đã sao chép mã tài khoản", user.uid);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  const endSession = async (action) => {
    if (endingSessionRef.current) return;
    const currentQueue = useUploadQueueStore.getState();
    if (operationsBusy || currentQueue.isQueueRunning || currentQueue.uploadItems.some(
      (item) => item.status === "queued" || item.status === "uploading"
    )) {
      SonnerError("Đang xử lý ảnh", "Đợi gửi ảnh hoặc hàng đợi hoàn tất trước khi đổi tài khoản.");
      return;
    }
    const unsentItems = currentQueue.uploadItems.some((item) => item.status !== "done");
    if (unsentItems && !window.confirm(
      "Bạn còn ảnh/video chưa gửi thành công trong hàng đợi. Tiếp tục sẽ xóa bản lưu tạm này trên trình duyệt. Ảnh đã đăng trên Locket vẫn được giữ. Bạn có muốn tiếp tục?"
    )) return;
    endingSessionRef.current = true;
    setSessionAction(action);
    try {
      await clearAndlogout();
      SonnerSuccess(action === "switch" ? "Chuyển tài khoản" : "Đăng xuất thành công",
        action === "switch" ? "Đăng nhập bằng tài khoản Locket khác để tiếp tục." : "Hẹn gặp lại bạn!");
      onClose();
      // Reload the app so friends, chat and upload state cannot follow the old account.
      window.location.replace("/login");
    } catch {
      SonnerError("Lỗi", action === "switch" ? "Không thể chuyển tài khoản. Vui lòng thử lại." : "Không thể đăng xuất");
    } finally {
      endingSessionRef.current = false;
      setSessionAction(null);
    }
  };

  const handleLogout = () => endSession("logout");

  const handleClearBrowserData = () => {
    if (
      window.confirm(
        "Bạn có chắc muốn xoá toàn bộ dữ liệu trên trình duyệt? Hành động này sẽ xoá mọi tài khoản đã lưu, bộ nhớ đệm và đăng xuất."
      )
    ) {
      try {
        localStorage.clear();
        sessionStorage.clear();
        // Clear IndexedDB nếu có
        if (window.indexedDB?.databases) {
          window.indexedDB.databases().then((dbs) => {
            dbs.forEach((db) => {
              if (db.name) window.indexedDB.deleteDatabase(db.name);
            });
          });
        }
        SonnerSuccess("Đã dọn dẹp dữ liệu!", "Đang tải lại trang...");
        setTimeout(() => {
          window.location.href = "/login";
        }, 800);
      } catch {
        window.location.reload();
      }
    }
  };

  const displayName =
    user?.displayName ||
    `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
    "Người dùng Locket";

  const joinDateFormatted = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("vi-VN")
    : "27/3/2023";

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity animate-fade-in"
        onClick={() => { if (!endingSessionRef.current) onClose(); }}
      />

      {/* Sheet Content */}
      <div
        className="relative z-10 w-full max-w-lg max-h-[92vh] sm:max-h-[85vh] flex flex-col rounded-t-[28px] sm:rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #181d28 0%, #0f131a 100%)",
          color: "#e6edf3",
        }}
      >
        {/* Header */}
        {currentView === "appIcon" ? (
          <div
            className="flex items-center justify-between px-5 pb-4 border-b border-white/10 shrink-0"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCurrentView("main");
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 py-1.5 px-3 rounded-xl bg-white/[0.06] hover:bg-white/10 transition active:scale-95 cursor-pointer"
            >
              <ChevronLeft size={16} />
              <span>Cài đặt</span>
            </button>
            <h2 className="text-base font-bold text-white tracking-wide">
              Biểu tượng ứng dụng
            </h2>
            <button
              onClick={onClose}
              disabled={Boolean(sessionAction)}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-gray-200 hover:text-white transition cursor-pointer shrink-0"
              aria-label="Đóng Cài đặt"
              title="Đóng"
            >
              <X size={20} strokeWidth={2.4} />
            </button>
          </div>
        ) : !isAuth || !user?.uid ? (
          <div
            className="p-5 sm:p-6 border-b border-white/10 shrink-0 bg-white/[0.02]"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-gray-300 border border-white/10 shadow-sm">
                  <User size={22} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white leading-tight">
                    Chưa đăng nhập
                  </h2>
                  <p className="text-xs text-gray-400">
                    Đăng nhập để xem khoảnh khắc & bạn bè
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-gray-200 hover:text-white transition cursor-pointer shrink-0"
                aria-label="Đóng Cài đặt"
                title="Đóng"
              >
                <X size={20} strokeWidth={2.4} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                navigate("/login");
              }}
              className="w-full mt-3.5 py-3 px-4 rounded-2xl bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-black font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20 transition cursor-pointer"
            >
              <LogIn size={18} />
              Đăng nhập tài khoản Locket
            </button>
          </div>
        ) : (
          <div
            className="flex items-center justify-between px-6 pb-4 border-b border-white/10 shrink-0"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}
          >
            <div className="flex items-center gap-3">
              <img
                src={getAvatarSource(user)}
                alt="avatar"
                onError={handleAvatarError}
                className="w-10 h-10 rounded-full object-cover border-2 border-primary/50 shadow-sm"
              />
              <div>
                <h2 className="text-base font-bold text-white leading-tight">
                  {displayName}
                </h2>
                <p className="text-xs text-gray-400">@{user?.username || "locket"}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={Boolean(sessionAction)}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-gray-200 hover:text-white transition cursor-pointer shrink-0"
              aria-label="Đóng Cài đặt"
              title="Đóng"
            >
              <X size={20} strokeWidth={2.4} />
            </button>
          </div>
        )}

        {/* Scrollable Body */}
        {currentView === "appIcon" ? (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 pb-[max(5rem,calc(env(safe-area-inset-bottom)+3.5rem))]">
            {/* Active Icon Preview */}
            <div className="flex flex-col items-center justify-center pt-2 pb-1 text-center">
              <div className="w-20 h-20 rounded-2xl shadow-xl ring-2 ring-amber-400/40 overflow-hidden mb-2.5 bg-black/40">
                <img
                  src={`/pwa-icons/${currentIconObj.id}/android-chrome-192x192.png`}
                  alt={currentIconObj.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="text-base font-bold text-white">{currentIconObj.name}</h3>
              <p className="text-xs text-amber-300/80 mt-0.5">
                {isPWA ? "Chế độ xem trước biểu tượng" : "Biểu tượng WebApp đã chọn"}
              </p>
            </div>

            {/* Khung hướng dẫn theo 2 trạng thái PWA vs Trình duyệt thường */}
            {isPWA ? (
              <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-4 text-xs text-amber-200/90 shadow-md space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">💡</span>
                  <h4 className="font-bold text-amber-300 text-sm">
                    Cách đổi biểu tượng ngoài Màn hình chính
                  </h4>
                </div>

                <div className="rounded-xl bg-amber-500/15 border border-amber-400/20 p-2.5 text-[11.5px] text-amber-200 leading-relaxed font-medium">
                  ⚠️ Lưu ý: Hãy sao chép đường dẫn locket-pro.online bên dưới TRƯỚC KHI xóa ứng dụng để không bị mất trang web.
                </div>

                <div className="space-y-1.5 text-gray-200 text-[12px] leading-relaxed pl-0.5">
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
                        <span className="truncate">📋 Sao chép link (locket-pro.online)</span>
                      </>
                    )}
                  </button>

                  <a
                    href="https://locket-pro.online"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 border border-white/15 shadow cursor-pointer text-center"
                  >
                    <Globe size={14} />
                    <span className="truncate">🌐 Mở trên trình duyệt</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-emerald-500/15 border border-emerald-500/30 p-3.5 text-xs text-emerald-200/95 leading-relaxed shadow-md">
                <div className="flex items-start gap-2">
                  <span className="text-base shrink-0">✅</span>
                  <p className="text-[12px] leading-relaxed">
                    <span className="font-bold text-emerald-300">
                      Đã chọn biểu tượng {currentIconObj.name}!
                    </span>{" "}
                    Hãy bấm <strong>Chia sẻ → Thêm vào MH chính</strong> (iPhone) hoặc{" "}
                    <strong>Menu 3 chấm → Cài đặt ứng dụng</strong> (Android) ngay bây giờ để lưu biểu tượng này.
                  </p>
                </div>
              </div>
            )}

            {/* 3-column Grid of Icons */}
            <div>
              <div className="flex items-center justify-between px-1 mb-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Chọn biểu tượng ({APP_ICONS.length})
                </span>
                <span className={`text-[11px] font-medium ${isPWA ? "text-amber-400" : "text-emerald-400"}`}>
                  {isPWA ? "Xem trước biểu tượng" : "Chạm để chọn biểu tượng cài đặt"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {APP_ICONS.map((icon) => {
                  const isSelected = currentAppIcon === icon.id;
                  return (
                    <button
                      key={icon.id}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSelectAppIcon(icon.id);
                      }}
                      className={`relative p-3 rounded-2xl border flex flex-col items-center gap-2 transition active:scale-95 cursor-pointer text-center ${
                        isSelected
                          ? "bg-amber-400/15 border-amber-400/60 shadow-lg shadow-amber-400/15 ring-1 ring-amber-400/50"
                          : "bg-white/[0.04] border-white/10 hover:bg-white/[0.08] hover:border-white/20"
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-amber-400 text-black flex items-center justify-center shadow-md">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                      <div className="w-14 h-14 rounded-xl overflow-hidden shadow-md ring-1 ring-white/15 shrink-0 bg-black/30">
                        <img
                          src={`/pwa-icons/${icon.id}/android-chrome-192x192.png`}
                          alt={icon.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <span className="text-xs font-semibold text-white/95 line-clamp-1">
                        {icon.name}
                      </span>
                      <span className="text-[10px] text-gray-400 line-clamp-1">
                        {icon.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Done button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCurrentView("main");
                }}
                className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-sm transition active:scale-[0.98] shadow-lg shadow-amber-400/20 cursor-pointer"
              >
                Xong
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 pb-[max(5rem,calc(env(safe-area-inset-bottom)+3.5rem))]">
          {/* Section: Chuyển đổi tài khoản (Account Switcher) */}
          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Tài khoản ({savedAccounts.length || (isAuth ? 1 : 0)})
              </h3>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigation?.setSettingTabOpen?.(false);
                  navigate("/login?mode=add_account");
                }}
                className="text-xs text-amber-400 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
              >
                <UserPlus size={13} />
                Thêm tài khoản
              </button>
            </div>

            <div className="rounded-2xl bg-white/[0.04] border border-white/5 divide-y divide-white/5 overflow-hidden">
              {savedAccounts.length > 0 ? (
                savedAccounts.map((acc) => {
                  const isCurrent =
                    Boolean(user?.uid && acc.uid === user.uid) ||
                    Boolean(user?.username && acc.username === user.username) ||
                    Boolean(user?.localId && acc.localId === user.localId);

                  return (
                    <div
                      key={acc.uid || acc.username}
                      className="flex items-center justify-between p-3.5 hover:bg-white/[0.05] transition"
                    >
                      <button
                        type="button"
                        onClick={async () => {
                          if (isCurrent || isSwitching) return;
                          setIsSwitching(true);
                          SonnerSuccess("Đang chuyển sang tài khoản", `@${acc.username}`);
                          try {
                            await switchToAccount(acc);
                          } catch (err) {
                            SonnerError("Không thể chuyển tài khoản", err.message);
                            setIsSwitching(false);
                          }
                        }}
                        disabled={isCurrent || isSwitching}
                        className="flex items-center gap-3 min-w-0 text-left flex-1 cursor-pointer"
                      >
                        <img
                          src={acc.avatar || "/locket-pro-icon-192x192.png"}
                          alt={acc.username}
                          className="w-9 h-9 rounded-full object-cover border border-white/15 shrink-0"
                          onError={(e) => {
                            e.currentTarget.src = "/locket-pro-icon-192x192.png";
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white truncate">
                            {acc.displayName || acc.username}
                          </p>
                          <p className="text-xs text-gray-400 truncate">@{acc.username}</p>
                        </div>
                      </button>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Đang dùng
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={async () => {
                                if (isSwitching) return;
                                setIsSwitching(true);
                                SonnerSuccess("Đang chuyển sang tài khoản", `@${acc.username}`);
                                try {
                                  await switchToAccount(acc);
                                } catch (err) {
                                  SonnerError("Không thể chuyển", err.message);
                                  setIsSwitching(false);
                                }
                              }}
                              className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold transition active:scale-95 shadow-sm cursor-pointer"
                            >
                              Đổi
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const updated = removeAccountFromPool(acc.uid || acc.username);
                                setSavedAccounts(updated);
                                SonnerSuccess("Đã xoá tài khoản khỏi máy", `@${acc.username}`);
                              }}
                              className="p-1 text-gray-500 hover:text-red-400 transition"
                              title="Gỡ tài khoản này"
                            >
                              <X size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : isAuth && user?.uid ? (
                <div className="flex items-center justify-between p-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={getAvatarSource(user)}
                      alt="avatar"
                      className="w-9 h-9 rounded-full object-cover border border-white/15 shrink-0"
                      onError={handleAvatarError}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                      <p className="text-xs text-gray-400 truncate">@{user?.username || "locket"}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Đang dùng
                  </span>
                </div>
              ) : (
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-400">
                    Chưa lưu tài khoản nào trên thiết bị này.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigation?.setSettingTabOpen?.(false);
                      navigate("/login?mode=add_account");
                    }}
                    className="mt-2 text-xs text-amber-400 font-bold hover:underline"
                  >
                    + Đăng nhập tài khoản
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Section 1: Giao diện */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-2 mb-2">
              Giao diện & Biểu tượng
            </h3>
            <div className="rounded-2xl bg-white/[0.04] border border-white/5 divide-y divide-white/5 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowThemePicker(!showThemePicker)}
                className="w-full flex items-center justify-between p-3.5 hover:bg-white/[0.05] transition text-left"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                    <Palette size={19} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">Chủ đề màu sắc</p>
                    <p className="text-xs text-gray-400 truncate">
                      {theme || "Mặc định"} • Vuốt để đổi màu
                    </p>
                  </div>
                </div>
                <ChevronRight size={17} className="text-gray-500 shrink-0" />
              </button>

              {showThemePicker && (
                <div className="p-3 bg-black/30 animate-fade-in border-t border-white/5">
                  <ThemeSelector />
                </div>
              )}

              {/* Đổi biểu tượng ứng dụng */}
              <button
                type="button"
                onClick={handleAppIconClick}
                className="w-full flex items-center justify-between p-3.5 hover:bg-white/[0.05] transition text-left cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl overflow-hidden shadow-md ring-1 ring-white/10 shrink-0">
                    <img
                      src={`/pwa-icons/${currentIconObj.id}/android-chrome-192x192.png`}
                      alt={currentIconObj.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">Đổi biểu tượng ứng dụng</p>
                    <p className="text-xs text-gray-400 truncate">
                      {currentIconObj.name} • Cài đặt WebApp
                    </p>
                  </div>
                </div>
                <ChevronRight size={17} className="text-gray-500 shrink-0" />
              </button>
            </div>
          </div>

          {/* Section: Gói dịch vụ */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-2 mb-2">
              Gói dịch vụ
            </h3>
            {accessRole === "vip" ? (
              vipPlanId === "vip_trial" || (vipPlanName && vipPlanName.includes("Dùng thử")) ? (
                /* VIP Dùng Thử Card */
                <div
                  className="rounded-2xl border border-emerald-500/40 overflow-hidden shadow-lg"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(20,184,166,0.12) 50%, rgba(6,182,212,0.18) 100%)",
                  }}
                >
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400/30 to-teal-500/30 border border-emerald-400/40 flex items-center justify-center shrink-0">
                        <Gift size={20} className="text-emerald-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-emerald-300">
                            VIP Dùng Thử (1 Ngày)
                          </p>
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                            Đang trải nghiệm
                          </span>
                        </div>
                        <p className="text-xs text-emerald-200/70 mt-0.5">
                          24h full VIP + tặng 1 ảnh AI miễn phí
                        </p>
                      </div>
                    </div>

                    {vipExpireAt && (
                      <>
                        <div className="h-px bg-emerald-500/15" />
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <Clock size={16} className="text-emerald-400/80" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-gray-400">Thời gian còn lại</p>
                            <p className="text-sm font-semibold text-emerald-300">
                              {(() => {
                                const diff = vipExpireAt - Date.now();
                                if (diff <= 0) return "Đã hết hạn";
                                const hours = Math.floor(diff / (1000 * 60 * 60));
                                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                if (hours > 0) return `Còn ${hours} giờ ${minutes} phút`;
                                return `Còn ${minutes} phút`;
                              })()}
                            </p>
                          </div>
                        </div>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        navigate("/pricing");
                      }}
                      className="w-full py-2.5 rounded-xl text-xs font-bold text-white transition flex items-center justify-center gap-2 shadow-md"
                      style={{
                        background: "linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)",
                      }}
                    >
                      <Crown size={14} />
                      Nâng cấp gói VIP chính thức
                    </button>
                  </div>
                </div>
              ) : (
                /* VIP Chính thức / Vĩnh viễn */
                <div
                  className="rounded-2xl border border-amber-500/30 overflow-hidden"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(217,119,6,0.08) 50%, rgba(180,83,9,0.12) 100%)",
                  }}
                >
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400/30 to-orange-500/30 border border-amber-400/40 flex items-center justify-center shrink-0">
                        <Crown size={20} className="text-amber-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-amber-300">
                            {vipPlanName || "VIP"}
                          </p>
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                            {vipPlanId === "vip_lifetime" || !vipExpireAt ? "👑 Trọn đời" : "Đang hoạt động"}
                          </span>
                        </div>
                        <p className="text-xs text-amber-200/60 mt-0.5">
                          {vipPlanId === "vip_lifetime" || !vipExpireAt
                            ? "Đặc quyền VIP trọn đời không giới hạn"
                            : "Thành viên cao cấp"}
                        </p>
                      </div>
                    </div>

                    {vipExpireAt ? (
                      <>
                        <div className="h-px bg-amber-500/15" />
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                            <CalendarClock size={16} className="text-amber-400/70" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-gray-400">Thời hạn</p>
                            <p className="text-sm text-amber-200/90 font-medium">
                              {(() => {
                                const expireDate = new Date(vipExpireAt);
                                const planDaysMap = { "VIP 1 Năm": 365, "VIP 6 Tháng": 180, "VIP 3 Tháng": 90, "VIP 1 Tháng": 30 };
                                const days = planDaysMap[vipPlanName] || 30;
                                const startDate = new Date(vipExpireAt - days * 24 * 60 * 60 * 1000);
                                return `${startDate.toLocaleDateString("vi-VN")} → ${expireDate.toLocaleDateString("vi-VN")}`;
                              })()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                            <Clock size={16} className="text-amber-400/70" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-gray-400">Còn lại</p>
                            <p className="text-sm font-semibold text-amber-300">
                              {(() => {
                                const remaining = Math.ceil((vipExpireAt - Date.now()) / (24 * 60 * 60 * 1000));
                                return remaining > 0 ? `${remaining} ngày` : "Đã hết hạn";
                              })()}
                            </p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-200 flex items-center gap-2">
                        <Crown size={15} className="text-amber-400 shrink-0" />
                        <span>Tài khoản VIP Vĩnh viễn không bao giờ hết hạn.</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            ) : !hasUsedTrial ? (
              /* Gói Dùng Thử 1 Ngày 0đ (Hiển thị ngay cho user chưa dùng thử) */
              <div
                className="rounded-2xl border border-emerald-500/40 overflow-hidden shadow-xl"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(20,184,166,0.12) 50%, rgba(6,182,212,0.18) 100%)",
                }}
              >
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400/30 to-teal-500/30 border border-emerald-400/40 flex items-center justify-center shrink-0">
                      <Gift size={20} className="text-emerald-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-emerald-300">
                          Gói Dùng Thử 1 Ngày (0đ)
                        </p>
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                          Miễn phí 1 lần
                        </span>
                      </div>
                      <p className="text-xs text-emerald-200/70 mt-0.5">
                        Mở full tính năng VIP 24h & tặng 1 ảnh AI
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleClaimTrial}
                    disabled={claimingTrial}
                    className="w-full py-2.5 rounded-xl text-sm font-bold text-black transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                    style={{
                      background: "linear-gradient(135deg, #10b981 0%, #14b8a6 50%, #06b6d4 100%)",
                    }}
                  >
                    {claimingTrial ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Đang kích hoạt...
                      </>
                    ) : (
                      <>
                        <Gift size={16} />
                        Kích hoạt Dùng Thử 0đ Ngay
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate("/pricing");
                    }}
                    className="w-full text-center text-xs text-gray-400 hover:text-white transition pt-1"
                  >
                    Hoặc xem các gói VIP chính thức →
                  </button>
                </div>
              </div>
            ) : (
              /* Gói Free (Đã dùng thử) */
              <div className="rounded-2xl bg-white/[0.04] border border-white/5 overflow-hidden">
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-500/15 border border-gray-500/30 flex items-center justify-center shrink-0">
                      <Sparkles size={20} className="text-gray-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">Gói Miễn Phí</p>
                        <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          Đã dùng thử 1N
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Nâng cấp VIP để mở khóa không giới hạn tính năng
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate("/pricing");
                    }}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition"
                    style={{
                      background: "linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)",
                    }}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Crown size={16} />
                      Nâng cấp VIP
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* AI Filter Credits Info */}
            <div
              className="mt-3 rounded-2xl border border-violet-500/30 overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(109,40,217,0.08) 50%, rgba(91,33,182,0.12) 100%)",
              }}
            >
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400/30 to-purple-500/30 border border-violet-400/40 flex items-center justify-center shrink-0">
                    <Sparkles size={20} className="text-violet-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-violet-300">AI Filter</p>
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${
                        (aiCredits || 0) > 0
                          ? "bg-violet-400/20 text-violet-300 border-violet-400/30"
                          : "bg-red-400/20 text-red-300 border-red-400/30"
                      }`}>
                        {(aiCredits || 0) > 0 ? "Khả dụng" : "Hết lượt"}
                      </span>
                    </div>
                    <p className="text-xs text-violet-200/60 mt-0.5">
                      Số dư: <strong className="text-white text-sm">{(aiCredits || 0)}</strong> lượt tạo ảnh
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate("/pricing?tab=ai");
                  }}
                  className="w-full py-2 rounded-xl text-xs font-semibold text-white transition flex items-center justify-center gap-1.5"
                  style={{
                    background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%)",
                  }}
                >
                  <Sparkles size={14} />
                  Nạp thêm lượt AI Filter
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Thông tin tài khoản */}
          {isAuth && user?.uid && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-2 mb-2">
                Thông tin tài khoản
              </h3>
              <div className="rounded-2xl bg-white/[0.04] border border-white/5 divide-y divide-white/5 overflow-hidden">
                {/* Sửa tên */}
                <button
                  type="button"
                  onClick={() => setShowNameModal(true)}
                  className="w-full flex items-center justify-between p-3.5 hover:bg-white/[0.05] transition text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0">
                      <UserRoundPen size={19} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">Sửa tên</p>
                      <p className="text-xs text-gray-400 truncate">{displayName}</p>
                    </div>
                  </div>
                  <ChevronRight size={17} className="text-gray-500 shrink-0" />
                </button>

                {/* Email */}
                <div className="flex items-center justify-between p-3.5">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                      <Mail size={19} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">Email</p>
                      <p className="text-xs text-gray-400 truncate">
                        {user?.email || "Chưa liên kết email"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Mã tài khoản */}
                <div
                  className="flex items-center justify-between p-3.5 hover:bg-white/[0.03] transition cursor-pointer"
                  onClick={handleCopyUid}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <Hash size={19} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">Mã tài khoản</p>
                      <p className="text-xs text-gray-400 font-mono truncate">
                        {user?.uid || "Không có"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-gray-300"
                    aria-label="Sao chép UID"
                  >
                    {copiedUid ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                  </button>
                </div>

                {/* Ngày tham gia */}
                <div className="flex items-center justify-between p-3.5">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <Calendar size={19} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">Ngày tham gia</p>
                      <p className="text-xs text-gray-400">{joinDateFormatted}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Tính năng Locket (Từ menu chuyển vào) */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-2 mb-2">
              Tính năng Locket
            </h3>
            <div className="rounded-2xl bg-white/[0.04] border border-white/5 divide-y divide-white/5 overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate("/tools");
                }}
                className="w-full flex items-center justify-between p-3.5 hover:bg-white/[0.05] transition text-left cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <Wrench size={19} className="text-blue-400" />
                  <span className="text-sm font-medium text-white">Công cụ Locket</span>
                </div>
                <ChevronRight size={17} className="text-gray-500" />
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate("/diary");
                }}
                className="w-full flex items-center justify-between p-3.5 hover:bg-white/[0.05] transition text-left cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <CalendarClock size={19} className="text-orange-400" />
                  <span className="text-sm font-medium text-white">Nhật ký Locket</span>
                </div>
                <ChevronRight size={17} className="text-gray-500" />
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate("/newsfeed");
                }}
                className="w-full flex items-center justify-between p-3.5 hover:bg-white/[0.05] transition text-left cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <Newspaper size={19} className="text-emerald-400" />
                  <span className="text-sm font-medium text-white">Bảng tin</span>
                </div>
                <ChevronRight size={17} className="text-gray-500" />
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate("/privacy");
                }}
                className="w-full flex items-center justify-between p-3.5 hover:bg-white/[0.05] transition text-left cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <ShieldCheck size={19} className="text-cyan-400" />
                  <span className="text-sm font-medium text-white">Chính sách bảo mật</span>
                </div>
                <ChevronRight size={17} className="text-gray-500" />
              </button>
            </div>
          </div>

          {/* Section 4: Quyền riêng tư */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-2 mb-2">
              Quyền riêng tư
            </h3>
            <div className="rounded-2xl bg-white/[0.04] border border-white/5 p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3.5 min-w-0 pr-2">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                  <Eye size={19} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">Trạng thái xem Moments</p>
                  <p className="text-xs text-gray-400">
                    Khi bật, người khác sẽ biết bạn đã xem Moments của họ.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={showSeenStatus}
                onChange={handleToggleSeenStatus}
                className="toggle toggle-primary toggle-sm shrink-0"
              />
            </div>
          </div>

          {/* Section 5: Vùng nguy hiểm */}
          {isAuth && user?.uid && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-red-400/80 px-2 mb-2">
                Vùng nguy hiểm
              </h3>
              <div className="rounded-2xl bg-red-950/20 border border-red-500/15 divide-y divide-red-500/10 overflow-hidden">
                {/* Đăng xuất */}
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={Boolean(sessionAction) || operationsBusy}
                  className="w-full flex items-center gap-3.5 p-3.5 hover:bg-red-500/10 transition text-left disabled:opacity-50 cursor-pointer"
                >
                  <LogOut size={19} className="text-red-400" />
                  <span className="text-sm font-semibold text-red-300">Đăng xuất</span>
                </button>

                {/* Xoá dữ liệu */}
                <button
                  type="button"
                  onClick={handleClearBrowserData}
                  disabled={Boolean(sessionAction)}
                  className="w-full flex items-center justify-between p-3.5 hover:bg-red-500/10 transition text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <Trash2 size={19} className="text-red-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-red-300">
                        Xoá dữ liệu trên trình duyệt
                      </p>
                      <p className="text-xs text-gray-400">
                        Mọi tài khoản đã lưu và cài đặt trên máy này
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Modal Sửa Tên Nhanh */}
      {showNameModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[#1b212c] border border-white/15 p-6 rounded-2xl w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Đổi tên hiển thị</h3>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Nhập tên mới"
              className="input input-bordered w-full bg-white/5 border-white/20 text-white mt-2"
            />
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setShowNameModal(false)}
                className="btn btn-ghost btn-sm text-gray-400"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  if (customName.trim()) {
                    useAuthStore.setState((prev) => ({
                      user: { ...prev.user, displayName: customName.trim() },
                    }));
                    SonnerSuccess("Đã lưu tên mới!", customName.trim());
                  }
                  setShowNameModal(false);
                }}
                className="btn btn-primary btn-sm"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
