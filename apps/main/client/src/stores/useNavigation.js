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

  // Lưu vào localStorage khi isFullview thay đổi
  useEffect(() => {
    try {
      localStorage.setItem("isFullview", String(isFullview));
    } catch {}
  }, [isFullview]);

  // Tự động phát hiện nếu đang chạy dưới dạng PWA Standalone (iOS Safari & Chrome)
  useEffect(() => {
    const handleCheckPWA = () => {
      const active = checkIfRunningAsPWA();
      setIsPWA((prev) => (prev !== active ? active : prev));
      if (typeof document !== "undefined" && document.body) {
        document.body.classList.toggle("is-pwa", active);
      }
    };

    const mediaQuery =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(display-mode: standalone)")
        : null;

    if (mediaQuery) {
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", handleCheckPWA);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleCheckPWA);
      }
    }

    return () => {
      if (mediaQuery) {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener("change", handleCheckPWA);
        } else if (mediaQuery.removeListener) {
          mediaQuery.removeListener(handleCheckPWA);
        }
      }
    };
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
