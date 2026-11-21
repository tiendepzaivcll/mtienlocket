import { lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "@/styles/mtien-shell.css";

const FloatingActions = lazy(() => import("@/components/ui/FloatingWidget"));
const CropImageStudio = lazy(() => import("@/features/EditorStudio/CropImageStudio"));
import { NotificationModal } from "@/components/ui/NotificationModal";

const DefaultLayout = ({ children }) => {
  const location = useLocation();
  const isLoginPage = location.pathname.startsWith("/login");
  const isPricingPage = location.pathname.startsWith("/pricing");
  const shouldHideFloating = location.pathname.startsWith("/tools");
  const shouldShowFloating = !shouldHideFloating &&
    !["/", "/login", "/home", "/pricing"].includes(location.pathname) &&
    !isLoginPage;
  const shouldShowCrop = ["/postmoments", "/restore-streak"].some((path) =>
    location.pathname.startsWith(path),
  );

  return (
    <div className={`mtien-shell ${isPricingPage ? "mtien-pricing-page-shell" : ""}`}>
      {!isLoginPage && !isPricingPage && <Header />}
      {!isLoginPage && !isPricingPage && <div className="mtien-header-spacer" aria-hidden="true" />}
      <main className={`mtien-content ${isPricingPage ? "p-0" : ""}`}>{children}</main>
      {!shouldHideFloating && !isLoginPage && !isPricingPage && <Footer />}
      <Suspense fallback={null}>
        {shouldShowCrop && <CropImageStudio />}
        {shouldShowFloating && <FloatingActions />}
        <NotificationModal />
      </Suspense>
    </div>
  );
};

export default DefaultLayout;
