import React from "react";

// Helper to get icon src
const getIconSrc = (icon) => {
  if (!icon) return null;
  if (typeof icon === 'string') return icon;
  if (icon.type === 'image' || icon.type === 'url') return icon.data;
  if (icon.type === 'emoji') return null; // emoji doesn't have src
  if (icon.data && typeof icon.data === 'string' && icon.data.startsWith('/')) return icon.data;
  if (icon.data && typeof icon.data === 'string' && icon.data.startsWith('http')) return icon.data;
  return null;
};

// Helper to get emoji
const getEmoji = (icon) => {
  if (!icon) return null;
  if (icon.type === 'emoji') return icon.data;
  return null;
};

// Helper to get display name for caption
const getDisplayCaption = (preset) => {
  const caption = preset.preset_caption || preset.caption || "";
  
  // Giữ tên gốc cho 2 caption đặc biệt
  if (caption.includes("Bạch Dương") || caption.includes("Aries")) return caption;
  if (caption.includes("Happy Birthday") || caption === "Happy Birthday!") return caption;
  
  // Các caption khác hiển thị là "caption"
  return "caption";
};

// Check if this is a special preset that should keep its original background
const isSpecialPreset = (preset) => {
  const caption = preset.preset_caption || preset.caption || "";
  const id = preset.id || preset.preset_id || preset.overlay_id || "";
  return caption.includes("Bạch Dương") || id.includes("aries") || id.includes("Aries");
};

// Get custom text color for specific presets
const getCustomTextColor = (preset) => {
  const caption = preset.preset_caption || preset.caption || "";
  const id = preset.id || preset.preset_id || preset.overlay_id || "";

  // Gold text
  if (caption.includes("locket_gold_badge") || id.includes("locket_gold_badge")) return "#FFD700";
  if (caption.includes("icon_locket_default") || id.includes("icon_locket_default")) return "#FFD700";
  if (caption.includes("Streakkkk") || caption === "Streakkkk!") return "#FFD700";
  if (caption.includes("gold_on_black_outline") || id.includes("gold_on_black_outline")) return "#FFD700";

  // Sky blue text
  if (caption.includes("icon_pastel_3d_blue") || id.includes("icon_pastel_3d_blue")) return "#00BFFF";

  // Pink text
  if (caption.includes("pastel_3d_pink") || id.includes("pastel_3d_pink")) return "#FF69B4";
  if (caption.includes("flowers_magenta") || id.includes("flowers_magenta")) return "#FF69B4";

  // Purple text
  if (caption.includes("gem_bg_pink") || id.includes("gem_bg_pink")) return "#8B5CF6";

  // Red text
  if (caption.includes("Happy Birthday") || caption === "Happy Birthday!") return "#FF0000";

  // Default black text for white background
  return "#000000";
};

function CaptionIconSelector({
  title,
  captionThemes,
  onSelect,
}) {
  const captions = captionThemes?.image_icon || [];

  return (
    <div className="px-4">
      {title && (
        <>
          <div className="flex flex-row gap-3 items-center mb-2">
            <h2 className="text-md font-semibold text-primary">{title}</h2>
            <div className="badge badge-sm badge-secondary">New</div>
          </div>
        </>
      )}
      <div className="flex flex-wrap gap-4 pt-2 pb-5 justify-start">
        {captions?.map((preset) => {
          const iconSrc = getIconSrc(preset.icon);
          const emoji = getEmoji(preset.icon);
          const useOriginalBg = isSpecialPreset(preset);
          const customTextColor = useOriginalBg
            ? (preset.color_text || preset.text_color || "#FFFFFF")
            : getCustomTextColor(preset);

          // Extract clean properties - format for handleCustomeSelectTest
          const cleanPreset = {
            preset_id: preset.overlay_id || preset.preset_id || preset.id,
            icon: typeof preset.icon === 'string' ? preset.icon : preset.icon?.data || preset.icon,
            color_top: useOriginalBg ? (preset.top || preset.color_top) : "#FFFFFF",
            color_bottom: useOriginalBg ? (preset.color_bot || preset.color_bottom) : "#FFFFFF",
            preset_caption: preset.preset_caption || preset.caption || "",
            text_color: customTextColor,
            type: preset.type || "image_icon",
          };

          return (
            <button
              key={preset.id}
              onClick={() => onSelect(cleanPreset)}
              className="flex flex-col whitespace-nowrap items-center space-y-1 py-2 px-4 btn h-auto w-auto rounded-3xl font-semibold justify-center"
              style={{
                background: useOriginalBg
                  ? `linear-gradient(to bottom, ${preset.top || preset.color_top}, ${preset.color_bot || preset.color_bottom})`
                  : "rgba(255, 255, 255, 0.9)",
                color: customTextColor,
              }}
            >
              <span className="text-base flex flex-row items-center">
                {iconSrc ? (
                  <img src={iconSrc} alt="" className="w-5 h-5 mr-2" />
                ) : emoji ? (
                  <span className="mr-2">{emoji}</span>
                ) : null}
                {getDisplayCaption(preset)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default React.memo(CaptionIconSelector);
