import React, { useState, useEffect } from "react";
import { ChevronRight, Palette } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppIcon } from "@/hooks/useAppIcon";

const AppIconMenu = ({ onClose }) => {
  // Initialize hook để update PWA icons
  useAppIcon();

  const [selectedIcon, setSelectedIcon] = useState(() => {
    return localStorage.getItem("selectedAppIcon") || "0";
  });

  // Danh sách các icon app (tương ứng với file icon-app)
  const selectedIconPath = `/icon-app/android-chrome-192x192 (${selectedIcon}).png`;

  return (
    <li className="px-2 py-3 mb-2">
      <Link
        to="/choose-icon"
        onClick={onClose}
        className="flex items-center gap-3 px-3 py-3 rounded-lg transition hover:bg-base-200 bg-base-100 border border-base-300 shadow-sm"
      >
        <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-white p-1">
          <img
            src={selectedIconPath}
            alt="App icon"
            className="w-full h-full object-cover rounded"
            onError={(e) => {
              e.target.src = `/icon-app/android-chrome-192x192 (0).png`;
            }}
          />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-base-content">Icon Ứng Dụng</div>
          <div className="text-xs text-base-content/60">Chọn icon yêu thích</div>
        </div>
        <ChevronRight size={20} className="text-base-content/50" />
      </Link>
    </li>
  );
};

export default AppIconMenu;
