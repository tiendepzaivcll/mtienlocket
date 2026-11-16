import { lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "@/styles/mtien-shell.css";

const FloatingActions = lazy(() => import("@/components/ui/FloatingWidget"));
const CropImageStudio = lazy(() => import("@/features/EditorStudio/CropImageStudio"));

const DefaultLayout = ({ children }) => {
  const location = useLocation();
  const shouldHideFloating = location.pathname.startsWith("/tools");
  const shouldShowFloating = !shouldHideFloating &&
    !["/", "/login", "/home"].includes(location.pathname);
  const shouldShowCrop = ["/postmoments", "/restore-streak"].some((path) =>
    location.pathname.startsWith(path),
  );

  return (
    <div className="mtien-shell">
      <Header />
      <div className="mtien-header-spacer" aria-hidden="true" />
      <main className="mtien-content">{children}</main>
      {!shouldHideFloating && <Footer />}
      <Suspense fallback={null}>
        {shouldShowCrop && <CropImageStudio />}
        {shouldShowFloating && <FloatingActions />}
      </Suspense>
    </div>
  );
};

export default DefaultLayout;
