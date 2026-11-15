import React, { useCallback, useEffect, useState } from "react";
import { PiClockFill } from "react-icons/pi";
import { useApp } from "@/context/AppContext";
import {
  getWeatherColors,
  getWeatherSymbol,
  getWeatherTemperatureF,
  isWeatherDaylight,
  useLocationOptions,
  useLocationWeather,
} from "@/utils/enviroment";
import { getInfoMusicByUrl } from "@/services";
import { buildMusicOverlay } from "@/services/ExtensionsServices/musicOverlay";
import { SonnerError, SonnerSuccess } from "@/components/ui/SonnerToast";
import FormMusicPoup from "@/features/PoupScreen/FormMusicPoup";
import FormReviewPoup from "@/features/PoupScreen/FormReviewPoup";
import { useStreakStore } from "@/stores";

const DEFAULT_COLOR_PALETTE = ["#42444b", "#312921", "#e3c5af", "#2b3437", "#816d5f"];
const NATIVE_CAPTION_COLORS = ["#FFD25F", "#EAA900"];
const NATIVE_CAPTION_TEXT_COLOR = "#00000099";
const STREAK_ICON = {
  color: NATIVE_CAPTION_TEXT_COLOR,
  data: "flame.fill",
  type: "sf_symbol",
};
const LOCKET_COUNT_ICON = {
  color: NATIVE_CAPTION_TEXT_COLOR,
  data: "suit.heart.fill",
  type: "sf_symbol",
};

const componentToHex = (value) =>
  Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0");

const rgbToHex = (r, g, b) =>
  `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;

const colorDistance = (a, b) => {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  return Math.hypot(ar - br, ag - bg, ab - bb);
};

const quantizeColor = (value) => Math.round(value / 24) * 24;

const extractPaletteFromDrawable = (drawable) => {
  const canvas = document.createElement("canvas");
  const size = 72;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return DEFAULT_COLOR_PALETTE;

  ctx.drawImage(drawable, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const buckets = new Map();

  for (let index = 0; index < data.length; index += 16) {
    const alpha = data[index + 3];
    if (alpha < 160) continue;

    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const brightness = (r + g + b) / 3;
    if (brightness < 18 || brightness > 242) continue;

    const hex = rgbToHex(quantizeColor(r), quantizeColor(g), quantizeColor(b));
    buckets.set(hex, (buckets.get(hex) || 0) + 1);
  }

  const sorted = [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex);
  const palette = [];

  for (const color of sorted) {
    if (palette.every((picked) => colorDistance(picked, color) > 42)) {
      palette.push(color);
    }
    if (palette.length >= 5) break;
  }

  return [...palette, ...DEFAULT_COLOR_PALETTE].slice(0, 5);
};

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

export default function GeneralThemes({ title }) {
  const { navigation, post, camera } = useApp();
  const { setIsFilterOpen } = navigation;
  const { postOverlay, setPostOverlay, preview, selectedFile } = post;
  const { addressOptions } = useLocationOptions();
  const { weather } = useLocationWeather();

  const streak = useStreakStore((s) => s.streak);
  const remoteLocketCount = useStreakStore((s) => s.locketCount);
  const fetchLocketCount = useStreakStore((s) => s.fetchLocketCount);
  const locketCount = remoteLocketCount ?? 0;

  const [time, setTime] = useState(() => new Date());
  const [savedAddressOptions, setSavedAddressOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLocketCount();
  }, [fetchLocketCount]);

  // --- Popup States ---
  const [popupActive, setPopupActive] = useState(false); // hiệu ứng hiển thị
  const [formType, setFormType] = useState(""); // "spotify" | "apple"

  const buildWeatherOverlay = useCallback((weatherData) => {
    const hasTemp = weatherData?.temp_c_rounded !== undefined;
    const [colorTop, colorBottom] = getWeatherColors(weatherData);

    return {
      preset_id: "weather",
      caption: hasTemp ? weatherData : "Thời tiết",
      type: "weather",
      icon: {
        color: "#FFFFFF",
        data: getWeatherSymbol(weatherData),
        type: "sf_symbol",
      },
      color_top: colorTop,
      color_bottom: colorBottom,
      text_color: "#FFFFFFE6",
      background: {
        colors: [colorTop, colorBottom],
      },
      max_lines: 1,
      payload: {
        temperature: getWeatherTemperatureF(weatherData),
        cloud_cover: Number.isFinite(Number(weatherData?.cloud_cover))
          ? Number(weatherData.cloud_cover) / 100
          : undefined,
        is_daylight: isWeatherDaylight(weatherData),
        wk_condition: weatherData?.wk_condition,
        symbol_name: getWeatherSymbol(weatherData),
      },
    };
  }, []);

  useEffect(() => {
    const hasChanged =
      addressOptions.length !== savedAddressOptions.length ||
      addressOptions.some((value, index) => value !== savedAddressOptions[index]);

    if (addressOptions.length > 0 && hasChanged) {
      setSavedAddressOptions(addressOptions);
    }
  }, [addressOptions, savedAddressOptions]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (postOverlay?.type !== "weather") return;
    if (weather?.temp_c_rounded === undefined) return;

    setPostOverlay((prev) => ({
      ...prev,
      ...buildWeatherOverlay(weather),
      overlay_id: "weather",
    }));
  }, [buildWeatherOverlay, weather, postOverlay?.type, setPostOverlay]);

  const formattedTime = time.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  // === Overlay Apply ===
  const handleCustomeSelect = (data) => {
    const cleanCaption = typeof data.caption === "string"
      ? data.caption
      : data.caption ?? "";
    
    setPostOverlay({
      overlay_id: data.overlay_id || data.preset_id || "standard",
      color_top: data.color_top || "",
      color_bottom: data.color_bottom || "",
      text_color: data.text_color || "#FFFFFF",
      icon: data.icon || "",
      caption: cleanCaption,
      text: typeof data.text === "string" ? data.text : cleanCaption,
      type: data.type || "default",
      background: data.background,
      max_lines: data.max_lines,
      payload: data.payload,
      is_selected: data.is_selected === true,
      ...(data.platform && { platform: data.platform }),
      ...(data.music && { music: data.music }),
    });
    setIsFilterOpen(false);
  };

  // === MUSIC FORM ===
  const openMusicForm = (type) => {
    setFormType(type);
    requestAnimationFrame(() => setPopupActive(true));
  };

  const closeMusicForm = () => {
    setPopupActive(false);
    setTimeout(() => {
      setFormType("");
    }, 300);
  };

  const handleMusicSubmit = async (link) => {
    setLoading(true);
    try {
      const music = await getInfoMusicByUrl(
        link,
        formType === "apple" ? "apple" : "spotify",
      );

      handleCustomeSelect(buildMusicOverlay(music));

      const musicType = formType === "apple" ? "Apple Music" : "Spotify";
      SonnerSuccess(`${musicType} by T97`, "Lấy nhạc thành công");

      closeMusicForm();
    } catch (error) {
      SonnerError("Không thể lấy thông tin bài hát", error.message);
    } finally {
      setLoading(false);
    }
  };

  const [reviewOpen, setReviewOpen] = useState(false);

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

  const getCurrentColorPalette = async () => {
    try {
      if (preview?.type === "image" && preview.data) {
        return extractPaletteFromDrawable(await loadImage(preview.data));
      }

      if (selectedFile?.type?.startsWith("image/")) {
        const objectUrl = URL.createObjectURL(selectedFile);
        try {
          return extractPaletteFromDrawable(await loadImage(objectUrl));
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      }

      const video = camera?.videoRef?.current;
      if (video?.readyState >= 2 && video.videoWidth && video.videoHeight) {
        return extractPaletteFromDrawable(video);
      }
    } catch (error) {
      console.warn("Không thể phân tích màu caption:", error);
    }

    return DEFAULT_COLOR_PALETTE;
  };

  // === MAIN BUTTON ACTIONS ===
  const handleClick = async (id) => {
    switch (id) {
      case "default":
        handleCustomeSelect({
          preset_id: "standard",
          caption: "",
          type: "default",
          text_color: "#FFFFFF",
          background: { colors: [] },
          is_selected: true,
        });
        break;
      case "music":
        openMusicForm("spotify");
        break;
      case "music_apple":
        openMusicForm("apple");
        break;
      case "review":
        openReviewForm();
        break;
      case "time":
        handleCustomeSelect({
          preset_id: "time",
          caption: formattedTime,
          type: "time",
          icon: {
            color: "#FFFFFF",
            data: "clock.fill",
            type: "sf_symbol",
          },
        });
        break;
      case "weather":
        handleCustomeSelect(buildWeatherOverlay(weather));
        break;
      case "heart":
        handleCustomeSelect({
          preset_id: "heart",
          caption: "inlove",
          type: "heart",
        });
        break;
      case "streak":
        handleCustomeSelect({
          preset_id: "streak",
          overlay_id: "streak",
          caption: streak?.count || "0",
          text: String(streak?.count || "0"),
          type: "streak",
          icon: STREAK_ICON,
          color_top: NATIVE_CAPTION_COLORS[0],
          color_bottom: NATIVE_CAPTION_COLORS[1],
          text_color: NATIVE_CAPTION_TEXT_COLOR,
          background: {
            colors: NATIVE_CAPTION_COLORS,
          },
          payload: {},
        });
        break;
      case "locket_count":
        handleCustomeSelect({
          preset_id: "locket_count",
          overlay_id: "locket_count",
          caption: locketCount,
          text: String(locketCount),
          type: "locket_count",
          icon: LOCKET_COUNT_ICON,
          color_top: NATIVE_CAPTION_COLORS[0],
          color_bottom: NATIVE_CAPTION_COLORS[1],
          text_color: NATIVE_CAPTION_TEXT_COLOR,
          background: {
            colors: NATIVE_CAPTION_COLORS,
          },
          payload: {},
        });
        break;
      case "poll":
        handleCustomeSelect({
          preset_id: "poll",
          overlay_id: "caption:poll",
          caption: "Bạn chọn gì?",
          type: "poll",
          text_color: "#FFFFFFF0",
          background: {
            colors: ["#685AF7", "#685AF7"],
          },
          max_lines: 2,
          payload: {
            left_emoji: "👍",
            right_emoji: "👎",
            question: "Bạn chọn gì?",
          },
        });
        break;
      case "color_palette":
      {
        const colors = await getCurrentColorPalette();
        handleCustomeSelect({
          preset_id: "color_palette",
          overlay_id: "color_palette",
          caption: colors[0],
          type: "color_palette",
          icon: {
            source: "local",
            data: "color_palette_icon",
            type: "image",
          },
          text_color: "#FFFFFFE6",
          background: {
            material_blur: "ultra_thin",
            colors: [],
          },
          max_lines: 1,
          payload: {
            colors,
          },
        });
        break;
      }
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
      id: "locket_count",
      icon: (
        <img
          src="/icons/suit_heart_fill.png"
          alt=""
          className="w-5 h-5 mr-0.5"
        />
      ),
      label: "Số khoảnh khắc",
      background: NATIVE_CAPTION_COLORS,
      color: NATIVE_CAPTION_TEXT_COLOR,
    },
    {
      id: "color_palette",
      icon: (
        <img
          src="/icons/color_palette_icon.png"
          alt=""
          className="w-6 h-6 mr-1"
        />
      ),
      label: "Màu sắc",
    },
    {
      id: "music",
      icon: (
        <img src="/icons/music_icon.png" alt="" className="w-6 h-6 mr-1" />
      ),
      label: "Spotify",
    },
    {
      id: "music_apple",
      icon: (
        <img src="/svg/lcd-empty-logo.svg" alt="" className="w-5 h-5 mr-1" />
      ),
      label: "Apple Music",
    },
    {
      id: "weather",
      icon: (
        <img
          src="/icons/sun_max_fill.svg"
          alt=""
          className="w-6 h-6 mr-1 object-contain"
        />
      ),
      label: "Thời tiết",
      background: ["#4FACFE", "#00F2FE"],
      color: "#FFFFFF",
      cover: "/images/cloud_cover.png",
    },
    {
      id: "review",
      icon: (
        <img src="/icons/star_icon.png" alt="" className="w-5 h-5 mr-1" />
      ),
      label: "Review",
    },
    {
      id: "time",
      icon: <PiClockFill className="w-6 h-6 mr-1 rotate-270" />,
      label: formattedTime,
    },
    {
      id: "streak",
      icon: (
        <img
          src="/icons/flame_fill.png"
          alt=""
          className="w-5 h-5 mr-0.5"
        />
      ),
      label: streak?.count || "0",
      background: NATIVE_CAPTION_COLORS,
      color: NATIVE_CAPTION_TEXT_COLOR,
    },
    {
      id: "poll",
      icon: (
        <img src="/icons/poll_icon.png" alt="" className="w-5 h-5 mr-0.5" />
      ),
      label: "Bình chọn",
      background: ["#685AF7", "#685AF7"],
      color: "#FFFFFF",
    },
    {
      id: "location",
      icon: (
        <img
          src="/icons/location_icon.png"
          alt=""
          className="w-6 h-6 mr-0.5 invert dark:invert-0"
        />
      ),
      label: "Vị trí",
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
        <div className="flex flex-wrap gap-3 pt-2 pb-5 justify-start">
          {buttons.map((btn) => (
            <button
              key={btn.id}
              onClick={() => handleClick(btn.id)}
              style={getButtonStyle(btn)}
              className={`relative flex flex-col whitespace-nowrap
    backdrop-blur-3xl items-center space-y-1 py-2 px-4 btn h-auto w-auto
    rounded-3xl font-semibold justify-center
    ${!btn.background ? "bg-black/5 dark:bg-white/30" : ""}
    `}
            >
              {btn.cover && (
                <img
                  src={btn.cover}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover rounded-3xl opacity-50 pointer-events-none select-none"
                />
              )}
              <span className="relative z-10 text-base flex flex-row items-center gap-1 font-bold">
                {btn.icon}
                {btn.id === "location" ? (
                  <div className="relative w-max">
                    <div className="cursor-pointer select-none">
                      {btn.label}
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
      {/* === POPUP MUSIC FORM === */}
      <FormMusicPoup
        open={popupActive}
        onClose={closeMusicForm}
        onConfirm={handleMusicSubmit}
        loading={loading}
        formType={formType}
        icon={
          formType === "apple" ? (
            <img src="/svg/lcd-empty-logo.svg" className="w-8 h-8" />
          ) : (
            <img src="./icons/spotify_icon.png" className="w-8 h-8" />
          )
        }
        title={`Nhập link ${formType === "apple" ? "Apple Music" : "Spotify"}`}
      />

      {/* === POPUP REVIEW FORM === */}
      <FormReviewPoup
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onConfirm={handleReviewSubmit}
        title={"Caption Review"}
      />
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
