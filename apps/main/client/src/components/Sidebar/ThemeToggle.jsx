import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

export default function ThemeToggle() {
  const { theme, changeTheme } = useTheme();
  const isDark = theme !== "soft-pastel-pink";

  return (
    <button
      type="button"
      className="mtien-theme-toggle"
      onClick={() => changeTheme(isDark ? "soft-pastel-pink" : "midnight-black")}
      aria-label={isDark ? "Đổi giao diện Locket sang sáng" : "Đổi giao diện Locket sang tối"}
      aria-pressed={isDark}
    >
      {isDark ? <Moon size={15} aria-hidden="true" /> : <Sun size={15} aria-hidden="true" />}
      {isDark ? "Tối" : "Sáng"}
    </button>
  );
}
