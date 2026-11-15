import { useEffect, useState } from "react";

const DARK_SURFACE = {
  textColor: "rgba(255, 255, 255, 0.94)",
  glassBackground: "rgba(18, 18, 20, 0.28)",
  textShadow: "0 1px 3px rgba(0, 0, 0, 0.78)",
};

const LIGHT_SURFACE = {
  textColor: "rgba(18, 18, 20, 0.88)",
  glassBackground: "rgba(255, 255, 255, 0.32)",
  textShadow: "0 1px 2px rgba(255, 255, 255, 0.65)",
};

export const getCaptionGlassStyle = (contrast) => ({
  color: contrast.textColor,
  background: contrast.glassBackground,
  textShadow: contrast.textShadow,
  backdropFilter: "blur(16px) saturate(140%)",
  WebkitBackdropFilter: "blur(16px) saturate(140%)",
  boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.12)",
});

const analyzeImage = (source) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 48;
        canvas.height = 18;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("CANVAS_UNAVAILABLE");

        const sourceX = image.naturalWidth * 0.18;
        const sourceY = image.naturalHeight * 0.68;
        const sourceWidth = image.naturalWidth * 0.64;
        const sourceHeight = image.naturalHeight * 0.27;
        context.drawImage(
          image,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          canvas.width,
          canvas.height,
        );

        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let luminanceTotal = 0;
        let brightPixels = 0;
        let visiblePixels = 0;

        for (let index = 0; index < pixels.length; index += 4) {
          if (pixels[index + 3] < 32) continue;
          const luminance =
            (0.2126 * pixels[index] +
              0.7152 * pixels[index + 1] +
              0.0722 * pixels[index + 2]) /
            255;
          luminanceTotal += luminance;
          if (luminance >= 0.68) brightPixels += 1;
          visiblePixels += 1;
        }

        const average = visiblePixels ? luminanceTotal / visiblePixels : 0;
        const brightRatio = visiblePixels ? brightPixels / visiblePixels : 0;
        resolve(average >= 0.64 || brightRatio >= 0.52);
      } catch (error) {
        reject(error);
      }
    };

    image.onerror = reject;
    image.src = source;
  });

export default function useAdaptiveCaptionContrast(imageSource, enabled = true) {
  const [contrast, setContrast] = useState(DARK_SURFACE);

  useEffect(() => {
    let cancelled = false;
    setContrast(DARK_SURFACE);

    if (!enabled || !imageSource) return () => {};

    analyzeImage(imageSource)
      .then((isBright) => {
        if (!cancelled) setContrast(isBright ? LIGHT_SURFACE : DARK_SURFACE);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [enabled, imageSource]);

  return contrast;
}
