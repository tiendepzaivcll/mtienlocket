import "./mtien-home.css";
import { lazy, Suspense } from "react";
import {
  ArrowRight,
  Camera,
  Flame,
  Layers,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/stores";
import MomentStory from "./MomentStory";

const NotificationPrompt = lazy(() =>
  import("@/components/ui/NotificationPrompt")
);

const bentoFeatures = [
  {
    icon: Camera,
    title: "Video 15s & Ảnh Chuẩn HD",
    desc: "Chụp trực tiếp từ camera hoặc tải ảnh/video từ máy mà không bị nén mờ. Tốc độ gửi siêu nhanh đến bạn bè.",
    tag: "Chất lượng gốc",
  },
  {
    icon: Layers,
    title: "Photobooth 4 Ô Hàn Quốc",
    desc: "Chụp liền 4 kiểu ảnh phong cách photobooth xinh xắn, thêm khung ảnh và bộ lọc màu nghệ thuật trong vài giây.",
    tag: "Tính năng Hot",
  },
  {
    icon: Flame,
    title: "Khôi Phục & Giữ Lửa Streak",
    desc: "Bảo vệ chuỗi ngày tương tác quý giá cùng người thương. Xem lịch sử streak chi tiết và khôi phục khi lỡ quên.",
    tag: "Độc quyền",
  },
];

export default function Home() {
  const isAuth = useAuthStore((state) => state.isAuth);
  const destination = isAuth ? "/locket-beta" : "/login";

  return (
    <div className="lp-home">
      {/* Ambient background aura */}
      <div className="lp-glow-radial" />
      <div className="lp-glow-warm" />

      {/* Hero Section */}
      <section className="lp-container lp-hero" aria-labelledby="lp-hero-title">
        <div className="lp-hero-content">
          <div className="lp-pill">
            <span className="lp-pill-dot" />
            <span>Trải nghiệm Locket Web Thế Hệ Mới</span>
          </div>

          <h1 id="lp-hero-title" className="lp-title">
            Ghi lại từng khoảnh khắc, <br />
            <span className="lp-title-gradient">Gần nhau từng giây.</span>
          </h1>

          <p className="lp-subtitle">
            Không gian chia sẻ ảnh, video 15s sắc nét, chụp photobooth 4 ô
            và hàng trăm hiệu ứng độc quyền ngay trên trình duyệt của bạn.
          </p>

          <div className="lp-actions">
            <Link to={destination} className="lp-btn-primary">
              <span>{isAuth ? "Mở Locket Ngay" : "Bắt Đầu Trải Nghiệm"}</span>
              <ArrowRight size={17} />
            </Link>
            <Link to="/download" className="lp-btn-secondary">
              <Smartphone size={17} />
              <span>Cài đặt WebApp</span>
            </Link>
          </div>

          <div className="lp-trust-row">
            <div className="lp-trust-item">
              <Zap size={15} className="text-emerald-400" />
              <span>Đồng bộ <strong>siêu tốc</strong></span>
            </div>
            <div className="lp-trust-item">
              <ShieldCheck size={15} className="text-cyan-400" />
              <span>Bảo mật <strong>riêng tư</strong></span>
            </div>
            <div className="lp-trust-item">
              <Sparkles size={15} className="text-amber-300" />
              <span>Trải nghiệm <strong>mượt mà</strong></span>
            </div>
          </div>
        </div>

        {/* Centerpiece Mockup */}
        <MomentStory />
      </section>

      {/* Bento Grid Feature Section */}
      <section className="lp-container lp-features-section">
        <div className="lp-section-header">
          <div className="lp-pill" style={{ margin: "0 auto" }}>
            <Sparkles size={13} />
            <span>Tính Năng Nổi Bật</span>
          </div>
          <h2 className="lp-section-title">Mọi thứ bạn cần cho Locket</h2>
          <p className="lp-section-desc">
            Thiết kế tối giản, tập trung vào cảm xúc và sự mượt mà trong từng lần chạm.
          </p>
        </div>

        <div className="lp-bento-grid">
          {bentoFeatures.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div key={idx} className="lp-bento-card">
                <div className="lp-bento-icon">
                  <Icon size={22} />
                </div>
                <h3 className="lp-bento-title">{feat.title}</h3>
                <p className="lp-bento-desc">{feat.desc}</p>
                <span className="lp-bento-tag">{feat.tag}</span>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA Banner */}
        <div className="lp-cta-banner">
          <div className="lp-cta-glow" />
          <h3 className="lp-cta-title">Sẵn sàng lưu giữ khoảnh khắc hôm nay?</h3>
          <p className="lp-cta-subtitle">
            Tham gia cùng hàng nghìn bạn bè đang sử dụng Locket trên máy tính và điện thoại.
          </p>
          <Link to={destination} className="lp-btn-primary" style={{ margin: "0 auto" }}>
            <span>{isAuth ? "Mở Locket Của Bạn" : "Khám Phá Ngay Hôm Nay"}</span>
            <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      <Suspense fallback={null}>
        <NotificationPrompt />
      </Suspense>
    </div>
  );
}
