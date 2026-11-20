import { useEffect, useState } from "react";
import { checkIfRunningAsPWA } from "@/utils/logic/checkIfRunningAsPWA";

export const useNavigation = () => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isHomeOpen, setIsHomeOpen] = useState(false);
  const [isBottomOpen, setIsBottomOpen] = useState(false);
  const [isChatDetailOpen, setIsChatDetailOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isAiFilterOpen, setIsAiFilterOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFriendsTabOpen, setFriendsTabOpen] = useState(false);
  const [isSettingTabOpen, setSettingTabOpen] = useState(false);
  const [isOptionModalOpen, setOptionModalOpen] = useState(false);
  const [isFriendHistoryOpen, setFriendHistoryOpen] = useState(false);
  const [profileSection, setProfileSection] = useState("lockets");
  const [isFullview, setIsFullview] = useState(() => {
    const saved = localStorage.getItem("isFullview");
    return saved === "true";
  });
  const [isPWA, setIsPWA] = useState(() => {
    return checkIfRunningAsPWA();
  });

  // Lưu vào localStorage khi isFullview thay đổi và đồng bộ class .is-pwa
  useEffect(() => {
    localStorage.setItem("isFullview", isFullview);
    const pwaActive = checkIfRunningAsPWA();
    setIsPWA(pwaActive);
    if (typeof document !== "undefined" && document.body) {
      document.body.classList.toggle("is-pwa", pwaActive);
    }
  }, [isFullview]);

  // Tự động phát hiện nếu đang chạy dưới dạng PWA Standalone
  useEffect(() => {
    const handleCheckPWA = () => {
      const active = checkIfRunningAsPWA();
      setIsPWA(active);
      if (typeof document !== "undefined" && document.body) {
        document.body.classList.toggle("is-pwa", active);
      }
    };

    handleCheckPWA();

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    mediaQuery.addEventListener?.("change", handleCheckPWA);
    return () => mediaQuery.removeEventListener?.("change", handleCheckPWA);
  }, []);

  const [showFlyingEffect, setShowFlyingEffect] = useState(false);
  const [flyingEmojis, setFlyingEmojis] = useState(null);

  return {
    isProfileOpen,
    setIsProfileOpen,
    isHomeOpen,
    setIsHomeOpen,
    isSidebarOpen,
    setIsSidebarOpen,
    isFilterOpen,
    setIsFilterOpen,
    isAiFilterOpen,
    setIsAiFilterOpen,
    isBottomOpen,
    setIsBottomOpen,
    isChatDetailOpen,
    setIsChatDetailOpen,
    isFriendsTabOpen,
    setFriendsTabOpen,
    isOptionModalOpen, setOptionModalOpen,
    isFullview,
    setIsFullview,
    isSettingTabOpen,
    setSettingTabOpen,
    showFlyingEffect,
    setShowFlyingEffect,
    flyingEmojis,
    setFlyingEmojis,
    isPWA,
    setIsPWA,
    isFriendHistoryOpen,
    setFriendHistoryOpen,
    profileSection,
    setProfileSection,
  };
};
