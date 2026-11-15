import React, { useEffect } from "react";
// 🚀 Thêm useNavigate để lát nữa gọi xe đưa về trang Login
import { Link, useNavigate } from "react-router-dom";
import { X, Settings, LifeBuoy } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { MenuItem } from "./MenuItem";
import ThemeToggle from "./ThemeToggle";
import AppIconMenu from "./AppIconMenu";
// 🚀 Lôi AuthButton, Store và Toast thông báo ra xài
import { AuthButton } from "./AuthButton";
import { useAuthStore } from "@/stores";
import { SonnerSuccess } from "@/components/ui/SonnerToast";

const Sidebar = () => {
  const { navigation } = useApp();
  const { isSidebarOpen, setIsSidebarOpen } = navigation;
  
  // 🚀 Khai báo đồ nghề đăng xuất
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user); // Lấy trạng thái user để hiện nút cho chuẩn
  const logoutStore = useAuthStore((s) => s.logout);

  // 🚀 Hàm dọn rác và đuổi khách về login
  const handleLogout = () => {
    // 1. Quét sạch vé VIP
    localStorage.removeItem("idToken");
    localStorage.removeItem("localId");
    localStorage.removeItem("rememberMe");

    // 2. Tước quyền VIP trong store
    if (logoutStore) {
      logoutStore();
    } else {
      useAuthStore.setState({ user: null, isAuth: false, loading: false });
    }

    // 3. Thông báo và sút ra cổng
    SonnerSuccess("Đăng xuất thành công!", "Hẹn gặp lại!");
    navigate("/login", { replace: true });
  };

  // Khóa cuộn trang khi mở menu
  useEffect(() => {
    document.body.classList.toggle("overflow-hidden", isSidebarOpen);
    return () => document.body.classList.remove("overflow-hidden");
  }, [isSidebarOpen]);

  const currentYear = new Date().getFullYear();

  // 🎯 Menu tối giản: Chỉ giữ lại đúng các trang cần thiết
  const menuSections = [
    {
      title: "Hệ thống & Hỗ trợ",
      items: [
        { to: "/contact", icon: LifeBuoy, text: "Liên hệ & Hỗ trợ" },
        { to: "/settings", icon: Settings, text: "Cài đặt" },
      ],
    },
  ];

  return (
    <>
      {/* Lớp nền mờ (Overlay) */}
      <div
        className={`fixed h-screen z-60 inset-0 bg-base-100/10 backdrop-blur-[2px] transition-opacity duration-500 ${
          isSidebarOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Khung Menu (Sidebar) */}
      <div
        className={`fixed z-60 top-0 right-0 h-full w-64 shadow-xl transition-all duration-500 bg-base-100 flex flex-col ${
          isSidebarOpen
            ? "opacity-100 translate-x-0"
            : "opacity-0 translate-x-full"
        }`}
      >
        {/* Header chứa Logo, Nút Night Mode và Nút Đóng */}
        <div className="flex justify-between items-center py-3 px-2 border-b border-base-300 flex-shrink-0">
          <Link to="/" className="flex items-center gap-1">
            <span className="text-lg pl-2 font-semibold gradient-text select-none">
              Menu
            </span>
          </Link>
          
          {/* Nút gạt chế độ ban đêm / ban ngày */}
          <ThemeToggle />
          
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 rounded-md transition cursor-pointer btn btn-ghost btn-sm"
          >
            <X size={24} />
          </button>
        </div>

        {/* Danh sách các nút */}
        <div className="flex-1 overflow-y-auto mt-2">
          <ul className="menu text-base-content w-full py-2 text-md font-semibold">
            {/* Menu Chọn Icon App */}
            <AppIconMenu onClose={() => setIsSidebarOpen(false)} />

            {/* Các menu sections khác */}
            {menuSections.map((section) => (
              <li key={section.title}>
                <h2 className="menu-title flex items-center justify-between text-base-content/60">
                  <span>{section.title}</span>
                </h2>
                <ul>
                  {section.items.map((item) => (
                    <MenuItem
                      key={item.to}
                      to={item.to}
                      icon={item.icon}
                      onClick={() => setIsSidebarOpen(false)}
                    >
                      {item.text}
                    </MenuItem>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>

        {/* 🚀 CHÈN CỤC NÚT ĐĂNG XUẤT VÀO ĐÂY (Sát đáy, ngay trên Footer) */}
        <div className="mt-auto">
          <AuthButton 
            user={user} 
            onLogout={handleLogout} 
            onClose={() => setIsSidebarOpen(false)} 
          />
        </div>

        {/* Footer bản quyền */}
        <div className="p-4 border-t border-base-300">
          <p className="text-center text-xs text-base-content/70">
            © {currentYear} <span className="font-semibold font-lovehouse">Locket.io.vn</span>. All rights reserved.
          </p>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
