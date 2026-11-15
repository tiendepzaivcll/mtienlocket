import React, { useState, useEffect } from "react";
import { stripLeadingIcon } from "@/utils/captionIcon";

const getCleanIcon = (icon) => {
  if (typeof icon === "string") return icon;
  if (icon && typeof icon === "object") {
    if (icon.data && typeof icon.data === "string") return icon.data;
    if (icon.emoji && typeof icon.emoji === "string") return icon.emoji;
    if (icon.value && typeof icon.value === "string") return icon.value;
    try {
      const str = JSON.stringify(icon);
      if (str && !str.includes("[object")) return str;
    } catch {}
  }
  return "";
};

const ThemesCustomes = ({ title = "Chọn preset", presets = [], onSelect }) => {
  const [expanded, setExpanded] = useState(false);
  const isLoading = !presets || presets.length === 0;

  // Giới hạn hiển thị nếu chưa mở rộng
  // const displayedPresets = expanded ? presets : presets.slice(0, 4);
  const displayedPresets = presets;

  return (
    <div className="px-4">
      {title && (
        <h2 className="text-md font-semibold text-primary mb-2">{title}</h2>
      )}
      <div className="flex flex-wrap gap-4 pt-2 pb-5 justify-start">
        {isLoading ? (
          <>
            <button
              className="flex flex-row whitespace-nowrap items-center justify-center py-2 px-4 btn h-auto w-auto rounded-3xl font-semibold"
            >
              <img
                src="https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExaTJyaDUyNWkzYjBqaGwycDZ0cWpudmhqbjVkdnBub3hlYXZkMHJ5OSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3gAO9yx102EYTUG5E6/giphy.gif"
                alt=""
                className="w-6 h-6"
              />
              <span className="text-base">Caption</span>
            </button>
          </>
        ) : (
          // <BouncyLoader color="orange" size={30} />
          displayedPresets.map((preset, index) => {
            // Extract clean properties to avoid prototype chain issues
            const cleanIcon = getCleanIcon(preset.icon);
            // Khử icon lặp ở đầu caption — dữ liệu preset có thể chứa sẵn emoji trùng icon
            const cleanCaption = stripLeadingIcon(
              (typeof preset.caption === "string" ? preset.caption : "") ||
                (typeof preset.preset_caption === "string" ? preset.preset_caption : "") ||
                "",
              cleanIcon,
            );
            const cleanPreset = {
              overlay_id: preset.overlay_id || preset.preset_id || preset.id,
              icon: cleanIcon,
              color_top: preset.top || preset.color_top,
              color_bottom: preset.color_bot || preset.color_bottom,
              caption: cleanCaption,
              text_color: preset.color_text || preset.text_color || "#FFFFFF",
              type: preset.type || "custome",
              background: preset.background || [preset.top || preset.color_top, preset.color_bot || preset.color_bottom],
            };
            
            return (
              <button
                key={preset.overlay_id || preset.preset_id || preset.id || `preset-${index}`}
                className="flex flex-col whitespace-nowrap items-center space-y-1 py-2 px-4 btn h-auto w-auto rounded-3xl font-semibold justify-center"
                style={{
                  background: `linear-gradient(to bottom, ${
                    cleanPreset.color_top
                  }, ${cleanPreset.color_bottom})`,
                  color: cleanPreset.text_color,
                }}
                onClick={() => onSelect(cleanPreset)}
              >
                <span className="text-base">
                  {cleanIcon && `${cleanIcon} `}
                  {cleanCaption || "Caption"}
                </span>
              </button>
            );
          })
        )}
      </div>
      {/* {!isLoading && presets.length > 4 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-primary font-semibold underline mb-4"
        >
          {expanded ? "Thu gọn" : "Xem thêm"}
        </button>
      )} */}
    </div>
  );
};

export default React.memo(ThemesCustomes);
