import React, { Suspense, useEffect } from "react";
// 🚀 1. GỌI THÊM useLocation VÀ useNavigate ĐỂ DẪN ĐƯỜNG
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from "react-router-dom";

import { publicRoutes, authRoutes, locketRoutes } from "./routes";
import { ThemeProvider } from "./context/ThemeContext";
import { AppProvider } from "./context/AppContext";
import getLayout from "./layouts";
import NotFoundPage from "./components/pages/NotFoundPage";
import { Toaster } from "sonner";
import { SocketProvider } from "./context/SocketContext";
import { useAuthStore, useOverlayStore, useFriendStoreV3 } from "./stores";
import { VipExpiryModal } from "./components/modals/VipExpiryModal";
import { useVipExpiryModal } from "./stores/useVipExpiryModal";
import LoadingPageMain from "./components/pages/LoadPageMain";
import { useAppIcon } from "./hooks/useAppIcon";

function App() {
  return (
    <ThemeProvider>
      {/* <SocketProvider> */}
        <AppProvider>
          <Router>
            <AppContent />
          </Router>
          <Toaster />
        </AppProvider>
      {/* </SocketProvider> */}
    </ThemeProvider>
  );
}

function AppContent() {
  // 🚀 2. KHAI BÁO ÔNG LƠ XE VÀ BẢN ĐỒ
  const navigate = useNavigate();
  const location = useLocation();

  // 🚀 Initialize app icon (PWA icon selection)
  useAppIcon();

  // 🚀 3. MÓC THÊM isAuth VÀ loading TỪ TRONG KHO RA ĐỂ CHECK VÉ
  const { hydrate, init, isAuth, loading } = useAuthStore();
  const fetchCaptionOverlays = useOverlayStore((s) => s.fetchCaptionOverlays);
  const loadFriends = useFriendStoreV3((s) => s.loadFriends);

  // VIP expiry modal
  const { isOpen: isVipModalOpen, reason: vipReason, closeModal: closeVipModal } = useVipExpiryModal();

  const allRoutes = [...publicRoutes, ...authRoutes, ...locketRoutes];

  // Chỉ lấy data lúc mới vào
  useEffect(() => {
    import("./styles/animation.css");
    hydrate();
    init();
    fetchCaptionOverlays();
  }, []);

  // Load danh sách bạn bè khi đã đăng nhập
  useEffect(() => {
    if (!loading && isAuth) {
      loadFriends();
    }
  }, [isAuth, loading]);

  // 🚀 4. ĐÂY CHÍNH LÀ CHÌA KHÓA FIX LỖI:
  // Hễ vào web, nếu trạng thái là đã đăng nhập (isAuth) mà lại đang đứng ở trang login thì auto bế sang locket-beta
  useEffect(() => {
    if (!loading && isAuth && (location.pathname === "/login" || location.pathname === "/")) {
      navigate("/locket-beta", { replace: true });
    }
  }, [isAuth, loading, location.pathname, navigate]);

  const handleVipModalConfirm = async () => {
    closeVipModal();
    const { useAuthStore } = await import("./stores");
    const authStore = useAuthStore.getState();
    await authStore.clearAndlogout();
    window.location.href = "/login";
  };

  return (
    <>
      {/* VIP Expiry Modal */}
      <VipExpiryModal 
        isOpen={isVipModalOpen} 
        reason={vipReason}
        onConfirm={handleVipModalConfirm}
      />

      <Suspense fallback={<LoadingPageMain isLoading={true} />}>
        <Routes>
          {allRoutes.map(({ path, component: Component }) => {
            const Layout = getLayout(path);
            return (
              <Route
                key={path}
                path={path}
                element={
                  <Layout>
                    <Component />
                  </Layout>
                }
              />
            );
          })}
          {/* Nhập bậy bạ thì ra trang NotFound */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default App;