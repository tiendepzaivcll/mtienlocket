import { useState, useEffect } from "react";

/**
 * Hook để quản lý install prompt (Add to Home Screen)
 * Hỗ trợ: Android Chrome, Edge, Samsung Internet, Firefox
 * Không hỗ trợ: iOS Safari (cần hướng dẫn thủ công)
 */
export const useInstallPrompt = () => {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if iOS
    const isIOSDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !window.MSStream;
    setIsIOS(isIOSDevice);

    // Check if already installed
    if (window.navigator.standalone === true) {
      setIsInstalled(true);
    }

    // Listen for beforeinstallprompt event (Android)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const installApp = async () => {
    if (!installPrompt) return;

    try {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      
      if (outcome === "accepted") {
        console.log("✅ Ứng dụng đã được cài đặt");
        setIsInstalled(true);
      } else {
        console.log("❌ Người dùng từ chối cài đặt");
      }
      
      setInstallPrompt(null);
    } catch (error) {
      console.error("❌ Lỗi khi cài đặt ứng dụng:", error);
    }
  };

  return {
    installPrompt,
    isInstalled,
    isIOS,
    installApp,
    canInstall: installPrompt !== null && !isInstalled && !isIOS,
  };
};
