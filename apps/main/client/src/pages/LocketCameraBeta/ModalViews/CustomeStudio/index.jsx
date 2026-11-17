import { Palette, X } from "lucide-react";
import React, { useEffect, useRef, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import CaptionIconSelector from "./CaptionItems/CaptionIconSelector";
import GeneralThemes from "./CaptionItems/GeneralThemes";
import ThemesCustomes from "./CaptionItems/ThemesCustomes";
import ImageCaptionSelector from "./CaptionItems/ImageCaption";
import PlanBadge from "@/components/ui/PlanBadge/PlanBadge";
import Footer from "@/components/Footer";
import { useFeatureVisible } from "@/hooks/useFeature";
import FeatureGate from "@/components/common/FeatureGate";
import SuggestCaption from "./CaptionItems/SuggestCaption";
import { useOverlayStore } from "@/stores";
import { stripLeadingIcon } from "@/utils/captionIcon";

const DEFAULT_CAPTION_MEDIA_COLORS = ["#3A3A3C", "#1C1C1E"];
const LOCKET_ARIES_ICON = {
  type: "image",
  data: "https://storage.googleapis.com/locket-public/overlays/star_signs/Aries.png",
  source: "url",
};
const STATIC_CONTENT_REPLACEMENT_TYPES = new Set([
  "caption_gif",
  "image_gif",
]);
const STAR_SIGN_COMPAT_TYPES = new Set([
  "star_sign",
  "caption_image",
  "image_icon",
  "caption_icon",
]);

const createStarSignBackground = (colors) => ({
  image: {
    data: "star_sign_background",
    type: "image",
    source: "local",
  },
  colors,
});

const ScreenCustomeStudio = () => {
  const popupRef = useRef(null);
  const { navigation, post } = useApp();

  const { isFilterOpen, setIsFilterOpen } = navigation;
  const { setPostOverlay } = post;
  const { captionOverlays } = useOverlayStore();

  const canUseCaptionIcon = useFeatureVisible("caption_icon");
  const canUseCaptionimage = useFeatureVisible("caption_image");

  // Debug: Track CustomeStudio renders
  console.log(`🔄 CustomeStudio render - isFilterOpen:`, isFilterOpen);

  const cleanIconValue = (icon) => {
    if (typeof icon === "string") {
      return icon.replace(/^\[object.*\]$/i, "");
    }

    if (icon && typeof icon === "object") {
      const data =
        typeof icon.data === "string"
          ? icon.data
          : typeof icon.url === "string"
            ? icon.url
            : "";

      if (!data) return "";

      return {
        type: icon.type || (data.startsWith("http") ? "image" : "emoji"),
        data,
        ...(icon.source ? { source: icon.source } : {}),
      };
    }

    return "";
  };

  const normalizePresetOverlay = (preset) => {
    const overlayId = preset?.overlay_id || preset?.preset_id || preset?.id || "standard";
    const rawType = preset?.type || "default";
    const normalizedType =
      overlayId === "star_sign"
        ? "star_sign"
        : rawType === "image_icon" || rawType === "caption_icon"
        ? "caption_image"
          : rawType;
    const useStarSignTemplate =
      overlayId === "star_sign" ||
      overlayId === "caption:star_sign" ||
      STAR_SIGN_COMPAT_TYPES.has(rawType) ||
      STAR_SIGN_COMPAT_TYPES.has(normalizedType);
    const useStaticContentTemplate =
      STATIC_CONTENT_REPLACEMENT_TYPES.has(rawType) ||
      STATIC_CONTENT_REPLACEMENT_TYPES.has(normalizedType);

    let backgroundColors = Array.isArray(preset?.background?.colors)
      ? preset.background.colors
      : Array.isArray(preset?.background)
        ? preset.background
        : [
            preset?.color_top || preset?.top || preset?.colortop,
            preset?.color_bottom || preset?.color_bot || preset?.colorbottom,
          ].filter(Boolean);

    backgroundColors = backgroundColors.filter((color) => color && typeof color === "string");

    if (
      backgroundColors.length < 2 &&
      (useStarSignTemplate || useStaticContentTemplate)
    ) {
      backgroundColors = DEFAULT_CAPTION_MEDIA_COLORS;
    }

    const rawCaption =
      preset?.caption ?? preset?.preset_caption ?? preset?.text ?? "";

    const background =
      useStarSignTemplate
        ? createStarSignBackground(backgroundColors)
        : { colors: backgroundColors };
    const suppliedIcon = cleanIconValue(preset?.icon || preset?.icon_url || "");
    const icon = useStarSignTemplate ? suppliedIcon || LOCKET_ARIES_ICON : suppliedIcon;

    return {
      overlay_id: useStarSignTemplate ? "star_sign" : overlayId,
      color_top: preset?.color_top || preset?.top || preset?.colortop || backgroundColors[0] || "",
      color_bottom:
        preset?.color_bottom || preset?.color_bot || preset?.colorbottom || backgroundColors[1] || "",
      text_color: preset?.text_color || preset?.color_text || preset?.color || "#FFFFFF",
      icon,
      // Khử icon lặp ở đầu caption — preset từ API có thể mang caption chứa sẵn emoji icon
      caption: stripLeadingIcon(
        String(rawCaption || "").replace(/^\[object.*\]$/i, ""),
        icon,
      ),
      type: normalizedType,
      background,
      max_lines: preset?.max_lines || 1,
      is_editable: preset?.is_editable,
    };
  };

  const handlePresetSelect = useCallback(
    (preset) => {
      if (!preset) return;
      setPostOverlay(normalizePresetOverlay(preset));
      setIsFilterOpen(false);
    },
    [setPostOverlay, setIsFilterOpen],
  );

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
  const handleCustomeSelect = useCallback((preset_id, icon, color_top, color_bottom, caption, text_color, type, background) => {
    if (typeof preset_id === "object" && preset_id !== null) {
      handlePresetSelect(preset_id);
      return;
    }

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
    
    // Ensure background colors survive both old array and new { colors } shapes.
    let cleanBackgroundColors = Array.isArray(background?.colors)
      ? background.colors.filter((color) => color && typeof color === "string")
      : Array.isArray(background)
        ? background.filter((color) => color && typeof color === "string")
        : [];

    const normalizedType =
      type === "image_icon" || type === "caption_icon"
        ? "caption_image"
          : type || "default";
    const useStarSignTemplate =
      preset_id === "star_sign" ||
      preset_id === "caption:star_sign" ||
      STAR_SIGN_COMPAT_TYPES.has(type) ||
      STAR_SIGN_COMPAT_TYPES.has(normalizedType);
    const useStaticContentTemplate =
      STATIC_CONTENT_REPLACEMENT_TYPES.has(type) ||
      STATIC_CONTENT_REPLACEMENT_TYPES.has(normalizedType);
    const suppliedIcon = cleanIconValue(icon);

    if (
      cleanBackgroundColors.length < 2 &&
      (useStarSignTemplate || useStaticContentTemplate)
    ) {
      cleanBackgroundColors = DEFAULT_CAPTION_MEDIA_COLORS;
    }
    
    const finalIcon = useStarSignTemplate ? suppliedIcon || LOCKET_ARIES_ICON : suppliedIcon;

    // Cập nhật postOverlay với clean data only
    setPostOverlay({
      overlay_id: useStarSignTemplate ? "star_sign" : preset_id || "standard",
      color_top: color_top || "",
      color_bottom: color_bottom || "",
      text_color: text_color || "#FFFFFF",
      icon: finalIcon,
      // Khử icon lặp ở đầu caption — preset có thể mang caption chứa sẵn emoji icon
      caption: stripLeadingIcon(cleanCaption, finalIcon),
      type: normalizedType,
      background: useStarSignTemplate
        ? createStarSignBackground(cleanBackgroundColors)
        : { colors: cleanBackgroundColors },
    });

    // Đóng bộ lọc
    setIsFilterOpen(false);
  }, [handlePresetSelect, setPostOverlay, setIsFilterOpen]);

  const handleCustomeSelectTest = (preset) => {
    // Kiểm tra xem preset có đủ thông tin cần thiết không
    if (!preset) return;
    handlePresetSelect(preset);
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
          <div className="px-4">
            <div className="mb-1 flex items-center gap-3">
              <h2 className="text-md font-semibold text-amber-400">🎨 Holiday Caption</h2>
              <div className="badge badge-sm border-0 bg-orange-500 text-white">New</div>
            </div>
          </div>
          <ThemesCustomes
            title=""
            presets={captionOverlays.holiday}
            onSelect={handleCustomeSelect}
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
            title="🎨 Decorative by MTIEN"
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
          <FeatureGate canUse={canUseCaptionimage}>
            <ImageCaptionSelector title="🎨 Caption Ảnh - Truy cập sớm" />
          </FeatureGate>
          <div className="px-4 pb-6">
            <h2 className="text-md font-semibold text-primary">
              🎨 Caption Logo
            </h2>
            <p className="text-xs">Comming Soon?...</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScreenCustomeStudio;
