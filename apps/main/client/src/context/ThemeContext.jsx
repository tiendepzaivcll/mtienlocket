import React, { createContext, useEffect, useState } from "react";
import { applyTheme } from "@/utils/theme/themeUtils";

export const VALID_THEMES = [
  "midnight-black",
  "crimson-wine",
  "royal-purple",
  "ocean-blue",
  "matcha-forest",
  "soft-pastel-pink",
];

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    // Nếu chưa chọn hoặc đang lưu key theme cũ, tự động chuyển về midnight-black
    if (!saved || !VALID_THEMES.includes(saved)) {
      localStorage.setItem("theme", "midnight-black");
      return "midnight-black";
    }
    return saved;
  });

  const changeTheme = (newTheme) => {
    const targetTheme = VALID_THEMES.includes(newTheme) ? newTheme : "midnight-black";
    setTheme(targetTheme);
    localStorage.setItem("theme", targetTheme);
    applyTheme(targetTheme);
  };

  useEffect(() => {
    applyTheme(theme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, changeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
