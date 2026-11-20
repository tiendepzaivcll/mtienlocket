// utils/themeUtils.js
const THEME_META_COLORS = {
  "midnight-black": "#000000",
  "crimson-wine": "#4A1525",
  "royal-purple": "#2D1B4E",
  "ocean-blue": "#0F2942",
  "matcha-forest": "#143326",
  "soft-pastel-pink": "#FFF0F5",
};

export const applyTheme = (theme) => {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);

  let metaTheme = document.querySelector('meta[name="theme-color"]');
  if (!metaTheme) {
    metaTheme = document.createElement("meta");
    metaTheme.name = "theme-color";
    document.head.appendChild(metaTheme);
  }
  metaTheme.setAttribute("content", THEME_META_COLORS[theme] || "#000000");
};
