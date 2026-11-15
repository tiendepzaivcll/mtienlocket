import React from "react";

// Helper to get icon src
const getIconSrc = (icon) => {
  if (!icon) return null;
  if (typeof icon === 'string') return icon;
  if (icon.type === 'image' || icon.type === 'url' || icon.type === 'gif') return icon.data;
  if (icon.type === 'emoji') return null;
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

function CaptionGifThemes({ title, captionThemes, onSelect }) {
  const gifs = captionThemes?.image_gif || [];

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
        {gifs?.map((preset) => {
          const iconSrc = getIconSrc(preset.icon);
          const emoji = getEmoji(preset.icon);

          // Extract clean properties - format for handleCustomeSelectTest
          // Use white background for all gif captions
          const cleanPreset = {
            preset_id: preset.overlay_id || preset.preset_id || preset.id,
            icon: typeof preset.icon === 'string' ? preset.icon : preset.icon?.data || preset.icon,
            color_top: "#FFFFFF",
            color_bottom: "#FFFFFF",
            preset_caption: preset.preset_caption || preset.caption || "",
            text_color: "#000000",
            type: preset.type || "image_gif",
          };

          return (
            <button
              key={preset.id}
              onClick={() => onSelect(cleanPreset)}
              className="flex flex-col whitespace-nowrap items-center space-y-1 py-2 px-4 btn h-auto w-auto rounded-3xl font-semibold justify-center"
              style={{
                background: "rgba(255, 255, 255, 0.9)",
                color: "#000000",
              }}
            >
              <span className="text-base flex flex-row items-center">
                {iconSrc ? (
                  <img src={iconSrc} alt="" className="w-5 h-5 mr-2" />
                ) : emoji ? (
                  <span className="mr-2">{emoji}</span>
                ) : null}
                Caption
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default React.memo(CaptionGifThemes);
