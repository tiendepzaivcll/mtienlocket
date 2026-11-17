import "./header.css";
import { ArrowUpRight, Menu } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { useAuthStore } from "@/stores";

const Header = () => {
  const { navigation } = useApp();
  const user = useAuthStore((state) => state.user);
  const accessRole = useAuthStore((state) => state.accessRole);
  const destination = user
    ? accessRole === "celebrity" ? "/tools#celebrity" : "/locket-beta"
    : "/login";

  return (
    <header className="mtien-header">
      <div className="mtien-header-inner">
        <Link to={user ? "/locket-beta" : "/login"} className="mtien-wordmark" aria-label="LOCKET-PRO">
          <img src="/locket-pro-icon-192x192.png" alt="" width="34" height="34" />
          <span className="mtien-brand-copy">
            <span className="mtien-brand-name">LOCKET<span className="mtien-wordmark-dot">-PRO</span></span>
          </span>
        </Link>
        <nav className="mtien-header-nav" aria-label="Điều hướng chính">
          <NavLink to={user ? "/locket-beta" : "/login"} end>Trang chủ</NavLink>
          <NavLink to="/download">Hướng dẫn</NavLink>
        </nav>
        <div className="mtien-header-actions">
          <Link to={destination} className="mtien-header-cta">
            {user ? "Mở Locket" : "Đăng nhập"}
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={() => navigation.setIsSidebarOpen(true)}
            className="mtien-menu-trigger"
            aria-label="Mở menu"
            aria-expanded={navigation.isSidebarOpen}
            aria-controls="mtien-navigation-drawer"
          >
            <Menu size={22} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
