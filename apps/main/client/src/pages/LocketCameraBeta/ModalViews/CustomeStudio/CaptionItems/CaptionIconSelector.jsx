import React from "react";

const getIconSrc = (icon) => {
  if (typeof icon === "string") return icon;
  if (icon && typeof icon === "object") return icon.data || icon.url || "";
  return "";
};

const DEFAULT_COLORS = ["#3A3A3C", "#1C1C1E"];

const getPresetColors = (preset) => {
  const colors = Array.isArray(preset?.background?.colors)
    ? preset.background.colors
    : [preset?.top || preset?.color_top, preset?.color_bot || preset?.color_bottom];

  const cleanColors = colors.filter((color) => color && typeof color === "string");
  return cleanColors.length >= 2 ? cleanColors : DEFAULT_COLORS;
};

const getRawPresetColors = (preset) => {
  const colors = Array.isArray(preset?.background?.colors)
    ? preset.background.colors
    : [preset?.top || preset?.color_top, preset?.color_bot || preset?.color_bottom];

  return colors.filter((color) => color && typeof color === "string");
};

function CaptionIconSelector({
  title,
  captionThemes,
  onSelect,
}) {
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
        {captionThemes?.image_icon?.map((preset) => {
          // Extract clean properties to avoid prototype chain issues
          const iconSrc = getIconSrc(preset.icon);
          const colors = getPresetColors(preset);
          const rawColors = getRawPresetColors(preset);
          const isNativeTimeCaption = preset.type === "time";
          const cleanPreset = {
            overlay_id: preset.overlay_id || preset.preset_id || preset.id,
            icon: preset.icon,
            color_top: isNativeTimeCaption ? "" : colors[0],
            color_bottom: isNativeTimeCaption ? "" : colors[1],
            caption: preset.preset_caption || preset.caption || "",
            text_color: preset.color_text || preset.text_color || "#FFFFFF",
            type: preset.type || "caption_image",
            background: {
              ...(preset.background && typeof preset.background === "object" && !Array.isArray(preset.background)
                ? preset.background
                : {}),
              colors: isNativeTimeCaption ? rawColors : colors,
            },
            max_lines: preset.max_lines || 1,
            is_editable: preset.is_editable,
          };
          
          return (
            <button
              key={preset.id}
              onClick={() => onSelect(cleanPreset)}
            className="flex flex-col whitespace-nowrap items-center space-y-1 py-2 px-4 btn h-auto w-auto rounded-3xl font-semibold justify-center"
            style={{
              background: isNativeTimeCaption
                ? "transparent"
                : `linear-gradient(to bottom, ${colors[0]}, ${colors[1]})`,
              color: preset.color_text || preset.text_color,
            }}
          >
            <span className="text-base flex flex-row items-center">
              {iconSrc && <img src={iconSrc} alt="" className="w-5 h-5 mr-2" />}
              {preset.preset_caption || "Caption"}
            </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default React.memo(CaptionIconSelector);
