import React, { useEffect, useState } from "react";
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
import { instanceMain } from "@/libs/instanceMain";
import {
  SonnerInfo,
  SonnerSuccess,
  SonnerWarning,
} from "@/components/ui/SonnerToast";

export default function PayPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const orderCode = searchParams.get("orderCode");

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rechecking, setRechecking] = useState(false);

  useEffect(() => {
    if (!orderCode) return;
    fetchOrder();
  }, [orderCode]);

  const fetchOrder = async () => {
    try {
      const res = await instanceMain.get(`/api/payment/order/${orderCode}`);
      if (res.data?.success) {
        setOrder(res.data.data);
      }
    } catch (error) {
      console.error("Lỗi khi lấy đơn hàng:", error);
    } finally {
      setLoading(false);
    }
  };

  const recheckOrder = async () => {
    setRechecking(true);
    try {
      const res = await instanceMain.post(`/api/payment/check-order/${orderCode}`);
      if (res.data?.success) {
        const data = res.data.data;
        setOrder(data);
        if (data.status === "PAID") {
          SonnerSuccess("🎉 Thanh toán thành công! VIP đã được kích hoạt.");
        } else if (data.status === "CANCELLED") {
          SonnerInfo("Đơn hàng đã bị huỷ.");
        } else {
          SonnerInfo("Đơn hàng chưa được thanh toán.");
        }
      }
    } catch (error) {
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
            Gói <strong>{order.planName}</strong> đã được kích hoạt cho{" "}
            <strong>@{order.username}</strong>
          </p>
          <div className="space-y-3">
            <button
              onClick={() => navigate("/locket-beta")}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 font-bold text-sm transition"
            >
              Bắt đầu sử dụng VIP
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
          <button
            onClick={() => navigate("/pricing")}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 font-bold text-sm transition"
          >
            Mua gói mới
          </button>
        </div>
      </div>
    );
  }

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
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold">
          <Clock className="w-3 h-3" />
          Chờ thanh toán
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
            <span className="text-sm text-gray-400">Gói</span>
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

        {/* QR Code */}
        {order.checkoutUrl && (
          <div className="bg-white rounded-2xl p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <QrCode className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-bold text-gray-800">
                Quét mã để thanh toán
              </span>
            </div>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(order.checkoutUrl)}`}
              alt="QR thanh toán"
              className="w-56 h-56 mx-auto rounded-xl"
              onError={(e) => { e.target.style.display = "none"; }}
            />
            <p className="text-xs text-gray-500 mt-2">
              Quét mã QR hoặc ấn nút bên dưới để thanh toán
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
          disabled={rechecking}
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

        {/* Notes */}
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 text-xs text-yellow-200/80 space-y-1">
          <p>• Hệ thống sẽ tự động kích hoạt VIP sau khi thanh toán (1-5 phút).</p>
          <p>• Nếu chưa được kích hoạt, ấn "Kiểm tra ngay" phía trên.</p>
          <p>• Liên hệ hỗ trợ: <strong>tienmanh6811@gmail.com</strong></p>
        </div>
      </div>
    </div>
  );
}
