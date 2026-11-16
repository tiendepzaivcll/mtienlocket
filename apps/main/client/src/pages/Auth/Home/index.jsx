import { ArrowRight, BookOpen, Camera, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/stores";
import MomentStory from "@/pages/Public/Home/MomentStory";
import "@/pages/Public/Home/mtien-home.css";

export default function AuthHome() {
  const user = useAuthStore((state) => state.user);
  const name = user?.displayName || user?.username;
  return (
    <div className="mtien-auth-home">
      <section className="mtien-hero mtien-container">
        <div className="mtien-hero-copy">
          <div className="mtien-eyebrow"><span /> LOCKET-PRO / ADMIN MTIEN</div>
          <h1>Chào {name || "bạn"}.<br /><span>Kể chuyện hôm nay.</span></h1>
          <p>Một tấm ảnh nhỏ, một lời nhắn dễ thương. Hôm nay bạn muốn gửi điều gì đến những người thân quen?</p>
          <div className="locket-pro-owner"><img className="locket-pro-owner-avatar" src="/locket-pro-icon-192x192.png" width="48" height="48" alt="Logo MTIEN Locket Camera" /><div>Quản trị bởi <strong>MTIEN</strong><Link to="/contact">Liên hệ admin <ArrowRight size={13} /></Link></div></div>
          <div className="mtien-hero-actions"><Link className="mtien-button mtien-button-primary" to="/locket-beta"><Camera size={18} />Mở Locket<ArrowRight size={18} /></Link><Link className="mtien-button mtien-button-quiet" to="/diary"><BookOpen size={18} />Nhật ký của bạn</Link></div>
          <Link className="mtien-discover" to="/settings"><Settings2 size={16} />Tùy chỉnh trải nghiệm</Link>
        </div>
        <MomentStory />
      </section>
    </div>
  );
}
