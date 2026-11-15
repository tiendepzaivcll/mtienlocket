import React, { useEffect, useMemo, useRef, useState } from "react";
import { SendReactMoment } from "@/services";
import { SonnerError, SonnerSuccess } from "@/components/ui/SonnerToast";
import { useAuthStore } from "@/stores";
import { getWeatherSymbol } from "@/utils/enviroment";
import IconRenderer from "../icons/IconRenderer";
import { stripLeadingIcon } from "@/utils/captionIcon";
import useAdaptiveCaptionContrast, {
  getCaptionGlassStyle,
} from "../useAdaptiveCaptionContrast";

const getCaptionType = (overlay = {}) => {
  if (overlay.captionType) return overlay.captionType;
  if (overlay.id === "caption:poll") return "poll";
  if (overlay.id === "caption:color_palette") return "color_palette";
  if (overlay.id === "caption:weather" || overlay.id === "weather") {
    return "weather";
  }
  if (overlay.id === "caption:location" || overlay.id === "location") {
    return "location";
  }
  return null;
};

const isWeatherText = (text) => /^-?\d+(?:[.,]\d+)?\s*°[CF]$/i.test(
  String(text || "").trim(),
);

const getWeatherIcon = (overlay = {}) => {
  const payload =
    overlay.payload && typeof overlay.payload === "object"
      ? overlay.payload
      : {};
  const weather = {
    ...payload,
    is_day:
      payload.is_day !== undefined ? payload.is_day : payload.is_daylight,
    symbol_name: payload.symbol_name || overlay.icon?.data,
  };

  return {
    color: overlay.icon?.color || "#FFFFFF",
    data: getWeatherSymbol(weather) || "cloud.fill",
    type: "sf_symbol",
  };
};

const getPollCount = (payload = {}, side) => {
  const keys =
    side === "left"
      ? ["left_count", "leftCount", "left_votes", "leftVotes", "left"]
      : ["right_count", "rightCount", "right_votes", "rightVotes", "right"];

  for (const key of keys) {
    const value = Number(payload[key]);
    if (Number.isFinite(value)) return value;
  }

  const emoji = side === "left" ? payload.left_emoji : payload.right_emoji;
  const nestedSources = [
    payload.counts,
    payload.vote_counts,
    payload.voteCounts,
    payload.votes,
    payload.results,
    payload.reactions,
  ];

  for (const source of nestedSources) {
    if (!source || typeof source !== "object") continue;
    for (const key of [emoji, side, `${side}_emoji`]) {
      const value = Number(source[key]);
      if (Number.isFinite(value)) return value;
    }
  }

  return 0;
};

const getReactionUserId = (reaction = {}) =>
  reaction?.user ||
  reaction?.user_uid ||
  reaction?.uid ||
  reaction?.user_id ||
  reaction?.localId ||
  reaction?.id ||
  null;

const getReactionEmoji = (reaction = {}) =>
  reaction?.emoji || reaction?.reaction || reaction?.value || null;

const getReactionTimeValue = (reaction = {}) => {
  const value =
    reaction?.createdAt ||
    reaction?.created_at ||
    reaction?.updatedAt ||
    reaction?.updated_at ||
    reaction?.date ||
    reaction?.timestamp ||
    null;

  if (!value) return 0;
  if (typeof value === "number") {
    return String(Math.floor(value)).length === 10 ? value * 1000 : value;
  }
  if (value?._seconds) {
    return value._seconds * 1000 + Math.floor((value._nanoseconds || 0) / 1e6);
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeReactions = (reactions) => {
  if (Array.isArray(reactions)) return reactions;

  if (reactions && typeof reactions === "object") {
    return Object.entries(reactions).map(([uid, reaction]) => ({
      ...(reaction && typeof reaction === "object" ? reaction : {}),
      user:
        reaction?.user ||
        reaction?.user_uid ||
        reaction?.uid ||
        reaction?.user_id ||
        uid,
      emoji:
        reaction?.emoji ||
        reaction?.reaction ||
        reaction?.value ||
        (typeof reaction === "string" ? reaction : null),
      reaction:
        reaction?.reaction ||
        reaction?.emoji ||
        reaction?.value ||
        (typeof reaction === "string" ? reaction : null),
    }));
  }

  return [];
};

const getPollCountsFromReactions = ({
  reactions = [],
  leftEmoji,
  rightEmoji,
  localUserId,
  localVote,
}) => {
  const votesByUser = new Map();
  let anonymousIndex = 0;

  reactions.forEach((reaction) => {
    const emoji = getReactionEmoji(reaction);
    if (emoji !== leftEmoji && emoji !== rightEmoji) return;

    const uid = getReactionUserId(reaction) || `anonymous:${anonymousIndex++}`;
    const current = votesByUser.get(uid);
    const nextVote = {
      emoji,
      time: getReactionTimeValue(reaction),
    };

    if (!current || nextVote.time >= current.time) {
      votesByUser.set(uid, nextVote);
    }
  });

  if (localUserId && localVote) {
    votesByUser.set(localUserId, {
      emoji: localVote,
      time: Date.now(),
    });
  }

  let left = 0;
  let right = 0;
  for (const vote of votesByUser.values()) {
    if (vote.emoji === leftEmoji) left += 1;
    if (vote.emoji === rightEmoji) right += 1;
  }

  return { left, right };
};

function PollOverlay({ currentMoment }) {
  const user = useAuthStore((state) => state.user);
  const overlay = currentMoment?.overlays || {};
  const payload = overlay.payload || {};
  const text = overlay.text || currentMoment?.caption || "";
  const leftEmoji = payload.left_emoji || "👍";
  const rightEmoji = payload.right_emoji || "👎";
  const localUserId = user?.localId || null;
  const [localVote, setLocalVote] = useState(null);
  const [isVoting, setIsVoting] = useState(false);
  const reactions = normalizeReactions(currentMoment?.reactions);
  const existingUserVote = useMemo(() => {
    if (!localUserId) return null;
    const reaction = reactions.reduce((latest, item) => {
      const emoji = getReactionEmoji(item);
      if (
        getReactionUserId(item) !== localUserId ||
        (emoji !== leftEmoji && emoji !== rightEmoji)
      ) {
        return latest;
      }

      if (!latest || getReactionTimeValue(item) >= getReactionTimeValue(latest)) {
        return item;
      }

      return latest;
    }, null);
    return getReactionEmoji(reaction);
  }, [leftEmoji, localUserId, reactions, rightEmoji]);
  const selectedVote = localVote || existingUserVote;
  const reactionCounts = getPollCountsFromReactions({
    reactions,
    leftEmoji,
    rightEmoji,
    localUserId,
    localVote,
  });
  const hasPollReactions =
    localVote ||
    reactions.some((reaction) => {
      const emoji = getReactionEmoji(reaction);
      return emoji === leftEmoji || emoji === rightEmoji;
    });
  const leftCount = hasPollReactions
    ? reactionCounts.left
    : getPollCount(payload, "left");
  const rightCount = hasPollReactions
    ? reactionCounts.right
    : getPollCount(payload, "right");

  const handleVote = async (emoji) => {
    if (!currentMoment?.id || isVoting) return;

    const previousVote = localVote;
    setLocalVote(emoji);
    setIsVoting(true);

    try {
      const result = await SendReactMoment(emoji, currentMoment.id, 0);
      if (!result) throw new Error("EMPTY_REACT_RESPONSE");
      SonnerSuccess("Đã bình chọn!");
    } catch (error) {
      setLocalVote(previousVote);
      SonnerError("Bình chọn thất bại!");
      console.error("Lỗi khi bình chọn poll:", error);
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div className="absolute bottom-4 left-1/2 max-w-[82%] -translate-x-1/2">
      <div
        className="rounded-[24px] px-4 py-2 shadow-lg"
        style={{
          background: "linear-gradient(180deg, #685AF7 0%, #604EE8 100%)",
          color: overlay.textColor || "#FFFFFFF0",
          minWidth: "230px",
        }}
      >
        <div className="mb-2 text-center text-sm font-extrabold leading-tight">
          {text}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { emoji: leftEmoji, count: leftCount },
            { emoji: rightEmoji, count: rightCount },
          ].map((item, index) => (
            <button
              type="button"
              key={`${item.emoji}-${index}`}
              disabled={isVoting}
              onClick={(event) => {
                event.stopPropagation();
                handleVote(item.emoji);
              }}
              className={`flex min-w-0 items-center justify-center gap-2 rounded-full px-3 py-1.5 transition disabled:opacity-70 ${
                selectedVote === item.emoji
                  ? "bg-white/30 ring-2 ring-white/75"
                  : "bg-white/15 active:bg-white/25"
              }`}
            >
              <span className="text-base leading-none">{item.emoji}</span>
              <span className="text-lg font-black leading-none">
                {item.count}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ColorPaletteOverlay({ currentMoment }) {
  const overlay = currentMoment?.overlays || {};
  const payloadColors = Array.isArray(overlay.payload?.colors)
    ? overlay.payload.colors
    : [];
  const backgroundColors = Array.isArray(overlay.background?.colors)
    ? overlay.background.colors
    : [];
  const colors = (payloadColors.length ? payloadColors : backgroundColors)
    .filter(Boolean)
    .slice(0, 5);

  if (!colors.length) return null;

  return (
    <div className="absolute bottom-4 left-1/2 max-w-[80%] -translate-x-1/2">
      <div className="flex items-center justify-center rounded-full bg-black/45 px-4 py-2.5 shadow-lg backdrop-blur-md">
        <div className="flex -space-x-2">
          {colors.map((color, index) => (
            <span
              key={`${color}-${index}`}
              className="h-7 w-7 rounded-full border-2 border-white/85 shadow-sm"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const getMusicValue = (value) => {
  if (Array.isArray(value)) return value.find(Boolean) || "";
  return typeof value === "string" ? value : "";
};

function MusicOverlay({ currentMoment, isActive }) {
  const audioRef = useRef(null);
  const overlay = currentMoment?.overlays || {};
  const payload =
    overlay.payload && typeof overlay.payload === "object"
      ? overlay.payload
      : {};
  const music =
    overlay.music && typeof overlay.music === "object" ? overlay.music : {};
  const previewUrl = getMusicValue(
    payload.preview_url ||
      payload.previewUrl ||
      payload.audio ||
      music.preview_url ||
      music.previewUrl ||
      music.audio,
  );
  const coverUrl =
    overlay.icon?.data ||
    payload.thumbnail_url ||
    payload.thumbnailUrl ||
    payload.image ||
    music.image ||
    "";
  const title =
    overlay.text ||
    currentMoment?.caption ||
    [payload.song_title || music.title, payload.artist || music.artist]
      .filter(Boolean)
      .join(" - ");
  const animationDuration =
    title.length < 30 ? "9s" : title.length < 60 ? "15s" : "17s";

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!isActive || !previewUrl) {
      audio.pause();
      return;
    }

    audio.src = previewUrl;
    audio.loop = true;
    audio.volume = 1;
    audio.play().catch(() => {});

    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, [isActive, previewUrl]);

  useEffect(() => {
    if (
      !isActive ||
      !("mediaSession" in navigator) ||
      typeof MediaMetadata === "undefined"
    ) {
      return;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: payload.song_title || music.title || title,
      artist: payload.artist || music.artist || "",
      album: payload.album || music.album || "",
      artwork: coverUrl
        ? [{ src: coverUrl, sizes: "256x256", type: "image/jpeg" }]
        : [],
    });
    navigator.mediaSession.setActionHandler("play", () => {
      audioRef.current?.play().catch(() => {});
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      audioRef.current?.pause();
    });

    return () => {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
    };
  }, [coverUrl, isActive, music.album, music.artist, music.title, payload.album, payload.artist, payload.song_title, title]);

  return (
    <div className="absolute bottom-4 left-1/2 flex w-auto max-w-[85%] -translate-x-1/2 items-center gap-2 overflow-hidden rounded-4xl bg-white/50 px-4 py-2 font-semibold text-white backdrop-blur-2xl">
      {coverUrl && (
        <img
          src={coverUrl}
          alt="Cover"
          className="h-6 w-6 shrink-0 select-none rounded-sm object-cover"
        />
      )}
      <div className="relative min-w-0 flex-1 overflow-hidden whitespace-nowrap">
        <div
          className="inline-block animate-marquee"
          style={{ animationDuration }}
        >
          <span className="mr-4">{title}</span>
          <span className="absolute mr-4">{title}</span>
        </div>
      </div>
      <audio ref={audioRef} className="hidden" loop />
    </div>
  );
}

function BaseOverlay({ currentMoment, isActive = true }) {
  const overlay = currentMoment?.overlays;
  const captionType = getCaptionType(overlay);
  const overlayText = overlay?.text || currentMoment?.caption || "";
  const isTimeCaption =
    captionType === "time" || overlay?.id === "caption:time";
  const isWeatherCaption =
    captionType === "weather" || isWeatherText(overlayText);
  const isLocationCaption = captionType === "location";
  const resolvedIcon =
    (isWeatherCaption
      ? getWeatherIcon(overlay)
      : isLocationCaption
        ? {
            color: overlay?.icon?.color || overlay?.textColor || "#FFFFFF",
            data: "mappin.and.ellipse",
            type: "sf_symbol",
          }
        : overlay?.icon) ||
    (isTimeCaption
      ? { data: "clock.fill", type: "sf_symbol", color: "#FFFFFF" }
      : null);
  const imageSource =
    currentMoment?.thumbnailUrl ||
    currentMoment?.thumbnail_url ||
    currentMoment?.image_url ||
    "";
  const backgroundColors = Array.isArray(overlay?.background?.colors)
    ? overlay.background.colors.filter(Boolean)
    : [];
  const hasBackground = backgroundColors.length >= 2;
  const hasMaterialBlur = Boolean(overlay?.background?.materialBlur);
  const adaptiveContrast = useAdaptiveCaptionContrast(imageSource, !hasBackground);
  const glassStyle = getCaptionGlassStyle(adaptiveContrast);

  if (!overlay) return null;
  if (captionType === "poll") return <PollOverlay currentMoment={currentMoment} />;
  if (captionType === "color_palette") {
    return <ColorPaletteOverlay currentMoment={currentMoment} />;
  }
  if (captionType === "music") {
    return (
      <MusicOverlay currentMoment={currentMoment} isActive={isActive} />
    );
  }

  const backgroundStyle = hasBackground
    ? `linear-gradient(to bottom, ${backgroundColors.join(", ")})`
    : glassStyle.background;

  return (
    <div
      className="absolute bottom-4 left-1/2 w-max max-w-[80%] -translate-x-1/2 rounded-3xl px-2.5 py-2 backdrop-blur-sm"
      style={{
        background: backgroundStyle,
        color: hasBackground ? overlay?.textColor || "#fff" : glassStyle.color,
        textShadow: hasBackground ? undefined : glassStyle.textShadow,
        backdropFilter:
          !hasBackground || hasMaterialBlur ? glassStyle.backdropFilter : undefined,
        WebkitBackdropFilter:
          !hasBackground || hasMaterialBlur
            ? glassStyle.WebkitBackdropFilter
            : undefined,
        boxShadow: hasBackground ? undefined : glassStyle.boxShadow,
      }}
    >
      <div className="flex w-max max-w-full items-center justify-center gap-1.5 text-center text-base font-bold leading-6">
        <IconRenderer icon={resolvedIcon} />
        {/* Khử icon lặp ở đầu caption của moment cũ đã nhiễm (icon đã render riêng bên trái) */}
        <span
          className={`inline-block text-center ${
            isTimeCaption || isWeatherCaption
              ? "shrink-0 whitespace-nowrap break-normal"
              : "whitespace-normal break-words"
          }`}
        >
          {stripLeadingIcon(overlayText, resolvedIcon)}
        </span>
      </div>
    </div>
  );
}

export default BaseOverlay;
