import { Link } from "react-router-dom";
import { CONFIG, CONTACT_CONFIG } from "@/config";

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { startYear } = CONFIG.app;

  return (
    <footer className="mtien-footer">
      <div className="mtien-footer-inner">
        <div className="mtien-footer-identity">
          <Link to="/" className="mtien-wordmark" aria-label="MTIEN — Trang chủ">
            <span>MTIEN<span className="mtien-wordmark-dot">.</span></span>
          </Link>
          <span>Những khoảnh khắc, gần nhau hơn.</span>
        </div>
        <nav aria-label="Thông tin và hỗ trợ">
          <Link to="/download">Hướng dẫn</Link>
          <Link to="/privacy">Quyền riêng tư</Link>
          <Link to="/settings">Cài đặt</Link>
          <Link to="/contact">Liên hệ</Link>
          <a href={`mailto:${CONTACT_CONFIG.supportEmail}`}>{CONTACT_CONFIG.supportEmail}</a>
          <a href={CONTACT_CONFIG.zaloUrl} target="_blank" rel="noopener noreferrer">Zalo: {CONTACT_CONFIG.supportNumber}</a>
        </nav>
        <p>© {startYear}{currentYear > startYear && `–${currentYear}`} MTIEN</p>
      </div>
    </footer>
  );
};

export default Footer;
