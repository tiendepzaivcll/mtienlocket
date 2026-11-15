import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { registerSW } from "virtual:pwa-register";
import ErrorBoundary from "./components/pages/ErrorBoundary";

if (import.meta.env.PROD) {
  const updateSW = registerSW({
    onNeedRefresh() {
      console.log("🔄 Có bản mới, đang cập nhật...");
      updateSW(true); // ✅ Gọi để skipWaiting và reload
    },
    onOfflineReady() {
      console.log("✅ Đã sẵn sàng để dùng offline!");
    },
  });
} else if ("serviceWorker" in navigator) {
  // A production SW can otherwise keep serving an old bundle on localhost,
  // making API/config changes appear ineffective during local testing.
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
