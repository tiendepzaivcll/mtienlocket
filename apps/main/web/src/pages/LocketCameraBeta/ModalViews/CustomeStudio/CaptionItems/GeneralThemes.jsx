import React, { useEffect, useState } from "react";
import { PiClockFill } from "react-icons/pi";
import { useApp } from "@/context/AppContext";
import { useBatteryStatus } from "@/utils";
import { useLocationOptions, useLocationWeather } from "@/utils/enviroment";
import FormReviewPoup from "@/features/PoupScreen/FormReviewPoup";
import { useStreakStore } from "@/stores";

export default function GeneralThemes({ title }) {
  const { navigation, post } = useApp();
  const { setIsFilterOpen } = navigation;
  const { setPostOverlay } = post;
  const { addressOptions } = useLocationOptions();
  const { weather } = useLocationWeather();
  const { level, charging } = useBatteryStatus();

  const streak = useStreakStore((s) => s.streak);

  const [time, setTime] = useState(() => new Date());
  const [savedAddressOptions, setSavedAddressOptions] = useState([]);

  useEffect(() => {
    if (
      addressOptions.length > 0 &&
      JSON.stringify(addressOptions) !== JSON.stringify(savedAddressOptions)
    ) {
      setSavedAddressOptions(addressOptions);
    }
  }, [addressOptions, savedAddressOptions]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = time.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  // === Overlay Apply ===
  const handleCustomeSelect = (data) => {
    const cleanCaption = typeof data.caption === "string" ? data.caption : "";

    setPostOverlay({
      overlay_id: data.preset_id || data.overlay_id || "standard",
      color_top: data.color_top || "",
      color_bottom: data.color_bottom || "",
      text_color: data.text_color || "#FFFFFF",
      icon: data.icon || "",
      caption: cleanCaption,
      type: data.type || "default",
      ...(data.music && { music: data.music }),
      ...(data.weather && { weather: data.weather }),
    });
    setIsFilterOpen(false);
  };

  const [reviewOpen, setReviewOpen] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);
  const [customStreak, setCustomStreak] = useState(streak?.count || "0");

  // Update customStreak when streak store changes
  useEffect(() => {
    if (streak?.count) {
      setCustomStreak(streak.count.toString());
    }
  }, [streak?.count]);

  // === REVIEW FORM ===
  const openReviewForm = () => {
    setReviewOpen(true);
  };

  const closeReviewForm = () => {
    setReviewOpen(false);
  };

  const handleReviewSubmit = ({ rating, text }) => {
    handleCustomeSelect({
      preset_id: "review",
      icon: rating,
      caption: text,
      type: "review",
    });

    closeReviewForm();
  };

  // === MAIN BUTTON ACTIONS ===
  const handleClick = (id) => {
    switch (id) {
      case "default":
        handleCustomeSelect({ type: "default" });
        break;
      case "review":
        openReviewForm();
        break;
      case "time":
        handleCustomeSelect({
          preset_id: "time",
          caption: formattedTime,
          type: "time",
        });
        break;
      case "weather":
        handleCustomeSelect({
          preset_id: "weather",
          caption: weather?.temp_c_rounded !== undefined ? `${weather.temp_c_rounded + 1}°C` : "Thời tiết",
          icon: weather?.icon ? `https:${weather.icon}` : "./icons/sun_max_indicator.png",
          type: "weather",
          // Store full weather data for preview
          weather: weather || {},
        });
        break;
      case "battery":
        handleCustomeSelect({
          preset_id: "battery",
          caption: level || "50",
          icon: charging,
          type: "battery",
        });
        break;
      case "heart":
        handleCustomeSelect({
          preset_id: "heart",
          caption: "inlove",
          type: "heart",
        });
      case "streak":
        setStreakOpen(true);
        break;
      default:
        break;
    }
  };

  const buttons = [
    {
      id: "default",
      icon: <span className="mr-1 font-semibold">Aa</span>,
      label: "Văn bản",
    },
    {
      id: "review",
      icon: <img src="./icons/star_icon.png" className="w-5 h-5 mr-1" />,
      label: "Review",
    },
    {
      id: "time",
      icon: <PiClockFill className="w-6 h-6 mr-1 rotate-270" />,
      label: formattedTime,
    },
    {
      id: "weather",
      icon: (
        <img
          src={
            weather?.icon
              ? `https:${weather.icon}`
              : "./icons/sun_max_indicator.png"
          }
          alt="Weather"
          className="w-6 h-6 mr-1"
        />
      ),
      label:
        weather?.temp_c_rounded !== undefined
          ? `${weather.temp_c_rounded + 1}°C`
          : "Thời tiết",
    },
    {
      id: "battery",
      icon: (
        <img
          src="https://img.icons8.com/?size=100&id=WDlpopZDVw4P&format=png&color=000000"
          className="w-6 h-6 mr-1"
        />
      ),
      label: `${level || "50"}%`,
    },
    {
      id: "streak",
      icon: <img src="https://i.ibb.co/nsCkGCxR/flame-fill.png" className="w-5 h-5 mr-0.5" />,
      label: streak?.count || "0",
      background: ["#FFD25F", "#EAA900"],
      color: "#00000099",
    },
    {
      id: "location",
      icon: (
        <img
          src="https://img.icons8.com/?size=100&id=NEiCAz3KRY7l&format=png&color=000000"
          className="w-6 h-6 mr-1"
        />
      ),
      label: savedAddressOptions[0] || "Vị trí",
    },
  ];

  return (
    <>
      <div className="px-4">
        {title && (
          <div className="flex flex-row gap-3 items-center mb-2">
            <h2 className="text-md font-semibold text-primary">{title}</h2>
            <div className="badge badge-sm badge-secondary">New</div>
          </div>
        )}

        {/* --- BUTTON GRID --- */}
        <div className="flex flex-wrap gap-4 pt-2 pb-5 justify-start">
          {buttons.map((btn) => (
            <button
              key={btn.id}
              onClick={() => handleClick(btn.id)}
              style={getButtonStyle(btn)}
              className={`flex flex-col whitespace-nowrap
    backdrop-blur-3xl items-center space-y-1 py-2 px-4 btn h-auto w-auto
    rounded-3xl font-semibold justify-center
    ${!btn.background ? "bg-base-200 dark:bg-white/30" : ""}
    `}
            >
              <span className="text-base flex flex-row items-center gap-1">
                {btn.icon}
                {btn.id === "location" ? (
                  <div className="relative w-max">
                    <div className="cursor-pointer select-none">
                      {savedAddressOptions[0] || "Vị trí"}
                    </div>
                    <select
                      className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={(e) =>
                        handleCustomeSelect({
                          preset_id: "location",
                          caption: e.target.value,
                          type: "location",
                        })
                      }
                    >
                      <option value="" disabled>
                        Chọn địa chỉ...
                      </option>
                      {savedAddressOptions.map((opt, idx) => (
                        <option key={idx} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  btn.label
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* === POPUP REVIEW FORM === */}
      <FormReviewPoup
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onConfirm={handleReviewSubmit}
        title={"Caption Review"}
      />

      {/* === POPUP STREAK FORM === */}
      {streakOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-base-100 rounded-2xl p-6 w-80 shadow-xl">
            <div className="flex items-center justify-center gap-2 mb-4">
              <img src="https://i.ibb.co/nsCkGCxR/flame-fill.png" className="w-8 h-8" />
              <h3 className="text-lg font-bold">Nhập số Streak</h3>
            </div>
            <input
              type="number"
              value={customStreak}
              onChange={(e) => setCustomStreak(e.target.value)}
              className="input input-bordered w-full text-center text-2xl font-bold mb-4"
              placeholder="0"
              min="0"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setStreakOpen(false)}
                className="btn btn-ghost flex-1"
              >
                Huỷ
              </button>
              <button
                onClick={() => {
                  handleCustomeSelect({
                    preset_id: "streak",
                    caption: customStreak || "0",
                    type: "streak",
                    icon: "https://i.ibb.co/nsCkGCxR/flame-fill.png",
                    color_top: "#FFD25F",
                    color_bottom: "#EAA900",
                    text_color: "#00000099",
                  });
                  setStreakOpen(false);
                }}
                className="btn btn-primary flex-1"
                style={{ background: "linear-gradient(to bottom, #FFD25F, #EAA900)", border: "none", color: "#00000099" }}
              >
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const getButtonStyle = (btn) => {
  if (!btn.background) return {};

  if (Array.isArray(btn.background)) {
    return {
      background: `linear-gradient(to bottom, ${btn.background[0]}, ${btn.background[1]})`,
      color: btn.color || "#fff",
    };
  }

  if (btn.background.startsWith("url")) {
    return {
      backgroundImage: btn.background,
      backgroundSize: "cover",
      backgroundPosition: "center",
      color: btn.color || "#fff",
    };
  }

  return {
    background: btn.background,
    color: btn.color || "#fff",
  };
};
