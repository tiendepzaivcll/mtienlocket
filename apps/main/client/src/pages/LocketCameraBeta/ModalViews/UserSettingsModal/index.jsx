import React, { useRef, useState } from "react";
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
  Copy,
  Check,
  Crown,
  Clock,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore, useUploadQueueStore } from "@/stores";
import { useApp } from "@/context/AppContext";
import { useTheme } from "@/hooks/useTheme";
import { getAvatarSource, handleAvatarError } from "@/utils/avatar";
import { SonnerSuccess, SonnerError } from "@/components/ui/SonnerToast";
import ThemeSelector from "@/components/Theme/ThemeSelector";

export default function UserSettingsModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { user, clearAndlogout, accessRole, vipPlanName, vipExpireAt } = useAuthStore();
  const { camera, useloading } = useApp();
  const queueBusy = useUploadQueueStore((state) => state.isQueueRunning ||
    state.uploadItems.some((item) => item.status === "queued" || item.status === "uploading"));
  const operationsBusy = Boolean(queueBusy || camera.isHolding || useloading.sendLoading ||
    useloading.uploadLoading || useloading.isAiGenerating);
  const { theme } = useTheme();
  const [sessionAction, setSessionAction] = useState(null);
  const endingSessionRef = useRef(false);

  const [copiedUid, setCopiedUid] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
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

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
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
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/10 shrink-0">
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
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-gray-300 hover:text-white transition"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Section 1: Giao diện */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-2 mb-2">
              Giao diện
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
                    <p className="text-sm font-semibold text-white">Chủ đề & kiểu giao diện</p>
                    <p className="text-xs text-gray-400 truncate">
                      {theme || "Mặc định"} • Phong cách tinh tế
                    </p>
                  </div>
                </div>
                <ChevronRight size={17} className="text-gray-500 shrink-0" />
              </button>

              {showThemePicker && (
                <div className="p-3 bg-black/30 animate-fade-in">
                  <ThemeSelector />
                </div>
              )}
            </div>
          </div>

          {/* Section: Gói dịch vụ */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-2 mb-2">
              Gói dịch vụ
            </h3>
            {accessRole === "vip" ? (
              <div
                className="rounded-2xl border border-amber-500/30 overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(217,119,6,0.08) 50%, rgba(180,83,9,0.12) 100%)",
                }}
              >
                <div className="p-4 space-y-3">
                  {/* VIP Badge & Plan Name */}
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
                          Đang hoạt động
                        </span>
                      </div>
                      <p className="text-xs text-amber-200/60 mt-0.5">Thành viên cao cấp</p>
                    </div>
                  </div>

                  {/* Validity Period */}
                  {vipExpireAt && (
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
                              const now = Date.now();
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
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-white/[0.04] border border-white/5 overflow-hidden">
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-500/15 border border-gray-500/30 flex items-center justify-center shrink-0">
                      <Sparkles size={20} className="text-gray-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">Gói Miễn Phí</p>
                      <p className="text-xs text-gray-400">Nâng cấp để mở khóa tính năng cao cấp</p>
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
          </div>

          {/* Section 2: Chung */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-2 mb-2">
              Chung
            </h3>
            <div className="rounded-2xl bg-white/[0.04] border border-white/5 divide-y divide-white/5 overflow-hidden">
              {/* Chuyển tài khoản */}
              <button
                type="button"
                onClick={() => endSession("switch")}
                disabled={Boolean(sessionAction) || operationsBusy}
                aria-busy={sessionAction === "switch"}
                className="w-full flex items-center justify-between p-3.5 hover:bg-white/[0.05] transition text-left disabled:opacity-50 disabled:cursor-wait"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                    <Users size={19} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{sessionAction === "switch" ? "Đang chuyển tài khoản…" : "Chuyển tài khoản"}</p>
                    <p className="text-xs text-gray-400">{operationsBusy ? "Đợi gửi ảnh hoặc hàng đợi hoàn tất" : "Đăng nhập bằng tài khoản khác"}</p>
                  </div>
                </div>
                <ChevronRight size={17} className="text-gray-500 shrink-0" />
              </button>

              {/* Sửa tên */}
              <button
                type="button"
                onClick={() => setShowNameModal(true)}
                className="w-full flex items-center justify-between p-3.5 hover:bg-white/[0.05] transition text-left"
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

          {/* Section 3: Tính năng & Điều hướng (Từ menu 3 gạch chuyển vào) */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-2 mb-2">
              Tính năng Locket
            </h3>
            <div className="rounded-2xl bg-white/[0.04] border border-white/5 divide-y divide-white/5 overflow-hidden">
              {/* Nâng cấp VIP */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate("/pricing");
                }}
                className="w-full flex items-center justify-between p-3.5 hover:bg-white/[0.05] transition text-left group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/25 to-orange-500/25 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                    <Crown size={19} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-300 group-hover:text-amber-200">Nâng cấp VIP</p>
                    <p className="text-xs text-gray-400">Mở khóa tất cả tính năng cao cấp</p>
                  </div>
                </div>
                <ChevronRight size={17} className="text-amber-500/50" />
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate("/download");
                }}
                className="w-full flex items-center justify-between p-3.5 hover:bg-white/[0.05] transition text-left"
              >
                <div className="flex items-center gap-3.5">
                  <Smartphone size={19} className="text-purple-400" />
                  <span className="text-sm font-medium text-white">Cài đặt WebApp</span>
                </div>
                <ChevronRight size={17} className="text-gray-500" />
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate("/tools");
                }}
                className="w-full flex items-center justify-between p-3.5 hover:bg-white/[0.05] transition text-left"
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
                className="w-full flex items-center justify-between p-3.5 hover:bg-white/[0.05] transition text-left"
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
                className="w-full flex items-center justify-between p-3.5 hover:bg-white/[0.05] transition text-left"
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
                  navigate("/contact");
                }}
                className="w-full flex items-center justify-between p-3.5 hover:bg-white/[0.05] transition text-left"
              >
                <div className="flex items-center gap-3.5">
                  <MessageCircle size={19} className="text-teal-400" />
                  <span className="text-sm font-medium text-white">Liên hệ admin</span>
                </div>
                <ChevronRight size={17} className="text-gray-500" />
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate("/privacy");
                }}
                className="w-full flex items-center justify-between p-3.5 hover:bg-white/[0.05] transition text-left"
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
                className="w-full flex items-center gap-3.5 p-3.5 hover:bg-red-500/10 transition text-left disabled:opacity-50"
              >
                <LogOut size={19} className="text-red-400" />
                <span className="text-sm font-semibold text-red-300">Đăng xuất</span>
              </button>

              {/* Xoá dữ liệu */}
              <button
                type="button"
                onClick={handleClearBrowserData}
                disabled={Boolean(sessionAction)}
                className="w-full flex items-center justify-between p-3.5 hover:bg-red-500/10 transition text-left"
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
        </div>
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
    </div>
  );
}
