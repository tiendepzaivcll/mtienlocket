import React, { createContext, useEffect, useState } from "react";
import { applyTheme } from "@/utils/theme/themeUtils";

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    // Tự động bỏ theme màu trắng, mặc định luôn là màu đen
    if (!saved || saved === "light" || saved === "valentine" || saved === "winter") {
      localStorage.setItem("theme", "black");
      return "black";
    }
    return saved;
  });

  const changeTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme); // chỉ cần gọi ở đây thôi
  };

  useEffect(() => {
    applyTheme(theme);
  }, []); // chỉ chạy 1 lần khi mount

  return (
    <ThemeContext.Provider value={{ theme, changeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
