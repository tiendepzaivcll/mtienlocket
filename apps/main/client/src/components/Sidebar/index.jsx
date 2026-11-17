import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import {
  X,
  Home,
  Upload,
  Camera,
  Smartphone,
  ShieldCheck,
  Wrench,
  Settings,
  UserRound,
  SquareArrowOutUpRight,
  Newspaper,
  CalendarClock,
  MessageCircle,
  Crown,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { MenuItem } from "./MenuItem";
import { AuthButton } from "./AuthButton";
import ThemeToggle from "./ThemeToggle";
import { SonnerError, SonnerSuccess } from "../ui/SonnerToast";
import { CONFIG } from "@/config";
import { useAuthStore } from "@/stores";

const Sidebar = () => {
  const user = useAuthStore((state) => state.user);
  const accessRole = useAuthStore((state) => state.accessRole);
  const clearAndlogout = useAuthStore((state) => state.clearAndlogout);
  
  const navigate = useNavigate();
  const { navigation } = useApp();
  const { isSidebarOpen, setIsSidebarOpen } = navigation;

  const drawerRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!isSidebarOpen) return;
    const previousFocus = document.activeElement;
    document.body.classList.add("overflow-hidden");
    closeRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsSidebarOpen(false);
      if (event.key !== "Tab") return;
      const controls = drawerRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled])',
      );
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("overflow-hidden");
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isSidebarOpen, setIsSidebarOpen]);

  const currentYear = new Date().getFullYear();
  const { startYear } = CONFIG.app;
  const handleLogout = async () => {
    try {
      await clearAndlogout();
      SonnerSuccess(
        "Đăng xuất thành công!",
        `Tạm biệt ${user?.displayName || "người dùng"}!`,
      );
      window.location.href = "/login";
    } catch (error) {
      SonnerError("error", "Đăng xuất thất bại!");
      console.error("❌ Lỗi khi đăng xuất:", error);
    }
  };

  // Menu chia theo nhóm
  const userMenuSections = [
    {
      title: "Điều hướng",
      items: [
        { to: "/", icon: Home, text: "Trang chủ" },
        { to: "/pricing", icon: Crown, text: "Nâng cấp VIP", badge: "Hot" },
        { to: "/newsfeed", icon: Newspaper, text: "Bảng tin", badge: "New" },
        {
          to: "/download",
          icon: SquareArrowOutUpRight,
          text: "Cài đặt WebApp",
        },
      ],
    },
    {
      title: "Tính năng",
      items: [
        { to: "/postmoments", icon: Upload, text: "Đăng ảnh, video" },
        { to: "/locket-beta?camera=photobooth", icon: Camera, text: "Photobooth 4 ô" },
        {
          to: "/locket-beta",
          icon: Smartphone,
          text: "Locket Camera",
          badge: "Beta",
        },
        { to: "/tools", icon: Wrench, text: "Công cụ Locket" },
        {
          to: "/diary",
          icon: CalendarClock,
          text: "Nhật ký Locket",
          badge: "New",
        },
        { to: "/profile", icon: UserRound, text: "Hồ sơ của bạn" },
      ],
    },
    {
      title: "Hệ thống & Hỗ trợ",
      items: [
        { to: "/admin", icon: ShieldCheck, text: "Quản trị" },
        { to: "/contact", icon: MessageCircle, text: "Liên hệ admin" },
        // { to: "/devpage", icon: Code2, text: "Trang lập trình", badge: "New" },
        { to: "/privacy", icon: ShieldCheck, text: "Chính sách bảo mật" },
        { to: "/settings", icon: Settings, text: "Cài đặt" },
      ],
    },
  ];

  const guestMenuSections = [
    {
      title: "Điều hướng",
      items: [
        { to: "/", icon: Home, text: "Trang chủ" },
        { to: "/pricing", icon: Crown, text: "Nâng cấp VIP", badge: "Hot" },
        { to: "/newsfeed", icon: Newspaper, text: "Bảng tin", badge: "New" },
        {
          to: "/download",
          icon: SquareArrowOutUpRight,
          text: "Cài đặt WebApp",
        },
      ],
    },
    {
      title: "Hệ thống & Hỗ trợ",
      items: [
        { to: "/admin", icon: ShieldCheck, text: "Quản trị" },
        { to: "/contact", icon: MessageCircle, text: "Liên hệ admin" },
        { to: "/privacy", icon: ShieldCheck, text: "Chính sách bảo mật" },
        { to: "/settings", icon: Settings, text: "Cài đặt" },
      ],
    },
  ];

  const menuSections = user ? userMenuSections : guestMenuSections;

  if (!isSidebarOpen) return null;

  return createPortal(
    <>
      <button
        type="button"
        className="mtien-menu-overlay"
        onClick={() => setIsSidebarOpen(false)}
        aria-label="Đóng menu"
        tabIndex={-1}
      />
      <div
        ref={drawerRef}
        id="mtien-navigation-drawer"
        className="mtien-menu-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Menu LOCKET-PRO"
      >
        <div className="mtien-menu-top">
          <Link to="/" onClick={() => setIsSidebarOpen(false)}>
            <img src="/locket-pro-icon-192x192.png" alt="" width="30" height="30" />
            <span className="mtien-menu-brand-copy">
              <span>LOCKET-PRO</span>
              <span className="mtien-menu-admin">Quản trị bởi <strong>MTIEN</strong></span>
            </span>
          </Link>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="mtien-menu-close"
            aria-label="Đóng menu"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <nav className="mtien-menu-scroll" aria-label="Toàn bộ điều hướng">
          {menuSections.map((section) => (
            <section className="mtien-menu-section" key={section.title}>
              <h2>{section.title}</h2>
              <ul>
                {section.items.map((item) => (
                  <MenuItem
                    key={item.to}
                    to={item.to}
                    icon={item.icon}
                    badge={item.badge}
                    locked={accessRole === "celebrity" && !["/tools", "/contact", "/admin"].includes(item.to)}
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    {item.text}
                  </MenuItem>
                ))}
              </ul>
            </section>
          ))}
          <div className="mtien-menu-theme">
            <span>Giao diện Locket</span>
            <ThemeToggle />
          </div>
        </nav>
        <AuthButton
          user={user}
          onLogout={handleLogout}
          onClose={() => setIsSidebarOpen(false)}
        />
        <p className="mtien-menu-copyright">
          © {startYear}{currentYear > startYear && `–${currentYear}`} LOCKET-PRO
        </p>
      </div>
    </>, document.body
  );
};

export default Sidebar;
