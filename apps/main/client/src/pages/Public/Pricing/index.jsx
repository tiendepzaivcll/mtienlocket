import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  User,
  AtSign,
  Wrench,
} from "lucide-react";
import { instanceMain } from "@/libs/instanceMain";
import {
  SonnerSuccess,
  SonnerWarning,
} from "@/components/ui/SonnerToast";
import { useAuthStore } from "@/stores/AuthStore";

const DEFAULT_VIP_PLANS = [
  { id: "vip_1month", name: "VIP 1 Tháng", price: 25000, days: 30, badge: null, category: "vip" },
  { id: "vip_6months", name: "VIP 6 Tháng", price: 99000, days: 180, badge: "Phổ biến", category: "vip" },
  { id: "vip_1year", name: "VIP 1 Năm", price: 149000, days: 365, badge: "Tốt nhất", category: "vip" },
];

const DEFAULT_AI_PLANS = [
  { id: "ai_1month", name: "AI Filter 1 Tháng", price: 19000, days: 30, badge: null, category: "ai_filter" },
  { id: "ai_6months", name: "AI Filter 6 Tháng", price: 79000, days: 180, badge: "Phổ biến", category: "ai_filter" },
  { id: "ai_1year", name: "AI Filter 1 Năm", price: 129000, days: 365, badge: "Tốt nhất", category: "ai_filter" },
];

// ─── Feature comparison data ────────────────────────────────────────
const FEATURE_ROWS = [
  { icon: Video, label: "Thời lượng video", free: "10 giây", vip: "30 giây" },
  {
    icon: Upload,
    label: "Chất lượng upload",
    free: "HD",
    vip: "HD cao nhất",
  },
  {
    icon: MessageSquare,
    label: "Caption",
    free: "General & Holiday",
    vip: "Đầy đủ + tuỳ chỉnh",
  },
  {
    icon: Camera,
    label: "Photobooth 4 ô",
    free: false,
    vip: true,
    isBoolean: true,
  },
  {
    icon: Camera,
    label: "Khung Camera",
    free: false,
    vip: true,
    isBoolean: true,
  },
  {
    icon: Flame,
    label: "Khôi phục streak",
    free: false,
    vip: true,
    isBoolean: true,
  },
  {
    icon: Wrench,
    label: "Công cụ Locket",
    free: false,
    vip: true,
    isBoolean: true,
  },
  {
    icon: Eye,
    label: "Trạng thái đã xem",
    free: false,
    vip: true,
    isBoolean: true,
  },
  {
    icon: Wand2,
    label: "Bộ lọc AI (AI Filter)",
    free: "Bán riêng",
    vip: "Bán riêng",
    isAddon: true,
  },
];

export default function PricingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const aiSectionRef = useRef(null);

  const [plans, setPlans] = useState([]);
  const [aiPlans, setAiPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(null);
  const [username, setUsername] = useState("");
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get("tab") === "ai" ? "ai" : "vip";
  });

  // Auto-fill username from logged-in user
  useEffect(() => {
    if (user?.username) {
      setUsername(user.username.replace(/^@+/, ""));
    }
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("tab") === "ai") {
      setActiveTab("ai");
    }
  }, [location.search]);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await instanceMain.get("/api/payment/plans");
      const fetchedVip = res.data?.data?.plans;
      const fetchedAi = res.data?.data?.aiPlans;
      setPlans(Array.isArray(fetchedVip) && fetchedVip.length ? fetchedVip : DEFAULT_VIP_PLANS);
      setAiPlans(Array.isArray(fetchedAi) && fetchedAi.length ? fetchedAi : DEFAULT_AI_PLANS);
    } catch {
      setPlans(DEFAULT_VIP_PLANS);
      setAiPlans(DEFAULT_AI_PLANS);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (planId) => {
    const trimmed = username.trim().replace(/^@+/, "");
    if (!trimmed) {
      SonnerWarning("Vui lòng nhập tên người dùng Locket của bạn");
      return;
    }
    setCreating(planId);
    try {
      const res = await instanceMain.post("/api/payment/create-order", {
        planId,
        username: trimmed,
      });
      if (res.data?.success) {
        const { orderCode } = res.data.data;
        SonnerSuccess("Đơn hàng đã tạo thành công!");
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

  const discount = (plan, list) => {
    if (!list || list.length === 0) return 0;
    const basePrice = list[0]?.price;
    if (!basePrice) return 0;
    const months = plan.days / 30;
    const fullPrice = basePrice * months;
    return Math.round(((fullPrice - plan.price) / fullPrice) * 100);
  };

  const renderPlanList = (planList, isAiCategory = false) => (
    <div className="space-y-4">
      {planList.map((plan) => {
        const isPopular = plan.badge === "Phổ biến";
        const isBest = plan.badge === "Tốt nhất";
        const isHighlighted = isPopular || isBest;
        const disc = discount(plan, planList);

        return (
          <div
            key={plan.id}
            className={`relative rounded-2xl p-[2px] transition-all ${
              isHighlighted
                ? isAiCategory
                  ? "bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-purple-500"
                  : "bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-500"
                : "bg-white/10"
            }`}
          >
            {plan.badge && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                <span
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                    isBest
                      ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-black"
                      : isAiCategory
                        ? "bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white"
                        : "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                  }`}
                >
                  {isBest ? <Star className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                  {plan.badge}
                </span>
              </div>
            )}

            <div className={`rounded-2xl p-5 ${isHighlighted ? "bg-gray-900" : "bg-white/5"}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-1.5">
                    {isAiCategory && <Wand2 className="w-4 h-4 text-cyan-400" />}
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span
                      className={`text-2xl font-extrabold text-transparent bg-clip-text ${
                        isAiCategory
                          ? "bg-gradient-to-r from-cyan-300 to-fuchsia-400"
                          : "bg-gradient-to-r from-purple-400 to-pink-400"
                      }`}
                    >
                      {plan.price.toLocaleString("vi-VN")}đ
                    </span>
                    {disc > 0 && planList[0] && (
                      <span className="text-xs line-through text-gray-500">
                        {(planList[0].price * (plan.days / 30)).toLocaleString("vi-VN")}đ
                      </span>
                    )}
                  </div>
                  {plan.days > 30 ? (
                    <p className="text-xs text-gray-400 mt-0.5">
                      ~{pricePerMonth(plan).toLocaleString("vi-VN")}đ/tháng
                      {disc > 0 && (
                        <span className="ml-2 text-green-400 font-bold">-{disc}%</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 mt-0.5">Thời hạn {plan.days} ngày</p>
                  )}
                </div>

                <button
                  onClick={() => handlePurchase(plan.id)}
                  disabled={creating !== null}
                  className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all shrink-0 ${
                    isHighlighted
                      ? isAiCategory
                        ? "bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-600 hover:to-fuchsia-600 text-white shadow-lg shadow-cyan-500/20"
                        : "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/25"
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
  );

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
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold px-4 py-1.5 rounded-full text-sm mb-4">
            <Crown className="w-4 h-4" />
            CỬA HÀNG DỊCH VỤ
          </div>
          <h1 className="text-2xl font-bold mb-2">Nâng cấp trải nghiệm</h1>
          <p className="text-sm text-gray-400">
            Chọn gói Locket VIP hoặc gói AI Filter bán riêng
          </p>
        </div>

        {/* Username input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <User className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Tên người dùng Locket
          </label>
          <div className="relative">
            <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập username Locket của bạn"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/10 focus:border-purple-500 focus:outline-none text-white placeholder-gray-500 text-sm transition"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            Nhập đúng username Locket để hệ thống tự kích hoạt ngay sau khi chuyển khoản
          </p>
        </div>

        {/* Category Switcher */}
        <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-white/5 border border-white/10 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab("vip")}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition ${
              activeTab === "vip"
                ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-black shadow-md"
                : "text-gray-300 hover:bg-white/5"
            }`}
          >
            <Crown className="w-4 h-4" />
            Gói VIP
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ai")}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition ${
              activeTab === "ai"
                ? "bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-white shadow-md"
                : "text-gray-300 hover:bg-white/5"
            }`}
          >
            <Wand2 className="w-4 h-4" />
            AI Filter (Riêng)
          </button>
        </div>

        {activeTab === "vip" ? (
          <div className="mb-8 space-y-4">
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 text-xs text-amber-200/90">
              👑 <strong>Gói Locket VIP:</strong> Mở khoá Video dài, Photobooth 4 ô, Khung Camera, Caption đầy đủ, Công cụ Locket & Khôi phục chuỗi.{" "}
              <span className="opacity-80">(Không bao gồm AI Filter — AI Filter bán riêng bên tab cạnh).</span>
            </div>
            {renderPlanList(plans, false)}
          </div>
        ) : (
          <div ref={aiSectionRef} className="mb-8 space-y-4">
            <div className="rounded-xl bg-cyan-500/10 border border-cyan-400/25 px-4 py-2.5 text-xs text-cyan-200/90">
              ✨ <strong>Gói AI Filter (Bán riêng):</strong> Mở khoá toàn bộ kho hiệu ứng biến đổi ảnh bằng AI. Mua riêng độc lập — dùng được cho cả tài khoản <strong>Miễn phí</strong> lẫn <strong>VIP</strong>!
            </div>
            {renderPlanList(aiPlans, true)}
          </div>
        )}

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
            {FEATURE_ROWS.map(({ icon: Icon, label, free, vip, isBoolean, isAddon }) => (
              <div key={label} className="grid grid-cols-3 items-center text-xs">
                <div className="flex items-center gap-2 text-gray-300">
                  <Icon className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
                  <span>{label}</span>
                </div>
                <div className="text-center text-gray-500">
                  {isAddon ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab("ai")}
                      className="px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[11px] font-semibold hover:bg-cyan-500/25 transition"
                    >
                      {free}
                    </button>
                  ) : isBoolean ? (
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
                  {isAddon ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab("ai")}
                      className="px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[11px] font-semibold hover:bg-cyan-500/25 transition"
                    >
                      {vip}
                    </button>
                  ) : isBoolean ? (
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
            ))}
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-500 mt-6">
          Thanh toán an toàn qua PayOS • Tự động kích hoạt & tự rớt về Free khi hết hạn
        </p>
        <p className="text-center text-xs text-gray-500 mt-2 italic">
          ✨ Các tính năng VIP mới sẽ được admin cập nhật thêm trong tương lai
        </p>
      </div>
    </main>
  );
}
