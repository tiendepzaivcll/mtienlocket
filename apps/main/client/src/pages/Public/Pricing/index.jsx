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
  Gift,
  AlertCircle,
  Clock,
} from "lucide-react";
import { instanceMain } from "@/libs/instanceMain";
import {
  SonnerSuccess,
  SonnerWarning,
  SonnerError,
} from "@/components/ui/SonnerToast";
import { useAuthStore } from "@/stores/AuthStore";

const DEFAULT_VIP_PLANS = [
  { id: "vip_1month", name: "VIP 1 Tháng", price: 15000, days: 30, bonusAiCredits: 1, badge: null, category: "vip" },
  { id: "vip_6months", name: "VIP 6 Tháng", price: 79000, days: 180, bonusAiCredits: 3, badge: "Phổ biến", category: "vip" },
  { id: "vip_1year", name: "VIP 1 Năm", price: 139000, days: 365, bonusAiCredits: 8, badge: "Tiết kiệm", category: "vip" },
];

const DEFAULT_AI_PLANS = [
  { id: "ai_10k", name: "Gói 15 Ảnh", price: 10000, credits: 15, buttonText: "15 ảnh", description: "Gói trải nghiệm 15 lượt tạo ảnh AI", badge: null, category: "ai_filter" },
  { id: "ai_20k", name: "Gói 35 Ảnh", price: 20000, credits: 35, buttonText: "30 + 5 ảnh", description: "Gói tiêu chuẩn 35 lượt tạo ảnh AI (30 + 5)", badge: "Phổ biến", category: "ai_filter" },
  { id: "ai_40k", name: "Gói 70 Ảnh", price: 40000, credits: 70, buttonText: "60 + 10 ảnh", description: "Gói cao cấp 70 lượt tạo ảnh AI (60 + 10)", badge: "Tiết kiệm", category: "ai_filter" },
];

const FEATURE_ROWS = [
  { icon: Video, label: "Thời lượng video", free: "5 giây", vip: "15 giây (Siêu nét)" },
  { icon: Upload, label: "Chất lượng hình ảnh", free: "Chuẩn HD", vip: "Full HD (1080p - 2K)" },
  { icon: MessageSquare, label: "Caption & Icon", free: "Cơ bản", vip: "Đầy đủ + tuỳ chỉnh" },
  { icon: Camera, label: "Photobooth 4 ô", free: false, vip: true, isBoolean: true },
  { icon: Camera, label: "Khung Camera", free: false, vip: true, isBoolean: true },
  { icon: Flame, label: "Khôi phục streak", free: false, vip: true, isBoolean: true },
  { icon: Wrench, label: "Công cụ Locket", free: false, vip: true, isBoolean: true },
  { icon: Eye, label: "Trạng thái đã xem", free: false, vip: true, isBoolean: true },
  { icon: Wand2, label: "Bộ lọc AI (AI Filter)", free: "Khóa", vip: "Được mua & Dùng", isAddon: true },
];

export default function PricingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    accessRole,
    hasUsedTrial,
    vipPlanId: storeVipPlanId,
    vipPlanName: storeVipPlanName,
    vipPlanDays: storeVipPlanDays,
    vipExpireAt: storeVipExpireAt,
    refreshAccessRole,
  } = useAuthStore();
  const aiSectionRef = useRef(null);

  const [plans, setPlans] = useState([]);
  const [aiPlans, setAiPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(null);
  const [claimingTrial, setClaimingTrial] = useState(false);
  const [username, setUsername] = useState("");
  const [remoteVipInfo, setRemoteVipInfo] = useState(null);
  const [pendingUpgradeModal, setPendingUpgradeModal] = useState(null);
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get("tab") === "ai" ? "ai" : "vip";
  });

  // Đồng bộ thông tin VIP của username (ưu tiên thông tin từ AuthStore nếu là chính user đó)
  useEffect(() => {
    const trimmed = username.trim().replace(/^@+/, "");
    if (!trimmed) {
      setRemoteVipInfo(null);
      return;
    }

    if (user?.username && trimmed.toLowerCase() === user.username.replace(/^@+/, "").toLowerCase()) {
      const isStoreVip = accessRole === "vip" || accessRole === "celebrity";
      setRemoteVipInfo({
        isVip: isStoreVip,
        vipPlanId: storeVipPlanId,
        vipPlanName: storeVipPlanName,
        vipPlanDays: storeVipPlanDays,
        vipExpireAt: storeVipExpireAt,
      });
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        const res = await instanceMain.get(`/api/payment/check-user/${trimmed}`);
        if (active && res.data?.success && res.data?.data) {
          setRemoteVipInfo(res.data.data);
        }
      } catch {
        if (active) setRemoteVipInfo(null);
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [username, user?.username, accessRole, storeVipPlanId, storeVipPlanName, storeVipPlanDays, storeVipExpireAt]);

  const currentVip = remoteVipInfo?.isVip
    ? remoteVipInfo
    : (accessRole === "vip" || accessRole === "celebrity")
      ? {
          isVip: true,
          vipPlanId: storeVipPlanId,
          vipPlanName: storeVipPlanName,
          vipPlanDays: storeVipPlanDays,
          vipExpireAt: storeVipExpireAt,
        }
      : null;

  const isVip = Boolean(currentVip?.isVip);
  const isLifetimeVip = isVip && (currentVip.vipPlanId === "vip_lifetime" || !currentVip.vipExpireAt);
  const remainingDays = isVip && currentVip.vipExpireAt
    ? Math.max(0, Math.ceil((currentVip.vipExpireAt - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;

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
      const fetchedVip = res.data?.data?.plans?.filter((p) => !p.isTrial);
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

  const handleClaimTrial = async () => {
    const trimmed = username.trim().replace(/^@+/, "");
    if (!trimmed) {
      SonnerWarning("Vui lòng nhập username Locket của bạn");
      return;
    }
    setClaimingTrial(true);
    try {
      const res = await instanceMain.post("/api/payment/claim-trial", {
        username: trimmed,
      });
      if (res.data?.success) {
        SonnerSuccess("Kích hoạt dùng thử thành công!", "Bạn có 24h VIP + 1 ảnh AI miễn phí.");
        await refreshAccessRole();
      } else {
        SonnerWarning(res.data?.message || "Không thể kích hoạt dùng thử");
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Lỗi kích hoạt gói dùng thử";
      SonnerError(msg);
    } finally {
      setClaimingTrial(false);
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

  const onVipPlanClick = (plan) => {
    const trimmed = username.trim().replace(/^@+/, "");
    if (!trimmed) {
      SonnerWarning("Vui lòng nhập tên người dùng Locket của bạn");
      return;
    }

    if (isVip) {
      // Khách hàng ĐÃ CÓ VIP -> Hiển thị popup hỏi xác nhận nâng cấp hoặc chuyển gói!
      const currentName = currentVip?.vipPlanName || "VIP";
      const isSamePlan =
        plan.id === currentVip?.vipPlanId ||
        (plan.days === 30 && (currentVip?.vipPlanId === "vip_1month" || currentName.includes("1 Tháng"))) ||
        (plan.days === 180 && (currentVip?.vipPlanId === "vip_6months" || currentName.includes("6 Tháng"))) ||
        (plan.days === 365 && (currentVip?.vipPlanId === "vip_1year" || currentName.includes("1 Năm")));

      setPendingUpgradeModal({
        currentPlan: {
          name: currentName,
          daysLeft: isLifetimeVip ? "Vô thời hạn" : `${remainingDays || 0} ngày`,
          isLifetime: isLifetimeVip,
        },
        targetPlan: plan,
        isSamePlan,
      });
      return;
    }

    // Chưa có VIP -> Tạo đơn thanh toán trực tiếp
    handlePurchase(plan.id);
  };

  const renderVipPlans = () => (
    <div className="space-y-4">
      {/* Banner thông báo nếu khách ĐÃ CÓ VIP */}
      {isVip && (
        <div className="rounded-2xl bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-amber-500/20 border border-purple-500/40 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-400/20 text-amber-300">
                <Crown size={16} />
              </span>
              <div>
                <span className="text-xs text-purple-200/80">Gói hiện tại của bạn:</span>
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  {currentVip?.vipPlanName || "VIP"}
                  {isLifetimeVip && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-400 text-black font-extrabold">
                      Vĩnh viễn
                    </span>
                  )}
                </h4>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-gray-400 block">Thời hạn còn</span>
              <span className="text-xs font-bold text-amber-300">
                {isLifetimeVip ? "Vô thời hạn" : `${remainingDays || 0} ngày`}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-gray-300">
            💡 Bạn có thể gia hạn thêm hoặc chuyển lên gói dài hạn hơn bất cứ lúc nào — thời gian VIP sẽ được <strong>cộng dồn tiếp tục</strong>!
          </p>
        </div>
      )}

      {/* Gói dùng thử 1 ngày (0đ) */}
      <div className="relative rounded-2xl p-[2px] bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 transition-all">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <span className="flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-500 text-black shadow-md">
            <Gift className="w-3 h-3" />
            DÙNG THỬ 0Đ
          </span>
        </div>
        <div className="rounded-2xl p-5 bg-gray-900">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-1.5 text-emerald-300">
                <Crown className="w-4 h-4 text-emerald-400" />
                VIP Dùng thử (1 Ngày)
              </h3>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-extrabold text-emerald-400">0đ</span>
                <span className="text-xs text-gray-400">/ 24 giờ</span>
              </div>
              <p className="text-xs text-emerald-200/80 mt-1">
                Mở full tính năng VIP + 🎁 <strong>Tặng 1 ảnh AI</strong>
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5 italic">
                * Mỗi tài khoản Locket chỉ được nhận 1 lần duy nhất
              </p>
            </div>

            <button
              onClick={handleClaimTrial}
              disabled={claimingTrial || hasUsedTrial}
              className="px-4 py-2.5 rounded-xl font-bold text-xs transition-all shrink-0 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-black shadow-md disabled:opacity-50"
            >
              {claimingTrial ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : hasUsedTrial ? (
                "Đã nhận"
              ) : (
                "Nhận ngay"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Các gói VIP trả phí */}
      {plans.map((plan) => {
        const isPopular = plan.badge === "Phổ biến";
        const isBest = plan.badge === "Tiết kiệm";
        const isHighlighted = isPopular || isBest;

        const currentName = currentVip?.vipPlanName || "";
        const isCurrentPlan = isVip && (
          plan.id === currentVip?.vipPlanId ||
          (plan.days === 30 && (currentVip?.vipPlanId === "vip_1month" || currentName.includes("1 Tháng"))) ||
          (plan.days === 180 && (currentVip?.vipPlanId === "vip_6months" || currentName.includes("6 Tháng"))) ||
          (plan.days === 365 && (currentVip?.vipPlanId === "vip_1year" || currentName.includes("1 Năm")))
        );

        return (
          <div
            key={plan.id}
            className={`relative rounded-2xl p-[2px] transition-all ${
              isCurrentPlan
                ? "bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500 ring-2 ring-emerald-400/50"
                : isHighlighted
                  ? "bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-500"
                  : "bg-white/10"
            }`}
          >
            {isCurrentPlan ? (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-black shadow-md">
                  <Check className="w-3 h-3" />
                  Gói đang dùng
                </span>
              </div>
            ) : plan.badge ? (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                <span
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                    isBest
                      ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-black"
                      : "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                  }`}
                >
                  {isBest ? <Star className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                  {plan.badge}
                </span>
              </div>
            ) : null}

            <div className={`rounded-2xl p-5 ${isHighlighted || isCurrentPlan ? "bg-gray-900" : "bg-white/5"}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-amber-400" />
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                      {plan.price.toLocaleString("vi-VN")}đ
                    </span>
                    <span className="text-xs text-gray-400">/ {plan.days} ngày</span>
                  </div>
                  {plan.bonusAiCredits > 0 && (
                    <p className="text-xs text-yellow-300 font-semibold mt-1 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                      Tặng kèm {plan.bonusAiCredits} ảnh AI
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">{plan.description}</p>
                </div>

                <button
                  onClick={() => onVipPlanClick(plan)}
                  disabled={creating !== null}
                  className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all shrink-0 ${
                    isCurrentPlan
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-black shadow-lg shadow-emerald-500/20"
                      : isVip
                        ? "bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-black shadow-lg shadow-amber-500/20"
                        : isHighlighted
                          ? "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/25"
                          : "bg-white/10 hover:bg-white/20 text-white"
                  } disabled:opacity-50`}
                >
                  {creating === plan.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isCurrentPlan ? (
                    "Gia hạn thêm"
                  ) : isVip ? (
                    "Chuyển gói"
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

  const renderAiPlans = () => (
    <div className="space-y-4">
      {/* Banner nếu chưa có VIP */}
      {!isVip && (
        <div className="rounded-2xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 p-4 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-200">
                Chỉ dành riêng cho thành viên VIP
              </p>
              <p className="text-xs text-amber-200/80 mt-0.5">
                Bạn cần nâng cấp gói VIP hoặc kích hoạt <strong>Gói Dùng Thử 1 Ngày (0đ)</strong> trước để có quyền mua và tạo ảnh AI Filter!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("vip")}
            className="w-full py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-yellow-400 to-orange-500 text-black hover:opacity-90 transition"
          >
            Chuyển sang tab VIP để kích hoạt ngay →
          </button>
        </div>
      )}

      {aiPlans.map((plan) => {
        const isPopular = plan.badge === "Phổ biến";
        const isBest = plan.badge === "Tiết kiệm" || plan.badge === "Hời nhất";
        const isHighlighted = isPopular || isBest;

        return (
          <div
            key={plan.id}
            className={`relative rounded-2xl p-[2px] transition-all ${
              isHighlighted
                ? "bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-purple-500"
                : "bg-white/10"
            }`}
          >
            {plan.badge && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white shadow-md">
                  <Star className="w-3 h-3" />
                  {plan.badge}
                </span>
              </div>
            )}

            <div className={`rounded-2xl p-5 ${isHighlighted ? "bg-gray-900" : "bg-white/5"}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-1.5">
                    <Wand2 className="w-4 h-4 text-cyan-400" />
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-fuchsia-400">
                      {plan.price.toLocaleString("vi-VN")}đ
                    </span>
                    <span className="text-xs text-cyan-300/80 font-bold">
                      = {plan.credits} lượt tạo ảnh
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{plan.description}</p>
                </div>

                <button
                  onClick={() => handlePurchase(plan.id)}
                  disabled={creating !== null || !isVip}
                  className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all shrink-0 ${
                    !isVip
                      ? "bg-white/5 text-gray-500 cursor-not-allowed"
                      : isHighlighted
                        ? "bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-600 hover:to-fuchsia-600 text-white shadow-lg shadow-cyan-500/20"
                        : "bg-white/10 hover:bg-white/20 text-white"
                  } disabled:opacity-50`}
                >
                  {creating === plan.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : !isVip ? (
                    "Cần VIP"
                  ) : (
                    plan.buttonText || "Nạp ngay"
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
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold px-4 py-1.5 rounded-full text-sm mb-4 shadow-lg shadow-yellow-500/20">
            <Crown className="w-4 h-4" />
            CỬA HÀNG DỊCH VỤ
          </div>
          <h1 className="text-2xl font-bold mb-2">Nâng cấp trải nghiệm</h1>
          <p className="text-sm text-gray-400">
            Gói Locket VIP cao cấp & Lượt tạo ảnh AI Filter
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
            AI Filter (Theo lượt)
          </button>
        </div>

        {activeTab === "vip" ? (
          <div className="mb-8 space-y-4">
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 text-xs text-amber-200/90">
              👑 <strong>Gói Locket VIP:</strong> Mở khoá Video 15s (Siêu nét), Photobooth 4 ô, Khung Camera, Caption đầy đủ, Công cụ Locket & Khôi phục chuỗi.{" "}
              <span className="font-semibold text-yellow-300">Đặc biệt: Tặng kèm lượt tạo ảnh AI Filter!</span>
            </div>
            {renderVipPlans()}
          </div>
        ) : (
          <div ref={aiSectionRef} className="mb-8 space-y-4">
            <div className="rounded-xl bg-cyan-500/10 border border-cyan-400/25 px-4 py-2.5 text-xs text-cyan-200/90">
              ✨ <strong>Lượt tạo ảnh AI Filter:</strong> Mở khoá toàn bộ hiệu ứng biến đổi ảnh AI. Nạp lượt dùng dần, không giới hạn thời gian.{" "}
              <span className="text-cyan-300 font-semibold">(Yêu cầu tài khoản có gói VIP để sử dụng).</span>
            </div>
            {renderAiPlans()}
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
                    <span className="text-[11px] text-gray-400">{free}</span>
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

      {/* Modal xác nhận nâng cấp / chuyển gói VIP khi đã có VIP */}
      {pendingUpgradeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPendingUpgradeModal(null);
          }}
        >
          <div className="bg-gradient-to-b from-gray-900 via-gray-900 to-purple-950/95 border border-purple-500/40 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-base">
                <Crown className="w-5 h-5 text-amber-400 animate-bounce" />
                {pendingUpgradeModal.isSamePlan ? "Gia hạn gói VIP" : "Nâng cấp / Chuyển gói VIP"}
              </div>
              <button
                type="button"
                onClick={() => setPendingUpgradeModal(null)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Thông tin gói hiện tại */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between text-gray-300">
                <span>Tài khoản:</span>
                <span className="font-bold text-white">@{username.trim().replace(/^@+/, "")}</span>
              </div>
              <div className="flex items-center justify-between text-gray-300">
                <span>Gói hiện tại:</span>
                <span className="font-bold text-amber-300">{pendingUpgradeModal.currentPlan.name}</span>
              </div>
              <div className="flex items-center justify-between text-gray-300">
                <span>Thời hạn còn lại:</span>
                <span className="font-bold text-emerald-400">{pendingUpgradeModal.currentPlan.daysLeft}</span>
              </div>
            </div>

            {/* Thông báo gói muốn chuyển lên */}
            <div className="rounded-2xl bg-purple-500/15 border border-purple-500/30 p-4 space-y-2.5">
              <p className="text-xs text-purple-200">
                {pendingUpgradeModal.isSamePlan
                  ? `Bạn đang muốn gia hạn thêm gói hiện tại:`
                  : `Bạn đã có gói ${pendingUpgradeModal.currentPlan.name}. Bạn có muốn chuyển lên gói mới này không?`}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-base font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-pink-400">
                  {pendingUpgradeModal.targetPlan.name}
                </span>
                <span className="text-sm font-bold text-white">
                  {pendingUpgradeModal.targetPlan.price.toLocaleString("vi-VN")}đ
                </span>
              </div>
              <div className="text-[11px] text-gray-300 space-y-1.5 pt-2 border-t border-purple-500/20">
                <p className="flex items-center gap-1.5 text-emerald-300 font-medium">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  Cộng nối tiếp <strong>+{pendingUpgradeModal.targetPlan.days} ngày</strong> vào hạn dùng
                </p>
                {pendingUpgradeModal.targetPlan.bonusAiCredits > 0 && (
                  <p className="flex items-center gap-1.5 text-yellow-300 font-medium">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    Tặng thêm <strong>+{pendingUpgradeModal.targetPlan.bonusAiCredits} lượt ảnh AI Filter</strong>
                  </p>
                )}
              </div>
            </div>

            {/* Nút hành động */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const planId = pendingUpgradeModal.targetPlan.id;
                  setPendingUpgradeModal(null);
                  handlePurchase(planId);
                }}
                disabled={creating !== null}
                className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/25 transition active:scale-95 flex items-center justify-center gap-2"
              >
                {creating === pendingUpgradeModal.targetPlan.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : pendingUpgradeModal.isSamePlan ? (
                  `Xác nhận gia hạn (+${pendingUpgradeModal.targetPlan.days} ngày)`
                ) : (
                  `Xác nhận chuyển lên ${pendingUpgradeModal.targetPlan.name}`
                )}
              </button>
              <button
                type="button"
                onClick={() => setPendingUpgradeModal(null)}
                className="w-full py-2.5 rounded-xl font-medium text-xs bg-white/10 hover:bg-white/20 text-gray-300 transition"
              >
                Chọn gói khác / Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
