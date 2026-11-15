import React, { useState } from "react";
import { Palette, Check, Download } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

const AppIconSelectorPage = () => {
  const [selectedIcon, setSelectedIcon] = useState(() => {
    return localStorage.getItem("selectedAppIcon") || "0";
  });

  // Hook để quản lý install prompt
  const { installApp, canInstall, isIOS, isInstalled } = useInstallPrompt();

  // Generate icon list (0-31)
  const iconList = Array.from({ length: 32 }, (_, i) => ({
    id: String(i),
    name: `Icon ${i}`,
    path: `/icon-app/android-chrome-192x192 (${i}).png`,
  }));

  const handleIconSelect = (iconId) => {
    setSelectedIcon(iconId);
    localStorage.setItem("selectedAppIcon", iconId);

    // Update PWA icons
    const iconPath = `/icon-app/android-chrome-192x192 (${iconId}).png`;
    const timestamp = new Date().getTime();

    let appleTouchIcon = document.querySelector("link[rel='apple-touch-icon']");
    if (!appleTouchIcon) {
      appleTouchIcon = document.createElement("link");
      appleTouchIcon.rel = "apple-touch-icon";
      document.head.appendChild(appleTouchIcon);
    }
    appleTouchIcon.href = `${iconPath}?v=${timestamp}`;

    let faviconIcon = document.querySelector("link[rel='icon'][type='image/png']");
    if (!faviconIcon) {
      faviconIcon = document.createElement("link");
      faviconIcon.rel = "icon";
      faviconIcon.type = "image/png";
      document.head.appendChild(faviconIcon);
    }
    faviconIcon.href = `${iconPath}?v=${timestamp}`;

    console.log(`✅ Icon đã được chọn: ${iconId}`);
  };

  const selectedIconPath = `/icon-app/android-chrome-192x192 (${selectedIcon}).png`;

  return (
    <div className="min-h-screen bg-base-200 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 rounded-2xl shadow-lg overflow-hidden bg-white p-2">
              <img
                src={selectedIconPath}
                alt="Selected icon"
                className="w-full h-full object-cover rounded-xl"
                onError={(e) => {
                  e.target.src = `/icon-app/android-chrome-192x192 (0).png`;
                }}
              />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-base-content mb-3">
            Chọn Biểu Tượng Ứng Dụng
          </h1>
          <p className="text-lg text-base-content/70 max-w-2xl mx-auto">
            Lựa chọn biểu tượng yêu thích của bạn. Khi bạn thêm ứng dụng vào màn hình chính, biểu tượng này sẽ được hiển thị.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          {isInstalled ? (
            <div className="btn btn-success gap-2 pointer-events-none">
              <Check size={20} /> Đã cài đặt ứng dụng
            </div>
          ) : canInstall ? (
            <button
              onClick={installApp}
              className="btn btn-primary gap-2 animate-pulse"
            >
              <Download size={20} /> Thêm vào màn hình chính
            </button>
          ) : isIOS ? (
            <a href="/download" className="btn btn-outline gap-2">
              <Palette size={20} /> Hướng dẫn cho iOS
            </a>
          ) : (
            <a href="/download" className="btn btn-outline gap-2">
              <Palette size={20} /> Hướng dẫn cài đặt
            </a>
          )}
        </div>

        {/* Icon Grid */}
        <div className="bg-base-100 rounded-2xl p-8 shadow-lg">
          <h2 className="text-2xl font-bold mb-8 text-base-content flex items-center gap-3">
            <span className="w-8 h-8 bg-gradient-to-r from-primary to-accent rounded-lg flex items-center justify-center text-white font-bold">
              ★
            </span>
            Chọn Biểu Tượng
          </h2>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {iconList.map((icon) => (
              <button
                key={icon.id}
                onClick={() => handleIconSelect(icon.id)}
                className={`group relative p-2 rounded-xl border-2 transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${
                  selectedIcon === icon.id
                    ? "border-primary shadow-lg scale-105 ring-2 ring-primary ring-offset-2"
                    : "border-base-300 hover:border-base-400"
                }`}
                title={`Chọn icon ${icon.id}`}
              >
                {/* Glow effect khi selected */}
                {selectedIcon === icon.id && (
                  <div className="absolute inset-0 rounded-xl bg-primary/10 animate-pulse pointer-events-none"></div>
                )}

                <img
                  src={icon.path}
                  alt={icon.name}
                  className="w-full h-full object-cover rounded-lg"
                  onError={(e) => {
                    e.target.src = `/icon-app/android-chrome-192x192 (0).png`;
                  }}
                />

                {/* Check mark khi selected */}
                {selectedIcon === icon.id && (
                  <div className="absolute top-1 right-1 bg-primary rounded-full p-1 text-white">
                    <Check size={14} />
                  </div>
                )}

                {/* Hover effect */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-colors"></div>
              </button>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* iOS */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
            <h3 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
              <span className="text-2xl">🍎</span> Hướng dẫn cho iOS
            </h3>
            <ol className="space-y-3 text-blue-800 dark:text-blue-200">
              <li className="flex gap-3">
                <span className="font-bold flex-shrink-0">1.</span>
                <span>Mở trang này trên Safari</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold flex-shrink-0">2.</span>
                <span>Nhấn nút Share (chia sẻ)</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold flex-shrink-0">3.</span>
                <span>Chọn "Add to Home Screen"</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold flex-shrink-0">4.</span>
                <span>Icon được chọn sẽ là biểu tượng ứng dụng</span>
              </li>
            </ol>
          </div>

          {/* Android */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800">
            <h3 className="text-xl font-bold text-green-900 dark:text-green-100 mb-4 flex items-center gap-2">
              <span className="text-2xl">🤖</span> Hướng dẫn cho Android
            </h3>
            <ol className="space-y-3 text-green-800 dark:text-green-200">
              <li className="flex gap-3">
                <span className="font-bold flex-shrink-0">1.</span>
                <span>Mở trang này trên Chrome hoặc Edge</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold flex-shrink-0">2.</span>
                <span>Nhấn menu ⋮ (ba dấu chấm)</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold flex-shrink-0">3.</span>
                <span>Chọn "Install app" hoặc "Add to Home screen"</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold flex-shrink-0">4.</span>
                <span>Icon được chọn sẽ là biểu tượng ứng dụng</span>
              </li>
            </ol>
          </div>
        </div>

        {/* Tips */}
        <div className="mt-8 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
          <h4 className="font-bold text-amber-900 dark:text-amber-100 mb-3 flex items-center gap-2">
            <span>💡</span> Mẹo hữu ích
          </h4>
          <ul className="space-y-2 text-amber-800 dark:text-amber-200 text-sm">
            <li>• Hãy thử nhiều icon để tìm ra cái bạn thích nhất</li>
            <li>• Bạn có thể thay đổi icon bất kỳ lúc nào bằng cách quay lại trang này</li>
            <li>• Icon được lưu vào thiết bị của bạn, không cần đăng nhập</li>
            <li>• Khi cài đặt ứng dụng lần đầu, hãy chọn icon trước để có trải nghiệm tốt nhất</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AppIconSelectorPage;
