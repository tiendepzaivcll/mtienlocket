import "./styles.css";
import "./mtien-home.css";
import { lazy, Suspense } from "react";
import { ArrowDown, ArrowRight, Camera, Image, Smartphone, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/stores";
import MomentStory from "./MomentStory";

const NotificationPrompt = lazy(() => import("@/components/ui/NotificationPrompt"));

const features = [
  { icon: Camera, number: "01", title: "Bắt lấy khoảnh khắc", text: "Chụp ngay hoặc chọn một tấm ảnh, một đoạn video có sẵn trong máy." },
  { icon: Sparkles, number: "02", title: "Thêm một chút riêng", text: "Một dòng caption, một màu sắc. Để khoảnh khắc mang đúng chất của bạn." },
  { icon: Image, number: "03", title: "Gửi đến người thương", text: "Chia sẻ lên Locket và giữ kết nối với những người thân quen." },
];

export default function Home() {
  const isAuth = useAuthStore((state) => state.isAuth);
  const destination = isAuth ? "/locket-beta" : "/login";
  return (
    <div className="mtien-home">
      <section className="mtien-hero mtien-container" aria-labelledby="mtien-hero-title">
        <div className="mtien-hero-copy">
          <div className="mtien-eyebrow"><span /> KHOẢNH KHẮC CỦA BẠN, DẤU ẤN CỦA BẠN</div>
          <h1 id="mtien-hero-title"><span className="locket-pro-hero-name">LOCKET-PRO</span><br /><span>Gần nhau hơn.</span></h1>
          <p>Không cần một ngày thật đặc biệt. Một tấm ảnh, một câu chuyện nhỏ cũng đủ để gửi tới người bạn quan tâm.</p>
          <div className="locket-pro-owner"><img className="locket-pro-owner-avatar" src="/locket-pro-icon-192x192.png" width="48" height="48" alt="Logo MTIEN Locket Camera" /><div>Quản trị bởi <strong>MTIEN</strong><Link to="/contact">Liên hệ admin <ArrowRight size={13} /></Link></div></div>
          <div className="mtien-hero-actions">
            <Link to={destination} className="mtien-button mtien-button-primary">{isAuth ? "Mở Locket" : "Trải nghiệm LOCKET-PRO"}<ArrowRight size={19} /></Link>
            <Link to="/download" className="mtien-button mtien-button-quiet"><Smartphone size={18} />Thêm vào màn hình</Link>
          </div>
          <a className="mtien-discover" href="#cach-su-dung"><ArrowDown size={15} /> Khám phá LOCKET-PRO</a>
        </div>
        <MomentStory />
      </section>
      <section className="mtien-intro mtien-container" id="cach-su-dung" aria-labelledby="mtien-features-title">
        <div className="mtien-section-heading">
          <div><div className="mtien-eyebrow">TỪ BẠN, GỬI ĐẾN BẠN BÈ</div><h2 id="mtien-features-title">Đơn giản thôi.<br />Vẫn đủ để nhớ.</h2></div>
          <p>Một không gian gọn gàng để bạn sáng tạo và chia sẻ ảnh, video lên Locket ngay trên trình duyệt.</p>
        </div>
        <div className="mtien-features">
          {features.map(({ icon: Icon, number, title, text }) => (
            <article className="mtien-feature" key={number}>
              <div className="mtien-feature-top"><Icon size={24} strokeWidth={1.5} /><span>{number}</span></div>
              <h3>{title}</h3><p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="mtien-final-cta mtien-container">
        <div><div className="mtien-eyebrow">KHOẢNH KHẮC TIẾP THEO LÀ CỦA BẠN</div><h2>Hôm nay của bạn thế nào?</h2></div>
        <Link to={destination} className="mtien-button mtien-button-primary">Chia sẻ một chút nhé<ArrowRight size={19} /></Link>
      </section>
      <Suspense fallback={null}><NotificationPrompt /></Suspense>
    </div>
  );
}
