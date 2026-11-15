import { LoaderCircle, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import UserInfo from "../Layout/UserInfoView";
import { OverlayRenderer } from "@/components/ui";
import { GetInfoMoment } from "@/services";
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
        onPointerUp={playActiveVideo}
        onTouchEnd={playActiveVideo}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute flex justify-center items-center top-4 right-4 z-50 p-2 bg-black/40 rounded-full hover:bg-black/60"
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
              className={`absolute inset-0 w-full h-full object-cover rounded-2xl transition-opacity duration-300 ${
                isVideoReady ? "opacity-100" : "opacity-0"
              }`}
              loop
              playsInline
              preload={isActive ? "auto" : "metadata"}
              {...videoEvents}
            />
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
