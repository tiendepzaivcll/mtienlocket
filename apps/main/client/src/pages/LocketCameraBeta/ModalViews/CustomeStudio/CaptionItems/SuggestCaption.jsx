import React from "react";

const SuggestCaption = ({ title = "🎨 Suggest Caption", presets = [], onSelect }) => {
  const isLoading = !presets || presets.length === 0;

  return (
    <div className="px-4">
      {title && (
        <h2 className="text-md font-semibold text-primary mb-4 flex items-center gap-2">
          {title}
        </h2>
      )}
      
      <div className="flex flex-wrap gap-3 pt-2 pb-6 justify-start">
        {isLoading ? (
          // Loading state - show 3 placeholder buttons
          <>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-32 h-20 rounded-full bg-gradient-to-r from-gray-300 to-gray-400 animate-pulse"
              />
            ))}
          </>
        ) : (
          // Display presets as rounded gradient buttons
          presets.map((preset, index) => {
            // Extract colors from background.colors or fallback to color_top/color_bottom
            const colors = preset.background?.colors || [
              preset.color_top,
              preset.color_bottom,
            ];
            
            // Filter out falsy colors
            const validColors = colors.filter(Boolean);
            const gradientBg = 
              validColors.length >= 2
                ? `linear-gradient(135deg, ${validColors[0]} 0%, ${validColors[1]} 100%)`
                : validColors.length === 1
                ? validColors[0]
                : "#6B7280"; // fallback gray

            return (
              <button
                key={preset.overlay_id || preset.preset_id || preset.id || `preset-${index}`}
                onClick={() =>
                  onSelect({
                    ...preset,
                    overlay_id: "standard",
                    type: "standard",
                    icon: "",
                    caption: "",
                    color_top: preset.color_top || colors[0],
                    color_bottom: preset.color_bottom || colors[1],
                    text_color: preset.text_color || "#FFFFFF",
                    background: preset.background || { colors },
                  })
                }
                className="relative flex items-center justify-center px-6 py-4 rounded-full font-semibold text-white transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95"
                style={{
                  background: gradientBg,
                  color: preset.text_color || "#FFFFFF",
                  minWidth: "120px",
                  minHeight: "60px",
                }}
                title={preset.overlay_id || "Preset"}
              >
                <span className="text-center text-sm leading-tight">
                  {preset.caption || preset.preset_caption || "Caption"}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default React.memo(SuggestCaption);
