import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Crown,
  Check,
  X,
  Sparkles,
  Video,
  Camera,
  Wand2,
  Upload,
  Eye,
  MessageSquare,
  Flame,
  Loader2,
  Star,
  Zap,
  ArrowLeft,
} from "lucide-react";
import { instanceMain } from "@/libs/instanceMain";
import {
  SonnerSuccess,
  SonnerWarning,
  SonnerInfo,
} from "@/components/ui/SonnerToast";

// ─── Feature comparison data ────────────────────────────────────────
const FEATURE_ROWS = [
  { icon: Video, label: "Thời lượng video", free: "5 giây", vip: "30 giây" },
  {
    icon: Flame,
    label: "Khôi phục streak",
    free: "0 lần/tháng",
    vip: "Không giới hạn",
  },
  {
    icon: Camera,
    label: "Khung Photobooth",
    free: "3 khung cơ bản",
    vip: "Tất cả khung",
  },
  {
    icon: Wand2,
    label: "Bộ lọc AI",
    free: "Không có",
    vip: "Đầy đủ bộ lọc AI",
  },
  {
    icon: Upload,
    label: "Chất lượng upload",
    free: "Tiêu chuẩn",
    vip: "HD cao nhất",
  },
  {
    icon: Eye,
    label: "Trạng thái đã xem",
    free: false,
    vip: true,
    isBoolean: true,
  },
  {
    icon: MessageSquare,
    label: "Caption tuỳ chỉnh",
    free: "Cơ bản",
    vip: "Đầy đủ + tuỳ chỉnh",
  },
];

export default function PricingPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(null); // planId being purchased
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    fetchPlans();
    fetchSubscription();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await instanceMain.get("/api/payment/plans");
      setPlans(res.data?.data?.plans || []);
    } catch {
      // fallback plans
      setPlans([
        {
          id: "vip_1month",
          name: "VIP 1 Tháng",
          price: 25000,
          days: 30,
          badge: null,
        },
        {
          id: "vip_6months",
          name: "VIP 6 Tháng",
          price: 99000,
          days: 180,
          badge: "Phổ biến",
        },
        {
          id: "vip_1year",
          name: "VIP 1 Năm",
          price: 149000,
          days: 365,
          badge: "Tốt nhất",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscription = async () => {
    try {
      const res = await instanceMain.get("/api/payment/my-subscription");
      if (res.data?.success) {
        setSubscription(res.data.data);
      }
    } catch {
      // Not logged in or error — ignore
    }
  };

  const handlePurchase = async (planId) => {
    setCreating(planId);
    try {
      const res = await instanceMain.post("/api/payment/create-order", {
        planId,
      });
      if (res.data?.success) {
        const { orderCode, checkoutUrl } = res.data.data;
        SonnerSuccess("Đơn hàng đã tạo thành công!");
        // Navigate to payment page
        navigate(`/pay?orderCode=${orderCode}`);
      } else {
        SonnerWarning(res.data?.message || "Không thể tạo đơn hàng");
      }
    } catch (err) {
      const msg =
        err.response?.data?.message || "Lỗi tạo đơn hàng. Vui lòng thử lại.";
      SonnerWarning(msg);
    } finally {
      setCreating(null);
    }
  };

  const pricePerMonth = (plan) => {
    const months = plan.days / 30;
    return Math.round(plan.price / months);
  };

  const discount = (plan) => {
    if (plans.length === 0) return 0;
    const basePrice = plans[0]?.price; // 1 month price
    const months = plan.days / 30;
    const fullPrice = basePrice * months;
    return Math.round(((fullPrice - plan.price) / fullPrice) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      {/* Header */}
      <div className="relative px-4 pt-6 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="absolute left-4 top-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 pb-10 max-w-lg mx-auto">
        {/* Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold px-4 py-1.5 rounded-full text-sm mb-4">
            <Crown className="w-4 h-4" />
            LOCKET VIP
          </div>
          <h1 className="text-2xl font-bold mb-2">Nâng cấp trải nghiệm</h1>
          <p className="text-sm text-gray-400">
            Mở khoá tất cả tính năng cao cấp
          </p>
        </div>

        {/* Current subscription */}
        {subscription?.hasVip && (
          <div className="mb-6 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-5 h-5 text-yellow-400" />
              <span className="font-bold text-yellow-400">VIP đang hoạt động</span>
            </div>
            <p className="text-sm text-gray-300">
              Gói: <strong>{subscription.planName}</strong> • Còn{" "}
              <strong>{subscription.remainingDays} ngày</strong>
            </p>
          </div>
        )}

        {/* Plan cards */}
        <div className="space-y-4 mb-8">
          {plans.map((plan, idx) => {
            const isPopular = plan.badge === "Phổ biến";
            const isBest = plan.badge === "Tốt nhất";
            const isHighlighted = isPopular || isBest;
            const disc = discount(plan);

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-[2px] transition-all ${
                  isHighlighted
                    ? "bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-500"
                    : "bg-white/10"
                }`}
              >
                {/* Badge */}
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <span
                      className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                        isBest
                          ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-black"
                          : "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                      }`}
                    >
                      {isBest ? (
                        <Star className="w-3 h-3" />
                      ) : (
                        <Zap className="w-3 h-3" />
                      )}
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div
                  className={`rounded-2xl p-5 ${
                    isHighlighted ? "bg-gray-900" : "bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold">{plan.name}</h3>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                          {plan.price.toLocaleString("vi-VN")}đ
                        </span>
                        {disc > 0 && (
                          <span className="text-xs line-through text-gray-500">
                            {(plans[0].price * (plan.days / 30)).toLocaleString(
                              "vi-VN",
                            )}
                            đ
                          </span>
                        )}
                      </div>
                      {plan.days > 30 && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          ~{pricePerMonth(plan).toLocaleString("vi-VN")}đ/tháng
                          {disc > 0 && (
                            <span className="ml-2 text-green-400 font-bold">
                              -{ disc}%
                            </span>
                          )}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handlePurchase(plan.id)}
                      disabled={creating !== null}
                      className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                        isHighlighted
                          ? "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/25"
                          : "bg-white/10 hover:bg-white/20 text-white"
                      } disabled:opacity-50`}
                    >
                      {creating === plan.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Mua ngay"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Feature comparison */}
        <div className="bg-white/5 rounded-2xl p-5">
          <h2 className="text-lg font-bold mb-4 text-center flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            So sánh tính năng
          </h2>

          <div className="grid grid-cols-3 text-xs font-bold text-center mb-3 pb-3 border-b border-white/10">
            <div className="text-left">Tính năng</div>
            <div className="text-gray-400">Miễn phí</div>
            <div className="text-yellow-400">VIP ✨</div>
          </div>

          <div className="space-y-3">
            {FEATURE_ROWS.map(
              ({ icon: Icon, label, free, vip, isBoolean }) => (
                <div
                  key={label}
                  className="grid grid-cols-3 items-center text-xs"
                >
                  <div className="flex items-center gap-2 text-gray-300">
                    <Icon className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
                    <span>{label}</span>
                  </div>
                  <div className="text-center text-gray-500">
                    {isBoolean ? (
                      free ? (
                        <Check className="w-4 h-4 text-green-500 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-red-500/50 mx-auto" />
                      )
                    ) : (
                      free
                    )}
                  </div>
                  <div className="text-center text-green-400 font-medium">
                    {isBoolean ? (
                      vip ? (
                        <Check className="w-4 h-4 text-green-400 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-red-500/50 mx-auto" />
                      )
                    ) : (
                      vip
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-500 mt-6">
          Thanh toán an toàn qua PayOS • Kích hoạt tự động sau thanh toán
        </p>
      </div>
    </main>
  );
}
