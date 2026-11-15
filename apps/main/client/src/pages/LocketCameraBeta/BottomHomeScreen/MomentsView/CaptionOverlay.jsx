import React from "react";
import { stripLeadingIcon } from "@/utils/captionIcon";

function CaptionOverlay({ currentMoment }) {
  const backgroundColors = Array.isArray(
    currentMoment?.overlays?.background?.colors,
  )
    ? currentMoment.overlays.background.colors.filter(Boolean)
    : [];

  return (
    <div
      className="absolute bottom-4 left-1/2 w-max max-w-[80%] -translate-x-1/2 rounded-3xl px-2.5 py-2 backdrop-blur-sm"
      style={{
        background:
          backgroundColors.length >= 2
            ? `linear-gradient(to bottom, ${backgroundColors.join(", ")})`
            : "transparent",
        color: currentMoment?.overlays?.textColor || "#fff",
      }}
    >
      <div className="flex w-max max-w-full items-center justify-center gap-1.5 text-center text-base font-bold leading-6">
        {/* Icon overlay nếu có */}
        {currentMoment?.overlays?.icon &&
          (currentMoment.overlays.icon.type === "emoji" ? (
            <span className="text-lg">{currentMoment.overlays.icon.data}</span>
          ) : (
            <img
              src={currentMoment.overlays.icon.data}
              alt="icon"
              className="w-6 h-6 object-contain"
            />
          ))}
        <span
          className="block whitespace-normal break-words text-center"
        >
          {stripLeadingIcon(currentMoment.caption, currentMoment?.overlays?.icon)}
        </span>
      </div>
    </div>
  );
}
export default CaptionOverlay;
