import React, { useEffect, useRef, useState } from "react";
import "./styles.css";
import { useApp } from "@/context/AppContext";
import { StarRating } from "../../Widgets/StarRating/StarRating";
import SnowEffect from "@/components/Effects/SnowEffect";
import { allEmojis } from "@/constants/emojis";
import SFSymbolIcon from "@/components/ui/CaptionOverlay/icons/SFSymbolIcon";
import IconRenderer from "@/components/ui/CaptionOverlay/icons/IconRenderer";
import { getWeatherColors } from "@/utils/enviroment";
import useAdaptiveCaptionContrast, {
  getCaptionGlassStyle,
} from "@/components/ui/CaptionOverlay/useAdaptiveCaptionContrast";
import { resolveTimeIcon, stripLeadingIcon } from "@/utils/captionIcon";

// Helper function to sanitize caption - ensure it's always a clean string
const getCleanCaption = (caption) => {
  if (typeof caption === "string") return caption;
  if (caption === null || caption === undefined) return "";
  // Strip prototype chain if it's an object
  try {
    const cleaned = JSON.parse(JSON.stringify(caption));
    const str = String(cleaned || "");
    return str.replace(/^\[object.*\]$/i, "");
  } catch {
    return "";
  }
};

// Sanitize any value to ensure string - prevent [object Object]
const getCleanValue = (value) => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if (typeof value.data === "string") return value.data;
    if (typeof value.url === "string") return value.url;
    if (typeof value.emoji === "string") return value.emoji;
    if (typeof value.value === "string") return value.value;
    return "";
  }
  return String(value).replace(/^\[object.*\]$/i, "");
};

const getOverlayColors = (postOverlay) => {
  const colors = Array.isArray(postOverlay?.background?.colors)
    ? postOverlay.background.colors
    : Array.isArray(postOverlay?.background)
      ? postOverlay.background
      : [];

  return [
    postOverlay?.color_top || colors[0] || "rgba(255,255,255,0.35)",
    postOverlay?.color_bottom || colors[1] || "rgba(255,255,255,0.2)",
  ];
};

const getExplicitOverlayColors = (postOverlay) => {
  const colors = Array.isArray(postOverlay?.background?.colors)
    ? postOverlay.background.colors
    : Array.isArray(postOverlay?.background)
      ? postOverlay.background
      : [];

  return [
    postOverlay?.color_top || colors[0],
    postOverlay?.color_bottom || colors[1],
  ].filter((color) => color && typeof color === "string");
};

const getTransparentOrGradient = (postOverlay) => {
  const colors = getExplicitOverlayColors(postOverlay);
  return colors.length >= 2
    ? `linear-gradient(to bottom, ${colors.join(", ")})`
    : "transparent";
};

const normalizeOverlayType = (type) => {
  if (type === "image_icon" || type === "caption_icon") return "caption_image";
  if (type === "image_gif") return "caption_gif";
  return type;
};

// Custom Hooks
const useTextMeasurement = (text, ref, type, placeholder, parentRef) => {
  // Sanitize text input to ensure it's always a string
  const cleanText = typeof text === "string" ? text : 
    (text === null || text === undefined) ? "" :
    String(text).replace(/^\[object.*\]$/i, "");
  
  const canvasRef = useRef(document.createElement("canvas"));
  const [width, setWidth] = useState(120);
  const [shouldWrap, setShouldWrap] = useState(false);

  const getTextWidth = (text, ref) => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context || !ref.current) return 100;

    const style = getComputedStyle(ref.current);
    context.font = `${style.fontSize} ${style.fontFamily}`;

    const emojiRegex =
      /([\uD800-\uDBFF][\uDC00-\uDFFF])|(\p{Extended_Pictographic})/gu;
    const textOnly = text.replace(emojiRegex, "");
    const emojiMatches = text.match(emojiRegex) || [];

    const baseWidth = context.measureText(textOnly).width;
    const emojiWidth = emojiMatches.length * 24;

    return baseWidth + emojiWidth;
  };

  useEffect(() => {
    if (!ref.current) return;

    const textToMeasure =
      cleanText || (type === "image_icon" ? "" : placeholder);
    const baseWidth = getTextWidth(textToMeasure, ref);
    const padding = 32; // padding left + right
    const iconWidth =
      type === "image_icon" || type === "location" ? 32 : 0; // icon width + gap
    const finalWidth = baseWidth + padding + iconWidth;

    // Get max width from parent or window
    let maxAllowedWidth = window.innerWidth * 0.9;
    if (parentRef?.current) {
      maxAllowedWidth = parentRef.current.clientWidth * 0.9;
    }

    const minWidth =
      type === "image_icon"
        ? 76
        : type === "location"
          ? 96
          : 72;
    const adjustedWidth = Math.max(
      minWidth,
      Math.min(finalWidth, maxAllowedWidth),
    );

    setWidth(adjustedWidth);
    setShouldWrap(finalWidth > maxAllowedWidth);
  }, [cleanText, type, placeholder, parentRef]);

  return { width, shouldWrap };
};

const useAutoResize = (refs) => {
  const adjustHeight = (ref) => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    refs.forEach((ref) => adjustHeight(ref));
  });

  return adjustHeight;
};

const centeredTextareaStyle = (extra = {}) => ({
  textAlign: "center",
  lineHeight: "1.35",
  minHeight: "1.35em",
  background: "transparent",
  ...extra,
});

// Overlay Components
const ImageIconOverlay = ({
  postOverlay,
  setPostOverlay,
  placeholder,
  parentRef,
}) => {
  const cleanIcon = getCleanValue(postOverlay.icon);
  const cleanCaption = getCleanCaption(postOverlay.caption);
  
  const textareaRef = useRef(null);
  const { width, shouldWrap } = useTextMeasurement(
    cleanCaption,
    textareaRef,
    "image_icon",
    placeholder,
    parentRef,
  );

  useAutoResize([textareaRef]);

  return (
    <div
      className="flex items-center justify-center gap-2 bg-white/50 backdrop-blur-2xl py-1.5 px-3 rounded-4xl absolute bottom-2 left-1/2 transform -translate-x-1/2"
      style={{
        width: `${Math.max(width, cleanIcon ? 76 : 72)}px`,
        background: `linear-gradient(to bottom, ${getOverlayColors(postOverlay).join(", ")})`,
      }}
    >
      {cleanIcon && (
        <img
          src={cleanIcon}
          alt="Icon"
          className="w-5 h-5 object-contain rounded-sm flex-shrink-0"
        />
      )}
      <textarea
        ref={textareaRef}
        value={cleanCaption}
        onChange={(e) =>
          setPostOverlay((prev) => ({
            ...prev,
            caption: e.target.value,
          }))
        }
        placeholder={placeholder}
        rows={1}
        className="font-semibold outline-none flex-1 resize-none overflow-hidden transition-all bg-transparent"
        style={centeredTextareaStyle({
          color: postOverlay.text_color,
          whiteSpace: shouldWrap ? "pre-wrap" : "nowrap",
          minWidth: "0",
        })}
      />
    </div>
  );
};

const MusicOverlay = ({ postOverlay, parentRef }) => {
  const spanRef = useRef(null);
  const music = postOverlay?.music || {};
  const cleanCaption = getCleanCaption(postOverlay.caption);
  const { width } = useTextMeasurement(
    cleanCaption,
    spanRef,
    "default",
    "",
    parentRef,
  );

  return (
    <div 
      className="flex items-center gap-2 py-2 px-4 rounded-4xl absolute bottom-2 left-1/2 transform -translate-x-1/2 text-white font-semibold bg-white/50 backdrop-blur-2xl overflow-hidden"
      style={{ 
        width: `${Math.max(width, 180)}px`,
        maxWidth: "85%",
      }}
    >
      <img
        src={music.image}
        alt="Cover"
        className="w-6 h-6 object-cover rounded-sm shrink-0 no-select no-save"
      />

      <div className="relative overflow-hidden whitespace-nowrap flex-1">
        <div
          className="inline-block animate-marquee"
          style={{
            animationDuration:
              cleanCaption.length < 30
                ? "9s"
                : cleanCaption.length < 60
                  ? "15s"
                  : "17s",
          }}
        >
          <span ref={spanRef} className="mr-4">{cleanCaption}</span>
          <span className="mr-4 absolute">{cleanCaption}</span>
        </div>
      </div>
      {/* ✅ Chỉ hiện icon nếu platform là spotify */}
      {music.platform === "spotify" && (
        <div className="flex items-center gap-2 shrink-0 no-select no-save">
          <div className="border-l border-white h-5"></div>
          <img
            src="./icons/spotify_icon.png"
            alt="Spotify Icon"
            className="w-6 h-6 object-contain"
          />
        </div>
      )}
    </div>
  );
};

const WeatherOverlay = ({ postOverlay, parentRef }) => {
  const spanRef = useRef(null);
  const weather =
    postOverlay?.caption && typeof postOverlay.caption === "object"
      ? postOverlay.caption
      : postOverlay?.weather || {};
  const weatherIcon =
    postOverlay?.icon && typeof postOverlay.icon === "object"
      ? postOverlay.icon
      : {
          color: "#FFFFFF",
          data: "cloud.fill",
          type: "sf_symbol",
        };
  const displayText = weather?.temp_c_rounded !== undefined
    ? `${weather.temp_c_rounded}°C`
    : typeof postOverlay?.caption === "string" && postOverlay.caption.trim()
      ? postOverlay.caption
    : "Thời tiết";
  const weatherColors = getWeatherColors(weather);
  
  const { width } = useTextMeasurement(
    displayText,
    spanRef,
    "default",
    "",
    parentRef,
  );

  return (
    <div 
      className="flex items-center justify-center backdrop-blur-2xl gap-1 py-2 px-4 rounded-4xl absolute bottom-2 left-1/2 transform -translate-x-1/2 font-semibold shadow-sm"
      style={{
        width: `${width}px`,
        background: `linear-gradient(to bottom, ${weatherColors.join(", ")})`,
        color: postOverlay?.text_color || "#FFFFFFE6",
      }}
    >
      <SFSymbolIcon
        data={weatherIcon.data}
        color={weatherIcon.color || "#FFFFFF"}
      />
      <span ref={spanRef}>{displayText}</span>
    </div>
  );
};

const LocationOverlay = ({
  postOverlay,
  setPostOverlay,
  placeholder,
  parentRef,
}) => {
  const textareaRef = useRef(null);
  const { width, shouldWrap } = useTextMeasurement(
    postOverlay.caption,
    textareaRef,
    "location",
    placeholder,
    parentRef,
  );

  useAutoResize([textareaRef]);

  return (
    <div
      className="flex items-center bg-white/50 backdrop-blur-2xl gap-1 py-2 px-4 rounded-4xl absolute bottom-2 left-1/2 transform -translate-x-1/2 text-white font-semibold"
      style={{ width: `${width}px` }}
    >
      <img
        src="https://img.icons8.com/?size=100&id=NEiCAz3KRY7l&format=png&color=000000"
        alt=""
        className="w-6 h-6"
      />
      <textarea
        ref={textareaRef}
        value={typeof postOverlay.caption === "string" ? postOverlay.caption : ""}
        onChange={(e) =>
          setPostOverlay((prev) => ({
            ...prev,
            caption: e.target.value,
          }))
        }
        placeholder={placeholder}
        rows={1}
        className="font-semibold outline-none flex-1 resize-none overflow-hidden transition-all"
        style={centeredTextareaStyle({
          whiteSpace: shouldWrap ? "pre-wrap" : "nowrap",
          minWidth: "0",
        })}
      />
    </div>
  );
};

const HeartOverlay = ({ postOverlay, parentRef }) => {
  const spanRef = useRef(null);
  const cleanCaption = getCleanCaption(postOverlay.caption);
  const { width } = useTextMeasurement(
    cleanCaption,
    spanRef,
    "default",
    "",
    parentRef,
  );
  
  return (
    <div 
      className="flex items-center bg-white/50 backdrop-blur-2xl gap-1 py-2 px-4 rounded-4xl absolute bottom-2 left-1/2 transform -translate-x-1/2 text-white font-semibold"
      style={{ width: `${width}px` }}
    >
      <img src="/svg/heart-icon.svg" alt="" className="w-6 h-6" />
      <span ref={spanRef}>{cleanCaption}</span>
    </div>
  );
};

const NativeCounterOverlay = ({
  postOverlay,
  setPostOverlay,
  parentRef,
  placeholder = "0",
}) => {
  const textareaRef = useRef(null);
  const cleanCaption = getCleanCaption(postOverlay.caption);
  const { width, shouldWrap } = useTextMeasurement(
    cleanCaption,
    textareaRef,
    "default",
    placeholder,
    parentRef,
  );

  useAutoResize([textareaRef]);

  const iconData =
    postOverlay?.icon && typeof postOverlay.icon === "object"
      ? postOverlay.icon.data
      : "";
  const iconColor =
    postOverlay?.icon && typeof postOverlay.icon === "object"
      ? postOverlay.icon.color
      : postOverlay.text_color;
  
  return (
    <div
      className="flex items-center gap-1 py-2 px-4 rounded-4xl absolute bottom-2 left-1/2 transform -translate-x-1/2 font-bold text-md"
      style={{
        width: `${Math.max(width, 120)}px`,
        background: `linear-gradient(to bottom, ${getOverlayColors(postOverlay).join(", ")})`,
        color: postOverlay.text_color,
      }}
    >
      <span className="w-5 h-5 mr-0.5 flex items-center justify-center text-lg leading-none">
        <SFSymbolIcon data={iconData} color={iconColor} />
      </span>
      <textarea
        ref={textareaRef}
        value={cleanCaption}
        onChange={(e) =>
          setPostOverlay((prev) => ({
            ...prev,
            caption: e.target.value,
          }))
        }
        placeholder={placeholder}
        rows={1}
        className="font-bold outline-none flex-1 resize-none overflow-hidden transition-all"
        style={centeredTextareaStyle({
          color: postOverlay.text_color,
          whiteSpace: shouldWrap ? "pre-wrap" : "nowrap",
          minWidth: "0",
        })}
        wrap={shouldWrap ? "soft" : "off"}
      />
    </div>
  );
};

const StreakOverlay = (props) => <NativeCounterOverlay {...props} />;

const LocketCountOverlay = (props) => <NativeCounterOverlay {...props} />;

const TimeOverlay = ({
  postOverlay,
  setPostOverlay,
  formattedTime,
  parentRef,
  adaptiveGlassStyle,
}) => {
  const textRef = useRef(null);
  const cleanCaption = getCleanCaption(postOverlay.caption);
  const displayText = cleanCaption || formattedTime;
  const icon = resolveTimeIcon(postOverlay.icon);
  const isEditable = postOverlay.is_editable === true;
  const { width } = useTextMeasurement(
    displayText,
    textRef,
    "image_icon",
    "",
    parentRef,
  );
  
  return (
    <div 
      className="flex items-center justify-center gap-1 py-2 px-4 rounded-4xl absolute bottom-2 left-1/2 transform -translate-x-1/2 text-white font-semibold"
      style={{
        width: `${Math.max(width, 110)}px`,
        ...adaptiveGlassStyle,
      }}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center">
        <IconRenderer icon={icon} />
      </span>
      {isEditable ? (
        <textarea
          ref={textRef}
          value={cleanCaption}
          onChange={(event) =>
            setPostOverlay((previous) => ({
              ...previous,
              caption: event.target.value,
            }))
          }
          placeholder="Nhập tin nhắn..."
          rows={1}
          className="font-semibold outline-none flex-1 resize-none overflow-hidden text-center"
          style={{
            minWidth: 0,
            color: adaptiveGlassStyle.color,
            textShadow: adaptiveGlassStyle.textShadow,
          }}
        />
      ) : (
        <span ref={textRef}>{displayText}</span>
      )}
    </div>
  );
};

const ReviewOverlay = ({ postOverlay, parentRef }) => {
  const spanRef = useRef(null);
  const cleanCaption = getCleanCaption(postOverlay.caption);
  const { width } = useTextMeasurement(
    cleanCaption,
    spanRef,
    "default",
    "",
    parentRef,
  );
  
  return (
    <div 
      className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-white/50 backdrop-blur-2xl rounded-4xl px-6 pt-2 flex flex-col items-center font-semibold max-w-[90vw]"
      style={{ width: `${Math.max(width, 200)}px` }}
    >
      <div className="flex gap-2 mb-1">
        <StarRating rating={postOverlay.icon || 0} />
      </div>

      <div className="relative text-center text-sm leading-tight max-w-full px-4">
        <span
          className="absolute -top-2 left-0 text-xl select-none"
          aria-hidden="true"
        >
          &ldquo;
        </span>

        <span
          className="absolute -top-2 right-0 text-xl select-none"
          aria-hidden="true"
        >
          &rdquo;
        </span>

        <span ref={spanRef} className="inline-block text-lg font-semibold text-white max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
          {cleanCaption}
        </span>
      </div>
    </div>
  );
};

const PollOverlay = ({ postOverlay, setPostOverlay, parentRef }) => {
  const textareaRef = useRef(null);
  const [activeEmojiSide, setActiveEmojiSide] = useState(null);
  const cleanCaption = getCleanCaption(postOverlay.caption);
  const payload = postOverlay.payload || {};
  const leftEmoji = payload.left_emoji || "👍";
  const rightEmoji = payload.right_emoji || "👎";
  const pollEmojis = allEmojis.slice(0, 72);
  const displayText = cleanCaption || "Bạn chọn gì?";
  const { width, shouldWrap } = useTextMeasurement(
    displayText,
    textareaRef,
    "default",
    "Bạn chọn gì?",
    parentRef,
  );

  useAutoResize([textareaRef]);

  const updatePollEmoji = (side, emoji) => {
    setPostOverlay((prev) => ({
      ...prev,
      payload: {
        ...(prev.payload || {}),
        [`${side}_emoji`]: emoji,
      },
    }));
    setActiveEmojiSide(null);
  };

  const renderEmojiButton = (side, emoji) => (
    <button
      type="button"
      aria-label={`Đổi emoji ${side === "left" ? "trái" : "phải"}`}
      className="text-base leading-none shrink-0 rounded-full w-7 h-7 grid place-items-center hover:bg-white/15 active:scale-95 transition pointer-events-auto"
      onClick={(e) => {
        e.stopPropagation();
        setActiveEmojiSide((current) => (current === side ? null : side));
      }}
    >
      {emoji}
    </button>
  );

  return (
    <div
      className="flex flex-col items-center gap-1.5 px-3 pt-2 pb-2.5 rounded-[1.5rem] absolute bottom-2 left-1/2 transform -translate-x-1/2 font-semibold shadow-lg"
      style={{
        width: `${Math.max(width + 96, 230)}px`,
        maxWidth: "82%",
        background: `linear-gradient(to bottom, ${getOverlayColors(postOverlay).join(", ")})`,
        color: postOverlay.text_color || "#FFFFFFF0",
      }}
    >
      {activeEmojiSide && (
        <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 w-64 max-w-[86vw] max-h-52 overflow-y-auto rounded-3xl bg-slate-950/95 p-3 shadow-2xl ring-1 ring-white/15 backdrop-blur-xl z-50">
          <div className="grid grid-cols-8 gap-1">
            {pollEmojis.map((emoji, index) => (
              <button
                key={`${activeEmojiSide}-${emoji}-${index}`}
                type="button"
                className="w-7 h-7 rounded-xl grid place-items-center text-lg hover:bg-white/15 active:scale-95 transition"
                onClick={(e) => {
                  e.stopPropagation();
                  updatePollEmoji(activeEmojiSide, emoji);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={cleanCaption}
        onChange={(e) =>
          setPostOverlay((prev) => ({
            ...prev,
            caption: e.target.value,
            text: e.target.value,
            payload: {
              ...(prev.payload || {}),
              question: e.target.value,
            },
          }))
        }
        placeholder="Bạn chọn gì?"
        rows={1}
        className="font-bold outline-none w-full resize-none overflow-hidden transition-all bg-transparent text-center text-sm"
        style={centeredTextareaStyle({
          color: postOverlay.text_color || "#FFFFFFF0",
          whiteSpace: shouldWrap ? "pre-wrap" : "nowrap",
          minWidth: "0",
          lineHeight: "1.15",
        })}
        wrap={shouldWrap ? "soft" : "off"}
      />

      <div className="grid grid-cols-2 gap-3 w-full">
        <div className="flex items-center justify-center gap-1.5 rounded-[1.25rem] bg-white/15 py-1 px-2 min-w-0">
          {renderEmojiButton("left", leftEmoji)}
          <span className="text-lg font-black leading-none text-white">0</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 rounded-[1.25rem] bg-white/15 py-1 px-2 min-w-0">
          {renderEmojiButton("right", rightEmoji)}
          <span className="text-lg font-black leading-none text-white">0</span>
        </div>
      </div>
    </div>
  );
};

const ColorPaletteOverlay = ({ postOverlay }) => {
  const colors = Array.isArray(postOverlay.payload?.colors)
    ? postOverlay.payload.colors.filter(Boolean)
    : [];
  const displayColors = colors.length ? colors.slice(0, 5) : ["#42444b", "#312921", "#e3c5af", "#2b3437", "#816d5f"];

  return (
    <div
      className="flex items-center justify-center py-2.5 px-4 rounded-4xl absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black/45 backdrop-blur-2xl shadow-sm"
      style={{
        width: "auto",
        maxWidth: "90%",
        color: postOverlay.text_color || "#FFFFFFE6",
      }}
    >
      <div className="flex items-center -space-x-1.5 shrink-0">
        {displayColors.map((color, index) => (
          <span
            key={`${color}-${index}`}
            className="w-6 h-6 rounded-full border-2 border-white/80 shadow-sm"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  );
};

const CustomeOverlay = ({
  postOverlay,
  setPostOverlay,
  placeholder,
  isEditable,
  parentRef,
}) => {
  const textareaRef = useRef(null);
  const cleanIcon = getCleanValue(postOverlay.icon);
  // Tự chữa dữ liệu cũ đã nhiễm: caption bắt đầu bằng chính icon thì khử trước khi hiển thị
  const cleanCaption = stripLeadingIcon(getCleanCaption(postOverlay.caption), cleanIcon);

  // Check if icon is image (starts with / or http) or emoji
  const isImageIcon = cleanIcon && (cleanIcon.startsWith('/') || cleanIcon.startsWith('http'));
  // Icon không còn nằm trong textarea — chỉ dùng chuỗi ghép để đo bề rộng khung
  const combinedText = cleanIcon
    ? `${cleanIcon} ${cleanCaption || ""}`
    : cleanCaption || "";

  const { width, shouldWrap } = useTextMeasurement(
    combinedText,
    textareaRef,
    "default",
    placeholder,
    parentRef,
  );

  // Add extra width for image icon (w-6 + gap + pl-4) = ~40px
  const finalWidth = isImageIcon ? width + 40 : width;

  useAutoResize([textareaRef]);

  const handleChange = (e) => {
    const caption = e.target.value;
    setPostOverlay((prev) => ({ ...prev, caption }));
  };

  return (
    <div
      className="flex items-center absolute z-10 bottom-2 left-1/2 transform backdrop-blur-2xl -translate-x-1/2 bg-white/50 rounded-4xl py-2 text-md outline-none overflow-hidden transition-all"
      style={{
        width: `${finalWidth}px`,
        maxWidth: "90%",
        background: `linear-gradient(to bottom, ${getOverlayColors(postOverlay).join(", ")})`,
      }}
    >
      {isImageIcon ? (
        <img src={cleanIcon} alt="Icon" className="w-6 h-6 object-cover flex-shrink-0 mx-2" />
      ) : cleanIcon ? (
        <span className="flex-shrink-0 ml-3 -mr-1 select-none">{cleanIcon}</span>
      ) : null}
      <textarea
        ref={textareaRef}
        value={cleanCaption}
        onChange={handleChange}
        placeholder={placeholder}
        rows={1}
        className="font-semibold outline-none flex-1 resize-none overflow-hidden transition-all px-3 text-white"
        style={centeredTextareaStyle({
          color: postOverlay.text_color,
          whiteSpace: shouldWrap ? "pre-wrap" : "nowrap",
          minWidth: "0",
        })}
        disabled={!isEditable}
        wrap={shouldWrap ? "soft" : "off"}
      />
    </div>
  );
};

const SpecialOverlay = ({
  postOverlay,
  setPostOverlay,
  placeholder,
  isEditable,
  parentRef,
}) => {
  const textareaRef = useRef(null);
  const cleanIcon = getCleanValue(postOverlay.icon);
  // Tự chữa dữ liệu cũ đã nhiễm: caption bắt đầu bằng chính icon thì khử trước khi hiển thị
  const cleanCaption = stripLeadingIcon(getCleanCaption(postOverlay.caption), cleanIcon);

  // Check if icon is image (starts with / or http) or emoji
  const isImageIcon = cleanIcon && (cleanIcon.startsWith('/') || cleanIcon.startsWith('http'));
  // Icon không còn nằm trong textarea — chỉ dùng chuỗi ghép để đo bề rộng khung
  const combinedText = cleanIcon
    ? `${cleanIcon} ${cleanCaption || ""}`
    : cleanCaption || "";

  const { width, shouldWrap } = useTextMeasurement(
    combinedText,
    textareaRef,
    "default",
    placeholder,
    parentRef,
  );

  // Add extra width for image icon (w-6 + gap + px) = ~50px with snow effect
  const finalWidth = isImageIcon ? width + 50 : width;

  useAutoResize([textareaRef]);

  const handleChange = (e) => {
    const caption = e.target.value;
    setPostOverlay((prev) => ({ ...prev, caption }));
  };

  return (
    <div
      className="relative overflow-hidden rounded-4xl bottom-2 flex justify-center left-1/2 transform -translate-x-1/2 opacity-100 z-10"
      style={{
        color: postOverlay.text_color,
        width: `${finalWidth}px`,
      }}
    >
      {/* Flexbox container for icon + textarea — nền pill nằm ở đây để icon và text chung một khối */}
      <div
        className="flex items-center w-full rounded-4xl backdrop-blur-2xl bg-white/50 py-2 duration-300 transition-all"
        style={{
          background: `linear-gradient(to bottom, ${getOverlayColors(postOverlay).join(", ")})`,
        }}
      >
        {isImageIcon ? (
          <img src={cleanIcon} alt="Icon" className="w-6 h-6 object-cover flex-shrink-0 mx-2" />
        ) : cleanIcon ? (
          <span className="flex-shrink-0 ml-3 -mr-1 select-none">{cleanIcon}</span>
        ) : null}
        <textarea
          ref={textareaRef}
          value={cleanCaption}
          onChange={handleChange}
          placeholder={placeholder}
          rows={1}
          className="px-4 font-semibold text-md outline-none resize-none overflow-hidden flex-1"
          style={centeredTextareaStyle({
            whiteSpace: shouldWrap ? "pre-wrap" : "nowrap",
            minWidth: "0",
          })}
          disabled={!isEditable}
          wrap={shouldWrap ? "soft" : "off"}
        />
      </div>

      {/* Hiệu ứng tuyết phủ trên caption */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <SnowEffect snowflakeCount={50} />
      </div>
    </div>
  );
};

const DefaultOverlay = ({
  postOverlay,
  setPostOverlay,
  placeholder,
  isEditable,
  parentRef,
  adaptiveGlassStyle,
}) => {
  const textareaRef = useRef(null);
  const cleanIcon = getCleanValue(postOverlay.icon);
  // Tự chữa dữ liệu cũ đã nhiễm: caption bắt đầu bằng chính icon thì khử trước khi hiển thị
  const cleanCaption = stripLeadingIcon(getCleanCaption(postOverlay.caption), cleanIcon);

  // Check if icon is image (starts with / or http) or emoji
  const isImageIcon = cleanIcon && (cleanIcon.startsWith('/') || cleanIcon.startsWith('http'));
  // Icon không còn nằm trong textarea — chỉ dùng chuỗi ghép để đo bề rộng khung
  const combinedText = cleanIcon
    ? `${cleanIcon} ${cleanCaption || ""}`
    : cleanCaption || "";

  const { width, shouldWrap } = useTextMeasurement(
    combinedText,
    textareaRef,
    "default",
    placeholder,
    parentRef,
  );

  // Add extra width for image icon (w-6 + gap + px) = ~40px
  const finalWidth = isImageIcon ? width + 40 : width;

  useAutoResize([textareaRef]);

  const handleChange = (e) => {
    const caption = e.target.value;
    setPostOverlay((prev) => ({ ...prev, caption }));
  };

  return (
    <div
      className="flex items-center absolute z-10 bottom-2 left-1/2 transform backdrop-blur-2xl -translate-x-1/2 rounded-4xl py-2 text-md outline-none overflow-hidden transition-all text-white font-semibold"
      style={{
        width: `${finalWidth}px`,
        maxWidth: "90%",
        ...adaptiveGlassStyle,
      }}
    >
      {isImageIcon ? (
        <img src={cleanIcon} alt="Icon" className="w-6 h-6 object-cover flex-shrink-0 mx-2" />
      ) : cleanIcon ? (
        <span className="flex-shrink-0 ml-3 -mr-1 select-none">{cleanIcon}</span>
      ) : null}
      <textarea
        ref={textareaRef}
        value={cleanCaption}
        onChange={handleChange}
        placeholder={placeholder}
        rows={1}
        className="font-semibold outline-none flex-1 resize-none overflow-hidden transition-all px-3 text-white"
        style={centeredTextareaStyle({
          whiteSpace: shouldWrap ? "pre-wrap" : "nowrap",
          minWidth: "0",
          color: adaptiveGlassStyle.color,
          textShadow: adaptiveGlassStyle.textShadow,
        })}
        disabled={!isEditable}
        wrap={shouldWrap ? "soft" : "off"}
      />
    </div>
  );
};

// Main Component
const AutoResizeCaption = () => {
  const parentRef = useRef(null);
  const { post } = useApp();
  const { postOverlay, setPostOverlay, preview } = post;
  const backgroundColors = getExplicitOverlayColors(postOverlay);
  const hasBackground = backgroundColors.length >= 2;
  const adaptiveContrast = useAdaptiveCaptionContrast(
    preview?.type === "image" ? preview.data : "",
    !hasBackground,
  );
  const adaptiveGlassStyle = hasBackground
    ? {
        background: getTransparentOrGradient(postOverlay),
        color: postOverlay.text_color || "#FFFFFF",
      }
    : getCaptionGlassStyle(adaptiveContrast);
  const placeholder = "Nhập tin nhắn...";
  // Decorative / custome / template captions ship with just an emoji icon and an
  // empty caption — users are meant to type their own text next to the icon.
  const isEditable = true;

  // Get formatted time (assuming it exists in the original context)
  const formattedTime = new Date().toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const renderOverlay = () => {
    const commonProps = {
      postOverlay,
      setPostOverlay,
      placeholder,
      parentRef,
      adaptiveGlassStyle,
    };

    switch (normalizeOverlayType(postOverlay.type)) {
      case "image_icon":
      case "image_gif":
      case "caption_image":
      case "caption_gif":
      case "star_sign":
        return <ImageIconOverlay {...commonProps} />;

      case "music":
        return <MusicOverlay postOverlay={postOverlay} parentRef={parentRef} />;

      case "weather":
        return <WeatherOverlay postOverlay={postOverlay} parentRef={parentRef} />;

      case "location":
        return <LocationOverlay {...commonProps} />;

      case "heart":
        return <HeartOverlay postOverlay={postOverlay} parentRef={parentRef} />;
      case "streak":
        return (
          <StreakOverlay
            postOverlay={postOverlay}
            setPostOverlay={setPostOverlay}
            parentRef={parentRef}
          />
        );

      case "locket_count":
        return (
          <LocketCountOverlay
            postOverlay={postOverlay}
            setPostOverlay={setPostOverlay}
            parentRef={parentRef}
          />
        );

      case "time":
        return (
          <TimeOverlay
            postOverlay={postOverlay}
            setPostOverlay={setPostOverlay}
            formattedTime={formattedTime}
            parentRef={parentRef}
            adaptiveGlassStyle={adaptiveGlassStyle}
          />
        );

      case "review":
        return <ReviewOverlay postOverlay={postOverlay} parentRef={parentRef} />;

      case "poll":
        return (
          <PollOverlay
            postOverlay={postOverlay}
            setPostOverlay={setPostOverlay}
            parentRef={parentRef}
          />
        );

      case "color_palette":
        return (
          <ColorPaletteOverlay
            postOverlay={postOverlay}
            setPostOverlay={setPostOverlay}
            parentRef={parentRef}
          />
        );

      case "special":
        return <SpecialOverlay {...commonProps} isEditable={isEditable} />;

      case "default":
        return <DefaultOverlay {...commonProps} isEditable={isEditable} />;

      default:
        return <CustomeOverlay {...commonProps} isEditable={isEditable} />;
    }
  };

  return (
    <div ref={parentRef} className="relative w-full">
      {renderOverlay()}
    </div>
  );
};

export default AutoResizeCaption;
