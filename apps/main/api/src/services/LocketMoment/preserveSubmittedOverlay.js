const getTextFromOverlay = (overlay) => {
  if (!overlay || typeof overlay !== "object") return "";
  const data =
    overlay.data && typeof overlay.data === "object" ? overlay.data : overlay;
  const value = data.text || data.caption || overlay.alt_text || "";
  return typeof value === "string" ? value.trim() : "";
};

const hasMeaningfulOverlay = (overlay) => {
  if (!overlay || typeof overlay !== "object") return false;
  const data =
    overlay.data && typeof overlay.data === "object" ? overlay.data : overlay;
  if (getTextFromOverlay(overlay)) return true;

  const type = String(
    data.captionType || data.type || overlay.overlay_type || "",
  ).toLowerCase();
  return Boolean(
    type &&
      type !== "caption" &&
      (Object.keys(data.payload || {}).length || Object.keys(data.icon || {}).length),
  );
};

const hasOverlayContent = (overlays) =>
  Array.isArray(overlays)
    ? overlays.some(hasMeaningfulOverlay)
    : hasMeaningfulOverlay(overlays);

/**
 * The immediate post response can omit caption/overlay fields even though the
 * submitted payload is valid. Echo the submitted values into that response;
 * later Firestore data is still authoritative when it contains real content.
 */
const preserveSubmittedOverlay = (responseMoment, submittedPostData) => {
  const moment =
    responseMoment && typeof responseMoment === "object"
      ? { ...responseMoment }
      : {};
  const requestData = submittedPostData?.data || submittedPostData || {};
  const submittedOverlays = Array.isArray(requestData.overlays)
    ? requestData.overlays
    : requestData.overlays
      ? [requestData.overlays]
      : [];
  const submittedCaption =
    (typeof requestData.caption === "string" && requestData.caption.trim()) ||
    getTextFromOverlay(submittedOverlays[0]) ||
    "";

  if (submittedCaption && !String(moment.caption || "").trim()) {
    moment.caption = submittedCaption;
  }
  if (submittedOverlays.length && !hasOverlayContent(moment.overlays)) {
    moment.overlays = submittedOverlays;
  }

  return moment;
};

module.exports = {
  getTextFromOverlay,
  hasOverlayContent,
  preserveSubmittedOverlay,
};
