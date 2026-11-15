const asText = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : "";

const overlayText = (value) => {
  if (!value) return "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = overlayText(item?.data || item) || asText(item?.alt_text);
      if (text) return text;
    }
    return "";
  }
  if (typeof value !== "object") return "";
  return (
    asText(value.text) ||
    asText(value.caption) ||
    asText(value.alt_text) ||
    overlayText(value.data)
  );
};

const firstLegacyCaption = (moment) =>
  Array.isArray(moment?.captions)
    ? moment.captions.find(
        (item) => asText(item?.text) || asText(item?.caption),
      ) || null
    : null;

export const getMomentCaptionText = (moment) => {
  if (!moment || typeof moment !== "object") return "";
  const legacy = firstLegacyCaption(moment);
  return (
    overlayText(moment.overlays) ||
    asText(moment.caption) ||
    asText(legacy?.text) ||
    asText(legacy?.caption)
  );
};

export const createMomentCaptionSnapshot = (moment) => {
  const text = getMomentCaptionText(moment);
  if (!text) return null;
  return {
    text,
    caption: text,
    overlays: moment?.overlays || null,
    captions: Array.isArray(moment?.captions) ? moment.captions : [],
  };
};

export const restoreMomentCaption = (moment, snapshot) => {
  if (!moment || !snapshot?.text || getMomentCaptionText(moment)) return moment;
  return {
    ...moment,
    caption: snapshot.text,
    overlays: snapshot.overlays,
    captions: snapshot.captions,
  };
};
