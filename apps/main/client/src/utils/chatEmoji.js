export function isSingleEmoji(value) {
  const text = String(value || "").trim();
  if (!text || text.length > 64) return false;
  if (typeof Intl.Segmenter !== "function") return false;
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)];
  return graphemes.length === 1 &&
    /\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3/u.test(text);
}

export function getQuickReactions(defaultReactions, preferredEmoji) {
  const defaults = defaultReactions || [];
  const preferred = String(preferredEmoji || "").trim();
  return [preferred, ...defaults]
    .filter(
      (emoji, index, reactions) => emoji && reactions.indexOf(emoji) === index,
    )
    .slice(0, defaults.length);
}
