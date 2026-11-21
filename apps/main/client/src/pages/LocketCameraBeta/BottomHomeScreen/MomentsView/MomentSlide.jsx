import { LoaderCircle, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import UserInfo from "../Layout/UserInfoView";
import { OverlayRenderer } from "@/components/ui";
import { GetInfoMoment } from "@/services";
import { useViewedMomentsStore } from "@/stores";
import FlyingEmojiEffect from "../Modal/FlyingEmojiEffect";
import { useResilientVideo } from "./useResilientVideo";

const normalizeReactions = (reactions) => {
  if (Array.isArray(reactions)) return reactions;
  if (!reactions || typeof reactions !== "object") return [];

  return Object.entries(reactions).map(([uid, reaction]) => ({
    ...(reaction && typeof reaction === "object" ? reaction : {}),
    uid,
    reaction:
      reaction?.reaction ||
      reaction?.emoji ||
      reaction?.value ||
      (typeof reaction === "string" ? reaction : null),
  }));
};

const getReactionEmoji = (reaction) =>
  typeof reaction === "string"
    ? reaction
    : reaction?.emoji ||
      reaction?.reaction ||
      reaction?.string ||
      reaction?.value ||
      reaction?.vote ||
      reaction?.choice ||
      reaction?.answer ||
      null;

const MomentSlide = ({ moment, me, handleClose, isActive = true }) => {
  const [detailMoment, setDetailMoment] = useState(null);
  const markViewed = useViewedMomentsStore((s) => s.markViewed);

  useEffect(() => {
    if (isActive && moment?.id) {
      markViewed(moment);
    }
  }, [isActive, moment?.id, markViewed]);
  const momentOwnerId =
    typeof moment?.user === "string" ? moment.user : moment?.user?.uid;
  const currentUserId = me?.uid || me?.localId || null;
  const isOwnMoment =
    !momentOwnerId ||
    momentOwnerId === me?.uid ||
    momentOwnerId === me?.localId;
  const isPollMoment =
    moment?.overlays?.captionType === "poll" ||
    moment?.overlays?.id === "caption:poll";
  const shouldFetchDetail = isActive && (isOwnMoment || isPollMoment);

  useEffect(() => {
    let isMounted = true;

    const fetchMomentDetail = async () => {
      if (!moment?.id || !shouldFetchDetail) {
        setDetailMoment(null);
        return;
      }

      try {
        const data = await GetInfoMoment(moment.id);
        if (isMounted) setDetailMoment(data || null);
      } catch (error) {
        if (isMounted) setDetailMoment(null);
        console.warn("Không lấy được chi tiết moment:", error);
      }
    };

    fetchMomentDetail();

    return () => {
      isMounted = false;
    };
  }, [moment?.id, shouldFetchDetail]);

  const displayMoment = useMemo(() => {
    const detailReactions = normalizeReactions(detailMoment?.reactions);
    const momentReactions = normalizeReactions(moment?.reactions);

    return {
      ...(moment || {}),
      ...(detailMoment || {}),
      overlays: {
        ...(moment?.overlays || {}),
        ...(detailMoment?.overlays || {}),
      },
      reactions: detailReactions.length ? detailReactions : momentReactions,
    };
  }, [detailMoment, moment]);

  const videoSource =
    displayMoment?.videoUrl ||
    displayMoment?.video_url ||
    moment?.videoUrl ||
    moment?.video_url ||
    "";
  const {
    videoRef,
    playbackUrl,
    isReady: isVideoReady,
    isBuffering: isVideoBuffering,
    hasFailed: hasVideoFailed,
    requestPlay: playActiveVideo,
    retryManually: retryVideo,
    videoEvents,
  } = useResilientVideo({ source: videoSource, isActive });

  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem("locket_video_muted");
    return saved !== null ? saved === "true" : false; // Mặc định có âm thanh
  });

  const toggleMute = (e) => {
    if (e) e.stopPropagation();
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    localStorage.setItem("locket_video_muted", String(newMuted));
    if (videoRef.current) {
      videoRef.current.muted = newMuted;
      if (!newMuted) {
        videoRef.current.volume = 1;
        videoRef.current.play().catch(() => {});
      }
    }
  };

  const handlePointerInteraction = () => {
    playActiveVideo();
    // Khi người dùng chạm vào video: nếu đang không tắt tiếng thì đảm bảo mở âm thanh
    if (!isMuted && videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = 1;
    }
  };

  const reactionEmojis = useMemo(() => {
    if (!isOwnMoment || !currentUserId) return [];

    const payload = displayMoment?.overlays?.payload || {};
    const pollEmojis = isPollMoment
      ? new Set(
          [payload.left_emoji, payload.right_emoji].filter(Boolean),
        )
      : null;

    return normalizeReactions(displayMoment?.reactions)
      .map(getReactionEmoji)
      .filter((emoji) => emoji && !pollEmojis?.has(emoji));
  }, [
    currentUserId,
    displayMoment?.overlays,
    displayMoment?.reactions,
    isOwnMoment,
    isPollMoment,
  ]);

  return (
    <div className="flex w-full flex-col justify-center items-center">
      <FlyingEmojiEffect
        active={isActive && isOwnMoment}
        emojis={reactionEmojis}
        momentId={displayMoment?.id || moment?.id}
      />
      <div
        className="relative flex flex-col items-center w-full gap-3"
        onClick={(e) => e.stopPropagation()}
        onPointerUp={handlePointerInteraction}
        onTouchEnd={handlePointerInteraction}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          style={{ top: "calc(env(safe-area-inset-top) + 16px)" }}
          className="absolute flex justify-center items-center right-4 z-50 p-2 bg-black/40 rounded-full hover:bg-black/60 active:scale-95 transition cursor-pointer"
          aria-label="Đóng moment"
        >
          <X className="w-6 h-6 text-white" />
        </button>

        <div className="h-full w-full border-y border-base-300 sm:max-w-sm max-w-md aspect-square flex items-center justify-center relative bg-gradient-to-br from-base-300/20 to-base-100/20 rounded-[64px] overflow-hidden">
          {/* 1️⃣ Thumbnail luôn hiển thị trước */}
          {displayMoment?.thumbnailUrl && (
            <img
              src={displayMoment.thumbnailUrl}
              alt={displayMoment?.caption || "Moment"}
              className={`absolute inset-0 w-full h-full object-cover rounded-2xl transition-opacity duration-300 ${
                isVideoReady ? "opacity-0" : "opacity-100"
              }`}
            />
          )}

          {/* 2️⃣ Video load ngầm */}
          {videoSource && (
            <video
              ref={videoRef}
              src={playbackUrl}
              muted={isMuted}
              className={`absolute inset-0 w-full h-full object-cover rounded-2xl transition-opacity duration-300 ${
                isVideoReady ? "opacity-100" : "opacity-0"
              }`}
              loop
              playsInline
              preload={isActive ? "auto" : "metadata"}
              {...videoEvents}
            />
          )}

          {/* Nút Bật / Tắt Âm Thanh Video */}
          {videoSource && isActive && (
            <button
              type="button"
              onClick={toggleMute}
              className="absolute top-4 left-4 z-40 p-2.5 bg-black/50 hover:bg-black/75 backdrop-blur-md rounded-full text-white transition active:scale-90 shadow-lg"
              title={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
              aria-label={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          )}

          {videoSource && isActive && isVideoBuffering && !hasVideoFailed && (
            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
              <LoaderCircle className="w-8 h-8 text-white drop-shadow-lg animate-spin" />
            </div>
          )}

          {videoSource && isActive && hasVideoFailed && (
            <button
              type="button"
              title="Thử tải lại video"
              aria-label="Thử tải lại video"
              onClick={(event) => {
                event.stopPropagation();
                retryVideo();
              }}
              className="absolute inset-0 z-20 flex items-center justify-center bg-black/20"
            >
              <span className="flex w-12 h-12 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
                <RotateCcw className="w-6 h-6" />
              </span>
            </button>
          )}

          {/* Caption */}
          {(displayMoment?.caption ||
            displayMoment?.overlays?.text ||
            displayMoment?.overlays?.payload) && (
            <OverlayRenderer moment={displayMoment} isActive={isActive} />
          )}
        </div>

        <UserInfo
          user={displayMoment?.user}
          date={
            displayMoment?.date ||
            displayMoment?.createdAt ||
            displayMoment?.created_at ||
            displayMoment?.createTime ||
            displayMoment?.create_time
          }
        />
      </div>
    </div>
  );
};

export default MomentSlide;
