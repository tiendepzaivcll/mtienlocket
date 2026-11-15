const normalizePollOptions = (optionsData = {}) => {
  if (optionsData.type !== "poll") return optionsData;

  const question = String(
    optionsData.caption || optionsData.text || optionsData.payload?.question || "Bạn chọn gì?",
  )
    .trim()
    .slice(0, 140);
  const payload = {
    ...(optionsData.payload || {}),
    question,
    left_emoji: optionsData.payload?.left_emoji || "👍",
    right_emoji: optionsData.payload?.right_emoji || "👎",
  };

  return {
    ...optionsData,
    overlay_id: "caption:poll",
    caption: question,
    text: question,
    max_lines: 2,
    payload,
  };
};

module.exports = { normalizePollOptions };
