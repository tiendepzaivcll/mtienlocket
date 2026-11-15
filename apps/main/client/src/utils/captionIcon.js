// Chống "nhân đôi icon": icon và caption được gửi lên backend ở 2 trường riêng
// (options.icon / options.caption) và Locket tự ghép khi hiển thị. Vì vậy nếu
// chuỗi caption lỡ chứa sẵn icon ở đầu (preset bẩn từ API, dữ liệu cũ đã nhiễm,
// hàng đợi upload cũ...) thì người nhận sẽ thấy icon 2 lần. Các hàm này chỉ
// làm sạch GIÁ TRỊ chuỗi — không đụng tới cấu trúc JSON gửi đi.

// Lấy chuỗi văn bản của icon (emoji) nếu có. Trả về "" cho icon dạng ảnh/URL,
// sf_symbol hay tên định danh — những loại đó không thể xuất hiện dưới dạng
// chữ trong caption nên không được phép strip (tránh cắt nhầm nội dung).
export const resolveIconText = (icon) => {
  let text = "";
  if (typeof icon === "string") {
    text = icon;
  } else if (icon && typeof icon === "object") {
    if (typeof icon.data === "string") text = icon.data;
    else if (typeof icon.emoji === "string") text = icon.emoji;
    else if (typeof icon.url === "string") text = icon.url;
    else if (typeof icon.value === "string") text = icon.value;
  }

  text = text.trim();
  if (!text) return "";
  // URL hoặc đường dẫn ảnh
  if (text.startsWith("/") || text.startsWith("http") || text.startsWith("./")) return "";
  // Tên sf_symbol / định danh nội bộ kiểu "flame.fill", "color_palette_icon"
  if (/^[\w.-]+$/.test(text)) return "";
  return text;
};

export const resolveTimeIcon = (icon) => {
  const source =
    icon && typeof icon === "object"
      ? icon
      : { data: typeof icon === "string" ? icon : "" };
  const data = String(
    source.data || source.url || source.emoji || source.value || "clock.fill",
  ).trim();
  const isClockSymbol = data === "clock" || data === "clock.fill";
  const isImage = /^(https?:\/\/|\/|\.\/)/i.test(data);

  return {
    ...source,
    data,
    type: source.type || (isClockSymbol ? "sf_symbol" : isImage ? "image" : "emoji"),
    color: source.color || "#FFFFFF",
  };
};

// Cắt mọi lần lặp của icon (kèm khoảng trắng/NBSP theo sau) ở ĐẦU caption.
// "🎄 🎄 Noel" + icon "🎄" -> "Noel"; icon ở giữa caption được giữ nguyên
// vì có thể là chủ ý của người dùng.
export const stripLeadingIcon = (caption, icon) => {
  if (typeof caption !== "string" || !caption) return caption;
  const iconText = resolveIconText(icon);
  if (!iconText) return caption;

  let result = caption;
  while (result.startsWith(iconText)) {
    result = result.slice(iconText.length).replace(/^\s+/, "");
  }
  return result;
};
