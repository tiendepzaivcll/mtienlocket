import { Palette, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import CaptionIconSelector from "./CaptionItems/CaptionIconSelector";
import GeneralThemes from "./CaptionItems/GeneralThemes";
import ThemesCustomes from "./CaptionItems/ThemesCustomes";
import ImageCaptionSelector from "./CaptionItems/ImageCaption";
import PlanBadge from "@/components/ui/PlanBadge/PlanBadge";
import Footer from "@/components/Footer";
import CaptionGifThemes from "./CaptionItems/CaptionGifThemes";
import { useFeatureVisible } from "@/hooks/useFeature";
import FeatureGate from "@/components/common/FeatureGate";
import SuggestCaption from "./CaptionItems/SuggestCaption";
import { useOverlayStore } from "@/stores";

const ScreenCustomeStudio = () => {
  const navigate = useNavigate();
  const popupRef = useRef(null);
  const { navigation, post } = useApp();

  const { isFilterOpen, setIsFilterOpen } = navigation;
  const { setPostOverlay } = post;
  const { captionOverlays, fetchCaptionOverlays } = useOverlayStore();

  const canUseCaptionGif = useFeatureVisible("caption_gif");
  const canUseCaptionIcon = useFeatureVisible("caption_icon");
  const canUseCaptionimage = useFeatureVisible("caption_image");

  // 🎨 Load caption data khi component mount
  useEffect(() => {
    fetchCaptionOverlays();
  }, [fetchCaptionOverlays]);

  useEffect(() => {
    if (isFilterOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [isFilterOpen]);

  // Memoize handleCustomeSelect to prevent child component re-renders
  const handleCustomeSelect = useCallback((
    preset_id,
    icon,
    color_top,
    color_bottom,
    caption,
    text_color,
    type,
    background = []
  ) => {
    // Strip prototype chain from caption
    let cleanCaption = "";
    if (typeof caption === "string") {
      cleanCaption = caption;
    } else if (caption && typeof caption === "object") {
      // If it's an object, convert to JSON string then back - strips prototype completely
      try {
        const cleaned = JSON.parse(JSON.stringify(caption));
        cleanCaption = typeof cleaned === "string" ? cleaned : "";
      } catch {
        cleanCaption = "";
      }
    }
    // Final check - remove any [object ...] strings
    cleanCaption = String(cleanCaption).replace(/^\[object.*\]$/i, "");
    
    // Strip prototype chain from icon
    let cleanIcon = "";
    if (typeof icon === "string") {
      cleanIcon = icon;
    } else if (icon && typeof icon === "object") {
      try {
        const cleaned = JSON.parse(JSON.stringify(icon));
        cleanIcon = typeof cleaned === "string" ? cleaned : "";
      } catch {
        cleanIcon = "";
      }
    }
    cleanIcon = String(cleanIcon).replace(/^\[object.*\]$/i, "");
    
    // Ensure background is array, not object with prototype
    const cleanBackground = Array.isArray(background) 
      ? background.filter(color => color && typeof color === 'string')
      : [];
    
    // Cập nhật postOverlay với clean data only
    setPostOverlay({
      overlay_id: preset_id || "standard",
      color_top: color_top || "",
      color_bottom: color_bottom || "",
      text_color: text_color || "#FFFFFF",
      icon: cleanIcon,
      caption: cleanCaption,
      type: type || "default",
      background: cleanBackground, // Store clean background colors only
    });

    // Đóng bộ lọc
    setIsFilterOpen(false);
  }, [setPostOverlay, setIsFilterOpen]);

  const handleCustomeSelectTest = (preset) => {
    // Kiểm tra xem preset có đủ thông tin cần thiết không
    if (!preset) return;

    // Strip prototype chain from caption
    let cleanCaption = "";
    try {
      const cleaned = JSON.parse(JSON.stringify(preset.preset_caption || ""));
      cleanCaption = typeof cleaned === "string" ? cleaned : "";
    } catch {
      cleanCaption = typeof preset.preset_caption === "string" ? preset.preset_caption : "";
    }
    cleanCaption = String(cleanCaption).replace(/^\[object.*\]$/i, "");

    // Determine if this is a special caption (Caption Icon or Caption Gif)
    // or if it's a Caption Icon/Gif item based on type
    const isSpecialCaptionByType = preset.type === "image_icon" || preset.type === "image_gif";
    const isSpecialCaptionByContent = 
      cleanCaption.includes("Bạch Dương") || 
      cleanCaption.includes("Aries") ||
      cleanCaption.includes("Happy Birthday");
    
    // Only keep caption text if it's a special content-based caption
    if (!isSpecialCaptionByContent || isSpecialCaptionByType) {
      cleanCaption = "";
    }

    // Handle icon - keep as string (URL or emoji)
    let cleanIcon = "";
    if (typeof preset.icon === "string") {
      cleanIcon = preset.icon;
    } else if (preset.icon && typeof preset.icon === "object" && preset.icon.data) {
      cleanIcon = preset.icon.data;
    }

    // Cập nhật postOverlay từ giá trị preset
    setPostOverlay({
      overlay_id: preset.preset_id || "standard",
      color_top: preset.color_top || "",
      color_bottom: preset.color_bottom || "",
      text_color: preset.text_color || "#FFFFFF",
      icon: cleanIcon,
      caption: cleanCaption,
      type: preset.type || "image_icon",
    });

    setIsFilterOpen(false);
  };

  return (
    <div
      className={`fixed inset-0 z-90 flex justify-center items-end transition-transform duration-500 ${
        isFilterOpen ? "" : "pointer-events-none"
      }`}
    >
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-base-100/10 backdrop-blur-[2px] bg-opacity-50 transition-opacity duration-500 ${
          isFilterOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={() => setIsFilterOpen(false)}
      ></div>

      {/* Popup */}
      <div
        ref={popupRef}
        className={`w-full h-2/3 bg-base-100 text-base-content rounded-t-4xl shadow-lg transition-transform duration-500 flex flex-col ${
          isFilterOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Header - Ghim cố định */}
        <div className="flex justify-between rounded-t-4xl items-center py-2 px-4 bg-base-100 sticky top-0 left-0 right-0 z-50">
          <div className="flex items-center space-x-2 text-primary">
            <Palette size={22} />
            <div className="text-2xl font-lovehouse mt-1.5 font-semibold">
              Customize studio{" "}
            </div>
            <PlanBadge />
          </div>
          <button
            onClick={() => setIsFilterOpen(false)}
            className="text-primary cursor-pointer"
          >
            <X size={30} />
          </button>
        </div>
        {/* Nội dung - Cuộn được */}
        <div className="flex-1 overflow-y-auto">
          <GeneralThemes
            title="🎨 General"
            onSelect={handleCustomeSelectTest}
          />
          <SuggestCaption
            title="🎨 Suggest Caption"
            presets={captionOverlays.suggest}
            onSelect={handleCustomeSelect}
          />
          {/* Decorative by Locket */}
          <ThemesCustomes
            title="🎨 Decorative by Locket"
            presets={captionOverlays.decorative}
            onSelect={handleCustomeSelect}
          />
          <ThemesCustomes
            title="🎨 Decorative by T97"
            presets={captionOverlays.custome}
            onSelect={handleCustomeSelect}
          />
          <FeatureGate canUse={canUseCaptionIcon}>
            <CaptionIconSelector
              title="🎨 Caption Icon - Truy cập sớm"
              captionThemes={captionOverlays}
              onSelect={handleCustomeSelectTest}
            />
          </FeatureGate>
          <FeatureGate canUse={canUseCaptionGif}>
            <CaptionGifThemes
              title="🎨 Caption Gif - Truy cập sớm"
              captionThemes={captionOverlays}
              onSelect={handleCustomeSelectTest}
            />
          </FeatureGate>
          <FeatureGate canUse={canUseCaptionimage}>
            <ImageCaptionSelector title="🎨 Caption Ảnh - Truy cập sớm" />
          </FeatureGate>
          <div className="px-4">
            <h2 className="text-md font-semibold text-primary">
              🎨 Caption Logo
            </h2>
            <p className="text-xs">Comming Soon?...</p>
          </div>
        </div>
        <Footer />
      </div>
    </div>  
  );
};

export default ScreenCustomeStudio;
