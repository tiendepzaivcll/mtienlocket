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
  User,
  AtSign,
  Wrench,
  Gift,
  AlertCircle,
  Search,
  ArrowRight,
  Menu,
  ShieldCheck,
  Clock,
  ExternalLink,
} from "lucide-react";
import { instanceMain } from "@/libs/instanceMain";
import {
  SonnerSuccess,
  SonnerWarning,
  SonnerError,
} from "@/components/ui/SonnerToast";
import { useAuthStore } from "@/stores/AuthStore";
import "./pricing-gold.css";

const DEFAULT_VIP_PLANS = [
  { id: "vip_1month", name: "VIP 1 Tháng", price: 15000, days: 30, bonusAiCredits: 1, badge: null, category: "vip", description: "Trải nghiệm đầy đủ tính năng VIP cơ bản cho 1 tháng" },
  { id: "vip_6months", name: "VIP 6 Tháng", price: 79000, days: 180, bonusAiCredits: 3, badge: "Phổ biến", category: "vip", description: "Lựa chọn được ưa chuộng nhất, tiết kiệm chi phí dài hạn" },
  { id: "vip_1year", name: "VIP 1 Năm", price: 139000, days: 365, bonusAiCredits: 8, badge: "Tiết kiệm", category: "vip", description: "Trọn vẹn 365 ngày VIP không giới hạn với ưu đãi tốt nhất" },
];

const DEFAULT_AI_PLANS = [
  { id: "ai_10k", name: "Gói 15 Ảnh", price: 10000, credits: 15, buttonText: "15 ảnh", description: "Gói trải nghiệm 15 lượt tạo ảnh AI Filter nghệ thuật", badge: null, category: "ai_filter" },
  { id: "ai_20k", name: "Gói 35 Ảnh", price: 20000, credits: 35, buttonText: "30 + 5 ảnh", description: "Gói tiêu chuẩn 35 lượt tạo ảnh AI (30 + 5 tặng kèm)", badge: "Phổ biến", category: "ai_filter" },
  { id: "ai_40k", name: "Gói 70 Ảnh", price: 40000, credits: 70, buttonText: "60 + 10 ảnh", description: "Gói cao cấp 70 lượt tạo ảnh AI (60 + 10 tặng kèm)", badge: "Tiết kiệm", category: "ai_filter" },
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

const FAQ_LIST = [
  {
    q: "Avatar và thương hiệu MTIEN có bị thay đổi không?",
    a: "Không. Website giữ nguyên logo, thương hiệu MTIEN và nhận diện gốc của hệ thống.",
  },
  {
    q: "Tôi cần chuẩn bị gì để nâng cấp Locket VIP?",
    a: "Bạn chỉ cần nhập đúng username Locket của mình. Hệ thống tuyệt đối không yêu cầu mật khẩu hay bất kỳ thông tin đăng nhập riêng tư nào.",
  },
  {
    q: "Sau khi chuyển khoản qua PayOS, kích hoạt mất bao lâu?",
    a: "Hệ thống kết nối trực tiếp với cổng PayOS. Đơn hàng được tự động xác nhận và kích hoạt tài khoản chỉ sau 3-5 giây kể từ khi chuyển khoản thành công.",
  },
  {
    q: "Tôi đã có gói VIP, nếu mua thêm thì có bị mất ngày cũ không?",
    a: "Không bao giờ mất! Thời hạn của gói mới sẽ được tự động CỘNG DỒN nối tiếp vào số ngày VIP hiện tại của bạn.",
  },
  {
    q: "Lượt tạo ảnh AI Filter có thời hạn sử dụng không?",
    a: "Lượt tạo ảnh AI Filter được lưu trữ vĩnh viễn trong tài khoản cho đến khi bạn sử dụng hết.",
  },
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

  const [plans, setPlans] = useState([]);
  const [aiPlans, setAiPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(null);
  const [claimingTrial, setClaimingTrial] = useState(false);
  const [username, setUsername] = useState("");
  const [remoteVipInfo, setRemoteVipInfo] = useState(null);
  const [pendingUpgradeModal, setPendingUpgradeModal] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  // Tra cứu đơn hàng
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);

  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get("tab") === "ai" ? "ai" : "vip";
  });

  const usernameInputRef = useRef(null);
  const lookupInputRef = useRef(null);

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

  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const focusUsernameInput = () => {
    scrollToSection("products");
    setTimeout(() => {
      if (usernameInputRef.current) {
        usernameInputRef.current.focus();
      }
    }, 450);
  };

  const focusLookupInput = () => {
    scrollToSection("lookup");
    setTimeout(() => {
      if (lookupInputRef.current) {
        lookupInputRef.current.focus();
      }
    }, 450);
  };

  const handleClaimTrial = async () => {
    const trimmed = username.trim().replace(/^@+/, "");
    if (!trimmed) {
      SonnerWarning("Vui lòng nhập username Locket của bạn");
      focusUsernameInput();
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
      focusUsernameInput();
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
      setPendingUpgradeModal(null);
    }
  };

  const onVipPlanClick = (plan) => {
    const trimmed = username.trim().replace(/^@+/, "");
    if (!trimmed) {
      SonnerWarning("Vui lòng nhập tên người dùng Locket của bạn để tiếp tục");
      focusUsernameInput();
      return;
    }

    if (isVip) {
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

    handlePurchase(plan.id);
  };

  const handleLookupSubmit = async (e) => {
    e.preventDefault();
    const q = lookupQuery.trim().replace(/^@+/, "");
    if (!q) {
      SonnerWarning("Vui lòng nhập mã đơn hàng PayOS hoặc Username Locket");
      return;
    }

    setLookupLoading(true);
    setLookupResult(null);

    try {
      // 1. Thử tra cứu đơn hàng bằng orderCode
      try {
        const orderRes = await instanceMain.get(`/api/payment/order/${q}`);
        if (orderRes.data?.success && orderRes.data?.data) {
          setLookupResult({
            type: "order",
            data: orderRes.data.data,
          });
          SonnerSuccess("Đã tìm thấy thông tin đơn hàng!");
          return;
        }
      } catch {
        // Không phải orderCode hoặc không tìm thấy, thử tiếp kiểm tra user
      }

      // 2. Thử tra cứu thông tin VIP theo username
      const userRes = await instanceMain.get(`/api/payment/check-user/${q}`);
      if (userRes.data?.success && userRes.data?.data) {
        setLookupResult({
          type: "user",
          username: q,
          data: userRes.data.data,
        });
        SonnerSuccess(`Đã tìm thấy thông tin VIP của @${q}!`);
        return;
      }

      SonnerWarning("Không tìm thấy đơn hàng hoặc tài khoản tương ứng.");
    } catch (err) {
      SonnerWarning("Lỗi tra cứu thông tin. Vui lòng thử lại sau.");
    } finally {
      setLookupLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="pricing-gold-page" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#d39f19", margin: "0 auto 12px" }} />
          <p style={{ fontWeight: 700, color: "#666e60" }}>Đang tải bảng giá Locket Gold...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pricing-gold-page">
      {/* SVG Symbol Definitions */}
      <svg width="0" height="0" style={{ position: "absolute", width: 0, height: 0 }} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <symbol id="i-heart" viewBox="0 0 24 24"><path d="M20.8 4.7a5.6 5.6 0 0 0-8 .1L12 5.7l-.8-.9a5.6 5.6 0 0 0-8-.1 5.8 5.8 0 0 0 0 8.2L12 21l8.8-8.1a5.8 5.8 0 0 0 0-8.2Z"/></symbol>
          <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6"/></symbol>
          <symbol id="i-bag" viewBox="0 0 24 24"><path d="M4 9h16l-1 12H5L4 9ZM8 9V6a4 4 0 0 1 8 0v3"/></symbol>
          <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 2 3 6v6c0 5 3 8 9 10 6-2 9-5 9-10V6l-9-4Z"/><path d="m8 12 3 3 5-6"/></symbol>
          <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></symbol>
          <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></symbol>
          <symbol id="i-spark" viewBox="0 0 24 24"><path d="m12 1 2.5 8.5L23 12l-8.5 2.5L12 23l-2.5-8.5L1 12l8.5-2.5L12 1Z"/></symbol>
          <symbol id="i-check" viewBox="0 0 24 24"><path d="m4 12 5 5L20 6"/></symbol>
        </defs>
      </svg>

      {/* Sticky Navigation Bar */}
      <header className="nav">
        <div className="container navin">
          <a href="#home" onClick={(e) => { e.preventDefault(); scrollToSection("home"); }} className="brand" aria-label="Locket-Pro trang chủ">
            <div className="logo-slot loaded" id="logoSlot">
              <img src="/locket-pro-icon-192x192.png" alt="Avatar Locket-Pro" onError={(e) => { e.target.src = "/favicon.ico"; }} />
            </div>
            <div>
              <div className="brandtitle">Locket<span>-</span><i>Pro</i></div>
              <div className="brand-sub">THE GOLD STORE</div>
            </div>
          </a>

          <nav className={`links ${mobileMenuOpen ? "visible" : ""}`} id="links">
            <a href="#home" onClick={(e) => { e.preventDefault(); scrollToSection("home"); }}>Trang chủ</a>
            <a href="#products" onClick={(e) => { e.preventDefault(); scrollToSection("products"); }}>Sản phẩm</a>
            <a href="#guide" onClick={(e) => { e.preventDefault(); scrollToSection("guide"); }}>Hướng dẫn</a>
            <a href="#lookup" onClick={(e) => { e.preventDefault(); scrollToSection("lookup"); }}>Tra cứu đơn</a>
            <a href="#faq" onClick={(e) => { e.preventDefault(); scrollToSection("faq"); }}>Hỗ trợ</a>
          </nav>

          <div className="right-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={focusLookupInput}
            >
              <svg><use href="#i-search"/></svg>
              Tra cứu
            </button>
            <button
              type="button"
              className="btn btn-dark"
              onClick={() => scrollToSection("products")}
            >
              Mua Locket Gold <svg><use href="#i-arrow"/></svg>
            </button>
            <button
              type="button"
              className="hamburger"
              id="menuToggle"
              aria-label="Mở menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <div className="container heroarea" id="home">
          <div className="hero">
            <div className="herocopy">
              <div className="eyebrow">LOCKET-PRO • GOLD MEMBERSHIP</div>
              <h1>
                Mọi khoảnh khắc.<br />
                <span>Một trải nghiệm</span> xứng tầm.
              </h1>
              <p>
                Không gian nâng cấp Locket VIP được tinh chỉnh toàn diện để bạn chọn gói dễ dàng hơn,
                xem chi tiết minh bạch và tự động kích hoạt tức thì qua cổng PayOS.
              </p>
              <div className="hero-buttons">
                <button
                  type="button"
                  className="btn btn-dark"
                  onClick={() => scrollToSection("products")}
                >
                  Khám phá gói Gold <svg><use href="#i-arrow"/></svg>
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => scrollToSection("guide")}
                >
                  Xem cách mua
                </button>
              </div>
              <div className="hero-bottom">
                <span><b className="check">✓</b> Giá gốc & ưu đãi niêm yết</span>
                <span><b className="check">✓</b> Tự động kích hoạt qua PayOS</span>
                <span><b className="check">✓</b> Tối ưu 100% trên điện thoại</span>
              </div>
            </div>

            <div className="heroart" aria-hidden="true">
              <div className="h-glow"></div>
              <div className="h-ring"></div>
              <div className="spark s1">✦</div>
              <div className="spark s2">✦</div>

              {/* 3D App Card */}
              <div className="app-card">
                <div className="app-top">
                  <span>locket<span style={{ fontWeight: 400 }}>.</span></span>
                  <b>GOLD</b>
                </div>
                <div className="heart-box">
                  <svg viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth=".1">
                    <path d="M20.8 4.7a5.6 5.6 0 0 0-8 .1L12 5.7l-.8-.9a5.6 5.6 0 0 0-8-.1 5.8 5.8 0 0 0 0 8.2L12 21l8.8-8.1a5.8 5.8 0 0 0 0-8.2Z"/>
                  </svg>
                </div>
                <div className="app-foot">
                  <strong>GOLD.</strong>
                  <small>YOUR MOMENTS, REIMAGINED</small>
                </div>
              </div>

              {/* Floating badges */}
              <div className="float-card fc1">
                <svg><use href="#i-spark"/></svg>
                <div>
                  <b>Thiết kế mới</b>
                  <span>Trực quan • cao cấp</span>
                </div>
              </div>
              <div className="float-card fc2">
                <svg><use href="#i-shield"/></svg>
                <div>
                  <b>Bảo mật & Tự động</b>
                  <span>Kích hoạt qua PayOS</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3 Key Benefits */}
        <div className="container three-benefits">
          <article className="benefit">
            <div className="benefit-icon"><svg><use href="#i-bag"/></svg></div>
            <div>
              <strong>Chọn gói dễ dàng</strong>
              <p>Bố cục sản phẩm rõ ràng, dễ so sánh thời hạn và mức giá.</p>
            </div>
          </article>
          <article className="benefit">
            <div className="benefit-icon"><svg><use href="#i-shield"/></svg></div>
            <div>
              <strong>Kích hoạt tự động</strong>
              <p>Cổng PayOS quét mã QR xác nhận tức thì trong 3-5 giây.</p>
            </div>
          </article>
          <article className="benefit">
            <div className="benefit-icon"><svg><use href="#i-clock"/></svg></div>
            <div>
              <strong>Theo dõi thuận tiện</strong>
              <p>Tra cứu lại đơn hàng và kiểm tra hạn dùng bất cứ lúc nào.</p>
            </div>
          </article>
        </div>

        {/* Products Section */}
        <section className="section container" id="products">
          <div className="section-heading">
            <div>
              <div className="eyebrow">CHOOSE YOUR GOLD</div>
              <h2>Bảng gói dịch vụ.<br />Rõ ràng và tinh tế.</h2>
              <p>
                Toàn bộ dữ liệu giá bán, thời hạn sử dụng và quà tặng AI Filter được kết nối trực tiếp
                từ hệ thống. Nâng cấp tài khoản của bạn ngay hôm nay.
              </p>
            </div>
            <aside className="aside-pill">
              <strong>💡 Nguyên tắc tự động:</strong> Nhập chính xác Username Locket để hệ thống cộng dồn ngày VIP và kích hoạt ngay sau chuyển khoản.
            </aside>
          </div>

          {/* Username Input Card */}
          <div className="user-input-card">
            <div className="user-input-row">
              <div style={{ flex: "none" }}>
                <span style={{ fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", color: "#8e9388", display: "block" }}>
                  Tài khoản nhận VIP
                </span>
                <strong style={{ fontSize: "15px", color: "#171917" }}>Username Locket</strong>
              </div>

              <div className="user-input-field">
                <AtSign />
                <input
                  ref={usernameInputRef}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nhập username Locket của bạn (ví dụ: mtien)"
                  autoComplete="off"
                />
              </div>

              {user?.username && username.trim().toLowerCase() !== user.username.replace(/^@+/, "").toLowerCase() && (
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ minHeight: "44px", padding: "0 14px", fontSize: "12px" }}
                  onClick={() => setUsername(user.username.replace(/^@+/, ""))}
                >
                  Dùng @{user.username.replace(/^@+/, "")}
                </button>
              )}
            </div>

            {/* VIP Status banner if active */}
            {isVip && (
              <div className="vip-status-card">
                <div>
                  <div className="vip-status-badge">
                    <Crown size={15} />
                    Gói VIP hiện tại: <strong>{currentVip?.vipPlanName || "Locket VIP"}</strong>
                    {isLifetimeVip && <span style={{ background: "#facc39", color: "#242013", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 800 }}>VĨNH VIỄN</span>}
                  </div>
                  <div style={{ fontSize: "12px", color: "#746328", marginTop: "3px" }}>
                    Thời hạn còn lại: <strong>{isLifetimeVip ? "Vô thời hạn" : `${remainingDays || 0} ngày`}</strong>. Khi mua thêm gói mới, hệ thống sẽ <strong>tự động cộng dồn nối tiếp</strong> ngày sử dụng!
                  </div>
                </div>
                <div style={{ flex: "none" }}>
                  <span style={{ background: "#2e7b44", color: "#fff", padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: 800 }}>
                    ĐANG HOẠT ĐỘNG
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Gói dùng thử 1 ngày (0đ) */}
          <div className="trial-box">
            <div>
              <span className="trial-badge">
                <Gift size={13} />
                DÙNG THỬ 0Đ
              </span>
              <h4>VIP Dùng thử 1 Ngày (Miễn phí)</h4>
              <p>
                Trải nghiệm trọn vẹn toàn bộ tính năng Locket VIP trong 24 giờ + <strong>Tặng 1 lượt tạo ảnh AI Filter</strong>.
                <br /><small style={{ color: "#6c8c74" }}>* Mỗi tài khoản Locket chỉ được nhận dùng thử 1 lần duy nhất.</small>
              </p>
            </div>

            <button
              type="button"
              onClick={handleClaimTrial}
              disabled={claimingTrial || hasUsedTrial}
              className="btn btn-trial"
            >
              {claimingTrial ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : hasUsedTrial ? (
                "Đã nhận dùng thử"
              ) : (
                "Nhận dùng thử ngay (0đ)"
              )}
            </button>
          </div>

          {/* Platform / Category Tabs */}
          <div className="filterbar">
            <div className="tabs" role="tablist">
              <button
                type="button"
                className={activeTab === "vip" ? "active" : ""}
                role="tab"
                aria-selected={activeTab === "vip"}
                onClick={() => setActiveTab("vip")}
              >
                <Crown size={15} />
                Gói Locket VIP
              </button>
              <button
                type="button"
                className={activeTab === "ai" ? "active" : ""}
                role="tab"
                aria-selected={activeTab === "ai"}
                onClick={() => setActiveTab("ai")}
              >
                <Wand2 size={15} />
                Ảnh AI (AI Filter)
              </button>
            </div>
            <span className="catalog-status">
              Bảng giá niêm yết chính thức • Tự động thanh toán PayOS
            </span>
          </div>

          {/* Category: VIP Plans */}
          {activeTab === "vip" && (
            <div className="plans" id="plans">
              {plans.map((plan, idx) => {
                const isPopular = plan.badge === "Phổ biến" || plan.id === "vip_6months";
                const isBest = plan.badge === "Tiết kiệm" || plan.id === "vip_1year";

                const currentName = currentVip?.vipPlanName || "";
                const isCurrentPlan = isVip && (
                  plan.id === currentVip?.vipPlanId ||
                  (plan.days === 30 && (currentVip?.vipPlanId === "vip_1month" || currentName.includes("1 Tháng"))) ||
                  (plan.days === 180 && (currentVip?.vipPlanId === "vip_6months" || currentName.includes("6 Tháng"))) ||
                  (plan.days === 365 && (currentVip?.vipPlanId === "vip_1year" || currentName.includes("1 Năm")))
                );

                return (
                  <article
                    key={plan.id}
                    className={`plan ${isPopular ? "featured" : ""} ${isCurrentPlan ? "current-user-plan" : ""}`}
                  >
                    <div className="plan-top">
                      <span className="plan-num">GÓI 0{idx + 1}</span>
                      {isCurrentPlan ? (
                        <span className="flag flag-active">
                          <Check size={11} /> ĐANG DÙNG
                        </span>
                      ) : plan.badge ? (
                        <span className="flag">
                          {isBest ? <Star size={11} /> : <Zap size={11} />}
                          {plan.badge.toUpperCase()}
                        </span>
                      ) : (
                        <span className="flag">TIÊU CHUẨN</span>
                      )}
                    </div>

                    <div className="plan-icon">
                      <Crown />
                    </div>

                    <h3>{plan.name}</h3>
                    <div className="plan-desc">
                      {plan.description || `Gói trải nghiệm Locket VIP đầy đủ trong vòng ${plan.days} ngày.`}
                    </div>

                    <span className="price-label">GIÁ NIÊM YẾT</span>
                    <div className="price-slot">
                      <strong>{plan.price.toLocaleString("vi-VN")}đ</strong>
                      <span className="price-badge">/ {plan.days} ngày</span>
                    </div>

                    {plan.bonusAiCredits > 0 && (
                      <div className="bonus-pill">
                        <Sparkles size={13} />
                        Tặng kèm {plan.bonusAiCredits} lượt ảnh AI
                      </div>
                    )}

                    <div className="plan-rule"></div>

                    <ul>
                      <li>Thời hạn sử dụng: {plan.days} ngày đầy đủ</li>
                      <li>Video 15s siêu nét Full HD (1080p - 2K)</li>
                      <li>Khôi phục streak & công cụ Locket độc quyền</li>
                      <li>Kích hoạt tức thì qua mã QR PayOS</li>
                    </ul>

                    <button
                      type="button"
                      className="btn"
                      disabled={creating !== null}
                      onClick={() => onVipPlanClick(plan)}
                    >
                      {creating === plan.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isCurrentPlan ? (
                        "Gia hạn thêm gói này"
                      ) : isVip ? (
                        <>Nâng cấp / Chuyển gói <svg><use href="#i-arrow"/></svg></>
                      ) : (
                        <>Chọn gói này <svg><use href="#i-arrow"/></svg></>
                      )}
                    </button>
                  </article>
                );
              })}
            </div>
          )}

          {/* Category: AI Plans */}
          {activeTab === "ai" && (
            <div>
              {!isVip && (
                <div style={{ background: "#fff9de", border: "1px solid #e7d286", borderRadius: "18px", padding: "18px 22px", marginBottom: "22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <AlertCircle style={{ color: "#b78a1e", flex: "none" }} />
                    <div style={{ fontSize: "13px", color: "#54461a" }}>
                      <strong>Dành riêng cho thành viên VIP:</strong> Bạn cần sở hữu gói VIP hoặc kích hoạt Gói Dùng Thử (0đ) trước khi nạp thêm lượt tạo ảnh AI Filter!
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-gold"
                    style={{ minHeight: "40px", padding: "0 16px", fontSize: "12px" }}
                    onClick={() => setActiveTab("vip")}
                  >
                    Xem gói VIP ngay
                  </button>
                </div>
              )}

              <div className="plans">
                {aiPlans.map((plan, idx) => {
                  const isPopular = plan.badge === "Phổ biến";
                  return (
                    <article
                      key={plan.id}
                      className={`plan ${isPopular ? "featured" : ""}`}
                    >
                      <div className="plan-top">
                        <span className="plan-num">AI GÓI 0{idx + 1}</span>
                        {plan.badge && (
                          <span className="flag">
                            <Star size={11} /> {plan.badge.toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="plan-icon">
                        <Wand2 />
                      </div>

                      <h3>{plan.name}</h3>
                      <div className="plan-desc">
                        {plan.description || `Nạp thêm ${plan.credits} lượt tạo ảnh AI Filter nghệ thuật.`}
                      </div>

                      <span className="price-label">GIÁ NIÊM YẾT</span>
                      <div className="price-slot">
                        <strong>{plan.price.toLocaleString("vi-VN")}đ</strong>
                        <span className="price-badge">= {plan.credits} ảnh</span>
                      </div>

                      <div className="plan-rule"></div>

                      <ul>
                        <li>Số lượng: {plan.credits} lượt tạo ảnh AI</li>
                        <li>Lưu trữ vĩnh viễn không hết hạn</li>
                        <li>Áp dụng cho mọi preset AI Filter</li>
                        <li>Kích hoạt tức thì vào tài khoản</li>
                      </ul>

                      <button
                        type="button"
                        className="btn"
                        disabled={creating !== null || !isVip}
                        onClick={() => handlePurchase(plan.id)}
                      >
                        {creating === plan.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : !isVip ? (
                          "Cần kích hoạt VIP trước"
                        ) : (
                          <>Nạp ngay {plan.buttonText || ""} <svg><use href="#i-arrow"/></svg></>
                        )}
                      </button>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {/* Feature Comparison Table */}
          <div className="compare-box">
            <div className="compare-title">
              <div className="eyebrow">PRIVILEGES & FEATURES</div>
              <h3>So sánh đặc quyền Locket</h3>
              <p>Trải nghiệm vượt trội giữa phiên bản Miễn phí và Locket VIP Gold</p>
            </div>

            <div className="compare-table-wrap">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>Tính năng</th>
                    <th style={{ width: "25%" }}>Miễn phí</th>
                    <th style={{ width: "30%" }}>Locket VIP Gold</th>
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_ROWS.map((row, i) => {
                    const IconComp = row.icon;
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 600, color: "#222" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                            <IconComp size={16} style={{ color: "#9c771a" }} />
                            {row.label}
                          </span>
                        </td>
                        <td>
                          {row.isBoolean ? (
                            row.free ? <Check size={16} style={{ color: "#2e7b44" }} /> : <X size={16} style={{ color: "#b91c1c" }} />
                          ) : (
                            row.free
                          )}
                        </td>
                        <td>
                          {row.isBoolean ? (
                            <span className="compare-badge-vip">
                              <Check size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: "4px" }} />
                              Được mở
                            </span>
                          ) : (
                            <span className="compare-badge-vip">{row.vip}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Steps Guide Section */}
        <section className="steps-wrap" id="guide">
          <div className="container">
            <div className="section-heading">
              <div>
                <div className="eyebrow">HOW TO ORDER</div>
                <h2>Trải nghiệm mua hàng<br />đơn giản hơn.</h2>
                <p>3 bước kích hoạt nhanh chóng, bảo mật và hoàn toàn tự động.</p>
              </div>
            </div>

            <div className="steps">
              <article className="step">
                <div className="step-num">BƯỚC 01 <svg><use href="#i-arrow"/></svg></div>
                <h3>Chọn gói & Username</h3>
                <p>Xem danh sách gói VIP phù hợp và điền chính xác username Locket của bạn.</p>
              </article>
              <article className="step">
                <div className="step-num">BƯỚC 02 <svg><use href="#i-arrow"/></svg></div>
                <h3>Quét mã QR PayOS</h3>
                <p>Hệ thống sinh mã thanh toán chuyển khoản chính xác tới từng đồng trong 5 phút.</p>
              </article>
              <article className="step">
                <div className="step-num">BƯỚC 03 <svg><use href="#i-arrow"/></svg></div>
                <h3>Tự động kích hoạt</h3>
                <p>Tài khoản Locket được nâng cấp VIP ngay tức thì trong 3-5 giây mà không cần chờ duyệt.</p>
              </article>
            </div>
          </div>
        </section>

        {/* Track / Lookup Section */}
        <section className="container track" id="lookup">
          <div>
            <div className="eyebrow">YOUR ORDER • ONE PLACE</div>
            <h2>Kiểm tra đơn hàng<br />thật dễ dàng.</h2>
            <p>
              Tra cứu trạng thái đơn hàng PayOS hoặc kiểm tra hạn dùng VIP của tài khoản Locket trực tiếp từ hệ thống.
            </p>
            <p className="fineprint">
              Hệ thống kết nối trực tiếp với API thanh toán của website.
            </p>
          </div>

          <form className="track-side" id="lookupForm" onSubmit={handleLookupSubmit}>
            <label htmlFor="orderId">Mã đơn hàng PayOS hoặc Username Locket</label>
            <input
              ref={lookupInputRef}
              id="orderId"
              value={lookupQuery}
              onChange={(e) => setLookupQuery(e.target.value)}
              placeholder="Nhập mã đơn hàng hoặc @username"
              required
              autoComplete="off"
            />

            <button type="submit" className="btn btn-dark" disabled={lookupLoading}>
              {lookupLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <svg><use href="#i-search"/></svg>
                  Tra cứu ngay
                </>
              )}
            </button>

            {/* Hiển thị kết quả tra cứu */}
            {lookupResult && (
              <div className="lookup-result-card">
                {lookupResult.type === "order" ? (
                  <div>
                    <div className="lookup-result-header">
                      <div>
                        <span style={{ fontSize: "11px", color: "#8e9388", display: "block" }}>Mã đơn hàng</span>
                        <strong style={{ fontSize: "15px" }}>#{lookupResult.data.orderCode}</strong>
                      </div>
                      <span className={`lookup-status-pill ${
                        lookupResult.data.status === "PAID"
                          ? "status-paid"
                          : lookupResult.data.status === "PENDING"
                            ? "status-pending"
                            : "status-cancelled"
                      }`}>
                        {lookupResult.data.status === "PAID"
                          ? "✓ ĐÃ THANH TOÁN"
                          : lookupResult.data.status === "PENDING"
                            ? "⏳ CHỜ THANH TOÁN"
                            : "ĐÃ HỦY / HẾT HẠN"}
                      </span>
                    </div>

                    <div style={{ fontSize: "13px", lineHeight: "1.7", color: "#474e43" }}>
                      <div>Tài khoản nhận: <strong>@{lookupResult.data.username}</strong></div>
                      <div>Gói dịch vụ: <strong>{lookupResult.data.planName || lookupResult.data.planId}</strong></div>
                      <div>Số tiền: <strong style={{ color: "#bd9220" }}>{(lookupResult.data.amount || 0).toLocaleString("vi-VN")}đ</strong></div>
                    </div>

                    {lookupResult.data.status === "PENDING" && (
                      <button
                        type="button"
                        className="btn btn-gold"
                        style={{ width: "100%", marginTop: "14px", minHeight: "42px" }}
                        onClick={() => navigate(`/pay?orderCode=${lookupResult.data.orderCode}`)}
                      >
                        Tiếp tục thanh toán <ExternalLink size={14} />
                      </button>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="lookup-result-header">
                      <div>
                        <span style={{ fontSize: "11px", color: "#8e9388", display: "block" }}>Tài khoản Locket</span>
                        <strong style={{ fontSize: "15px" }}>@{lookupResult.username}</strong>
                      </div>
                      <span className={`lookup-status-pill ${lookupResult.data.isVip ? "status-paid" : "status-pending"}`}>
                        {lookupResult.data.isVip ? "✓ ĐANG LÀ VIP" : "TÀI KHOẢN FREE"}
                      </span>
                    </div>

                    <div style={{ fontSize: "13px", lineHeight: "1.7", color: "#474e43" }}>
                      {lookupResult.data.isVip ? (
                        <>
                          <div>Gói đang dùng: <strong>{lookupResult.data.vipPlanName || "VIP"}</strong></div>
                          <div>Thời hạn: <strong>{lookupResult.data.vipExpireAt ? new Date(lookupResult.data.vipExpireAt).toLocaleDateString("vi-VN") : "Vĩnh viễn"}</strong></div>
                        </>
                      ) : (
                        <p style={{ margin: 0 }}>Tài khoản chưa nâng cấp gói VIP hoặc gói đã hết hạn.</p>
                      )}
                    </div>

                    <button
                      type="button"
                      className="btn btn-gold"
                      style={{ width: "100%", marginTop: "14px", minHeight: "42px" }}
                      onClick={() => {
                        setUsername(lookupResult.username);
                        scrollToSection("products");
                      }}
                    >
                      Nâng cấp VIP ngay cho @{lookupResult.username}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="fineprint">
              Hỗ trợ tra cứu mã đơn hàng PayOS hoặc tài khoản Locket.
            </div>
          </form>
        </section>

        {/* FAQ Section */}
        <section className="container faq" id="faq">
          <div className="faqs">
            <div>
              <div className="eyebrow">FREQUENTLY ASKED</div>
              <h2>Bạn có thắc mắc?</h2>
              <p style={{ lineHeight: 1.9, color: "#888f84", fontSize: "13px", maxWidth: "320px" }}>
                Giải đáp nhanh các câu hỏi thường gặp khi nâng cấp Locket VIP và sử dụng dịch vụ.
              </p>
            </div>

            <div>
              {FAQ_LIST.map((item, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div key={idx} className={`faqitem ${isOpen ? "open" : ""}`}>
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? -1 : idx)}
                      aria-expanded={isOpen}
                    >
                      {item.q}
                      <span>{isOpen ? "−" : "+"}</span>
                    </button>
                    <div className="faqbody">
                      {item.a}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Last CTA Section */}
        <div className="container">
          <div className="lastcta">
            <div>
              <h2>Sẵn sàng chọn gói Locket Gold?</h2>
              <p>Nâng tầm trải nghiệm chia sẻ khoảnh khắc với chất lượng cao nhất.</p>
            </div>
            <button
              type="button"
              className="btn btn-gold"
              onClick={() => scrollToSection("products")}
            >
              Xem gói dịch vụ <svg><use href="#i-arrow"/></svg>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container footerin">
          <div>
            <div className="brandtitle">Locket<span>-</span><i>Pro</i></div>
            <p>© {new Date().getFullYear()} MTIEN · Camera & Moments · Locket VIP Gold Store</p>
          </div>
          <div className="footerlinks">
            <a href="#home" onClick={(e) => { e.preventDefault(); scrollToSection("home"); }}>Trang chủ</a>
            <a href="#products" onClick={(e) => { e.preventDefault(); scrollToSection("products"); }}>Sản phẩm</a>
            <a href="#lookup" onClick={(e) => { e.preventDefault(); scrollToSection("lookup"); }}>Tra cứu</a>
            <a href="#faq" onClick={(e) => { e.preventDefault(); scrollToSection("faq"); }}>Hỗ trợ</a>
            <a href="https://zalo.me" target="_blank" rel="noopener noreferrer">Zalo hỗ trợ</a>
          </div>
        </div>
      </footer>

      {/* Pending Upgrade Modal */}
      {pendingUpgradeModal && (
        <div
          className="modal open"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPendingUpgradeModal(null);
          }}
        >
          <div className="modalcard">
            <button
              type="button"
              className="close"
              aria-label="Đóng"
              onClick={() => setPendingUpgradeModal(null)}
            >
              ✕
            </button>

            <div className="eyebrow">XÁC NHẬN NÂNG CẤP</div>
            <h2>
              {pendingUpgradeModal.isSamePlan ? "Gia hạn gói VIP" : "Nâng cấp / Chuyển gói VIP"}
            </h2>

            <div style={{ background: "#fbfbf7", border: "1px solid #ebece4", borderRadius: "16px", padding: "16px", margin: "14px 0", fontSize: "13px", lineHeight: "1.7" }}>
              <div>Tài khoản: <strong>@{username.trim().replace(/^@+/, "")}</strong></div>
              <div>Gói hiện tại: <strong style={{ color: "#9c771a" }}>{pendingUpgradeModal.currentPlan.name}</strong></div>
              <div>Thời hạn còn lại: <strong>{pendingUpgradeModal.currentPlan.daysLeft}</strong></div>
            </div>

            <div style={{ background: "#fff9de", border: "1px solid #e7d286", borderRadius: "16px", padding: "16px", margin: "14px 0", fontSize: "13px", lineHeight: "1.7", color: "#54461a" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <strong style={{ fontSize: "15px" }}>{pendingUpgradeModal.targetPlan.name}</strong>
                <strong style={{ fontSize: "16px", color: "#b78a1e" }}>{pendingUpgradeModal.targetPlan.price.toLocaleString("vi-VN")}đ</strong>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "12px" }}>
                ✓ Hệ thống sẽ <strong>cộng dồn tiếp +{pendingUpgradeModal.targetPlan.days} ngày</strong> vào thời hạn dùng hiện tại của bạn.
                {pendingUpgradeModal.targetPlan.bonusAiCredits > 0 && (
                  <span> Tặng thêm +{pendingUpgradeModal.targetPlan.bonusAiCredits} lượt ảnh AI Filter.</span>
                )}
              </p>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setPendingUpgradeModal(null)}
              >
                Đóng
              </button>
              <button
                type="button"
                className="btn btn-gold"
                disabled={creating !== null}
                onClick={() => handlePurchase(pendingUpgradeModal.targetPlan.id)}
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Xác nhận chuyển khoản"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
