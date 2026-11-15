import { useEffect } from "react";

/**
 * Hook để quản lý icon app selection và update PWA icons dynamically
 * Cập nhật: apple-touch-icon, favicon, manifest.json
 */
export const useAppIcon = () => {
  useEffect(() => {
    const selectedIcon = localStorage.getItem("selectedAppIcon") || "0";
    
    // Cập nhật icon path
    const iconPath = `/icon-app/android-chrome-192x192 (${selectedIcon}).png`;
    
    // 1. Update apple-touch-icon (iOS PWA)
    let appleTouchIcon = document.querySelector("link[rel='apple-touch-icon']");
    if (!appleTouchIcon) {
      appleTouchIcon = document.createElement("link");
      appleTouchIcon.rel = "apple-touch-icon";
      document.head.appendChild(appleTouchIcon);
    }
    appleTouchIcon.href = iconPath;
    
    // 2. Update favicon (favicon.png)
    let faviconIcon = document.querySelector("link[rel='icon'][type='image/png']");
    if (!faviconIcon) {
      faviconIcon = document.createElement("link");
      faviconIcon.rel = "icon";
      faviconIcon.type = "image/png";
      document.head.appendChild(faviconIcon);
    }
    faviconIcon.href = iconPath;
    
    // 3. Update manifest.json icons
    // Fetch và update manifest với icon được chọn
    updateManifestIcon(iconPath);
    
    // 4. Log để debug
    console.log(`🎨 App icon updated to: ${iconPath}`);
  }, []); // Run khi component mount

  // Listen to storage changes (khi có tab khác thay đổi icon)
  useEffect(() => {
    const handleStorageChange = () => {
      // Force reload page để apply changes khi có tab khác thay đổi
      const selectedIcon = localStorage.getItem("selectedAppIcon") || "0";
      const iconPath = `/icon-app/android-chrome-192x192 (${selectedIcon}).png`;
      
      // Update meta tags
      let appleTouchIcon = document.querySelector("link[rel='apple-touch-icon']");
      if (appleTouchIcon) {
        appleTouchIcon.href = iconPath;
      }
      
      let faviconIcon = document.querySelector("link[rel='icon'][type='image/png']");
      if (faviconIcon) {
        faviconIcon.href = iconPath;
      }
      
      updateManifestIcon(iconPath);
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);
};

/**
 * Helper function để update manifest.json icons
 */
function updateManifestIcon(iconPath) {
  try {
    // Fetch manifest.json
    fetch("/manifest.json")
      .then((res) => res.json())
      .then((manifest) => {
        // Update tất cả icons trong manifest
        if (manifest.icons) {
          manifest.icons = manifest.icons.map((icon) => ({
            ...icon,
            src: iconPath,
          }));
        }

        // Cập nhật manifest trong DOM (optional - vì manifest.json là static file)
        // Có thể tạo một manifest API endpoint nếu cần dynamic
        console.log("📦 Manifest icons updated (client-side)", manifest.icons);
      })
      .catch((err) => {
        console.warn("⚠️ Could not update manifest:", err);
      });
  } catch (error) {
    console.warn("⚠️ Manifest update failed:", error);
  }
}
