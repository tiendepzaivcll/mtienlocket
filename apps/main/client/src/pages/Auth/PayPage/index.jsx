import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CheckCircle,
  XCircle,
  Loader2,
  ArrowLeft,
  ExternalLink,
  QrCode,
  Clock,
  User,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { instanceMain } from "@/libs/instanceMain";
import { useAuthStore } from "@/stores";
import {
  SonnerInfo,
  SonnerSuccess,
  SonnerWarning,
} from "@/components/ui/SonnerToast";

export default function PayPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const refreshAccessRole = useAuthStore((state) => state.refreshAccessRole);
  const searchParams = new URLSearchParams(location.search);
  const orderCode = searchParams.get("orderCode");
  const returnCancel = searchParams.get("cancel") === "true";

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rechecking, setRechecking] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300);
  const syncedPaidRef = useRef(false);

  // Đếm ngược 5 phút thanh toán tự động huỷ
  useEffect(() => {
    if (!order || order.status !== "PENDING") return;
    const expireMs = order.expiresAt
      ? new Date(order.expiresAt).getTime()
      : new Date(order.createdAt).getTime() + 5 * 60 * 1000;

    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((expireMs - Date.now()) / 1000));
      setTimeLeft(diff);
      if (diff <= 0) {
        setOrder((prev) =>
          prev
            ? {
                ...prev,
                status: "CANCELLED",
                cancelReason: "Hết hạn thanh toán (5 phút)",
              }
            : null,
        );
        SonnerWarning("Đơn hàng đã hết hạn thanh toán (5 phút) và tự động huỷ.");
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [order?.status, order?.expiresAt, order?.createdAt]);

  const handleCancelOrder = async () => {
    if (!orderCode) return;
    if (!window.confirm("Bạn có chắc chắn muốn huỷ đơn thanh toán này không?")) return;
    setCancelling(true);
    try {
      const res = await instanceMain.post(`/api/payment/cancel-order/${orderCode}`);
      if (res.data?.success) {
        setOrder(res.data.data);
        SonnerInfo("Đã huỷ đơn hàng.");
      }
    } catch {
      SonnerWarning("Không thể huỷ đơn hàng.");
    } finally {
      setCancelling(false);
    }
  };

  const isAiPlan =
    order?.planCategory === "ai_filter" ||
    String(order?.planId || "").startsWith("ai_");

  const syncEntitlementAfterPaid = useCallback(async () => {
    if (syncedPaidRef.current) return;
    syncedPaidRef.current = true;
    try {
      await refreshAccessRole();
    } catch {
      // Ignore if guest user (not logged in yet)
    }
  }, [refreshAccessRole]);

  useEffect(() => {
    if (!orderCode) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const res = await instanceMain.get(`/api/payment/order/${orderCode}`);
        if (res.data?.success) {
          const data = res.data.data;
          setOrder(data);
          if (data.status === "PAID") {
            await syncEntitlementAfterPaid();
          } else if (data.status === "PENDING" && !returnCancel) {
            // Kiểm tra trực tiếp PayOS ngay khi vừa mở / quay về trang kết quả
            try {
              const checkRes = await instanceMain.post(
                `/api/payment/check-order/${orderCode}`,
              );
              if (checkRes.data?.success && checkRes.data.data) {
                setOrder(checkRes.data.data);
                if (checkRes.data.data.status === "PAID") {
                  await syncEntitlementAfterPaid();
                  SonnerSuccess("🎉 Thanh toán thành công! Đã kích hoạt tự động.");
                }
              }
            } catch {
              // Bỏ qua nếu đang chờ khách quét mã
            }
          }
        }
      } catch (error) {
        console.error("Lỗi khi lấy đơn hàng:", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [orderCode, returnCancel, syncEntitlementAfterPaid]);

  // Auto-polling: kiểm tra mỗi 3 giây khi đơn hàng đang PENDING
  useEffect(() => {
    if (!orderCode || !order || order.status !== "PENDING") return;
    const interval = setInterval(async () => {
      try {
        const res = await instanceMain.post(`/api/payment/check-order/${orderCode}`);
        if (res.data?.success) {
          const data = res.data.data;
          if (data.status === "PAID") {
            setOrder(data);
            await syncEntitlementAfterPaid();
            SonnerSuccess(
              `🎉 Thanh toán thành công! ${data.planName || "Gói dịch vụ"} đã được kích hoạt.`,
            );
            clearInterval(interval);
          } else if (data.status === "CANCELLED") {
            setOrder(data);
            SonnerInfo("Đơn hàng đã bị huỷ.");
            clearInterval(interval);
          }
        }
      } catch {
        // im lặng khi auto-check
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [orderCode, order?.status, syncEntitlementAfterPaid]);

  const recheckOrder = async () => {
    setRechecking(true);
    try {
      const res = await instanceMain.post(`/api/payment/check-order/${orderCode}`);
      if (res.data?.success) {
        const data = res.data.data;
        setOrder(data);
        if (data.status === "PAID") {
          await syncEntitlementAfterPaid();
          SonnerSuccess(
            `🎉 Thanh toán thành công! ${data.planName || "Gói dịch vụ"} đã được kích hoạt.`,
          );
        } else if (data.status === "CANCELLED") {
          SonnerInfo("Đơn hàng đã bị huỷ.");
        } else {
          SonnerInfo("Đơn hàng chưa nhận thanh toán. Hệ thống vẫn đang tự kiểm tra mỗi 3 giây.");
        }
      }
    } catch {
      SonnerWarning("Không thể kiểm tra đơn hàng.");
    } finally {
      setRechecking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center text-white">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Không tìm thấy đơn hàng</h2>
          <button
            onClick={() => navigate("/pricing")}
            className="mt-4 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 font-medium transition"
          >
            Quay lại trang gói
          </button>
        </div>
      </div>
    );
  }

  // ─── PAID ──────────────────────────────────────────────────
  if (order.status === "PAID") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4 text-white">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 w-full max-w-sm text-center space-y-5">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-xl font-bold">🎉 Thanh toán thành công!</h2>
          <p className="text-sm text-gray-300">
            Gói <strong>{order.planName}</strong> đã được kích hoạt tự động cho{" "}
            <strong>@{order.username}</strong>
          </p>
          <div className="space-y-3">
            <button
              onClick={async () => {
                await refreshAccessRole();
                navigate("/locket-beta");
              }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 font-bold text-sm transition"
            >
              {isAiPlan ? "Dùng ngay AI Filter" : "Bắt đầu sử dụng VIP"}
            </button>
            <button
              onClick={() => navigate("/pricing")}
              className="w-full py-3 rounded-xl bg-white/10 font-medium text-sm hover:bg-white/20 transition"
            >
              Mua thêm gói khác
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── CANCELLED ─────────────────────────────────────────────
  if (order.status === "CANCELLED") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4 text-white">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 w-full max-w-sm text-center space-y-5">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold">Đơn hàng đã huỷ</h2>
          <p className="text-xs text-gray-300">
            {order.cancelReason || "Đơn hàng chưa thanh toán hoặc đã quá hạn 5 phút."}
          </p>
          <button
            onClick={() => navigate("/pricing")}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 font-bold text-sm transition"
          >
            Quay lại chọn gói mới
          </button>
        </div>
      </div>
    );
  }

  const qrPayload = order.qrCode || order.checkoutUrl;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = String(timeLeft % 60).padStart(2, "0");

  // ─── PENDING ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate("/pricing")}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold flex-1">Thanh toán</h1>
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
            timeLeft < 60
              ? "bg-red-500/20 text-red-400 animate-pulse border border-red-500/30"
              : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
          }`}
          title="Đơn hàng sẽ tự động huỷ sau 5 phút nếu chưa thanh toán"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Còn {minutes}:{seconds}</span>
        </div>
      </div>

      <div className="px-4 pb-10 max-w-lg mx-auto space-y-5">
        {/* Order info */}
        <div className="bg-white/5 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Người dùng</span>
            <span className="font-bold flex items-center gap-1.5">
              <User className="w-4 h-4 text-purple-400" />
              @{order.username}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Gói đăng ký</span>
            <span className="font-bold">{order.planName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Số tiền</span>
            <span className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              {order.price?.toLocaleString("vi-VN")}đ
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Mã đơn</span>
            <span className="text-sm font-mono text-gray-300">#{order.orderCode}</span>
          </div>
        </div>

        {/* QR Code VietQR */}
        {qrPayload && (
          <div className="bg-white rounded-2xl p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <QrCode className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-bold text-gray-800">
                Quét mã VietQR bằng App Ngân hàng
              </span>
            </div>
            <div className="flex justify-center">
              <QRCodeSVG
                value={qrPayload}
                size={224}
                level="M"
                includeMargin={true}
                bgColor="#FFFFFF"
                fgColor="#000000"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Quét trực tiếp bằng app ngân hàng hoặc mở trang PayOS bên dưới
            </p>
          </div>
        )}

        {/* Checkout link */}
        {order.checkoutUrl && (
          <a
            href={order.checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 font-bold text-sm transition"
          >
            <ExternalLink className="w-4 h-4" />
            Mở trang thanh toán PayOS
          </a>
        )}

        {/* Recheck button */}
        <button
          onClick={recheckOrder}
          disabled={rechecking || cancelling}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 font-bold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {rechecking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Đang kiểm tra...
            </>
          ) : (
            "Đã thanh toán? Kiểm tra ngay"
          )}
        </button>

        {/* Cancel button */}
        <button
          type="button"
          onClick={handleCancelOrder}
          disabled={cancelling || rechecking}
          className="w-full py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {cancelling ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Đang huỷ đơn...
            </>
          ) : (
            <>
              <XCircle className="w-3.5 h-3.5" />
              Huỷ thanh toán đơn hàng này
            </>
          )}
        </button>

        {/* Notes */}
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 text-xs text-yellow-200/80 space-y-1">
          <p>• Hệ thống <strong>tự động kiểm tra mỗi 3 giây</strong> và kích hoạt ngay sau khi chuyển khoản.</p>
          <p>• Không sửa nội dung chuyển khoản khi quét VietQR.</p>
          <p>• Liên hệ hỗ trợ: <strong>tienmanh6811@gmail.com</strong></p>
        </div>
      </div>
    </div>
  );
}
