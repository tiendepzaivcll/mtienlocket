import { Swiper, SwiperSlide } from "swiper/react";
import { EffectCards } from "swiper/modules";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import "swiper/css";
import "swiper/css/effect-cards";
import { Loader2, RotateCcw, SmilePlus } from "lucide-react";
import { getRollcallMediaObjectUrl } from "@/services";

const VIDEO_EXTENSION = /\.(mp4|webm|mov|m4v)(?:[?#]|$)/i;

function getMediaUrl(item) {
  return (
    item?.main_url ||
    item?.mainUrl ||
    item?.video_url ||
    item?.videoUrl ||
    item?.media_url ||
    item?.mediaUrl ||
    item?.image_url ||
    item?.imageUrl ||
    item?.media?.main_url ||
    item?.media?.mainUrl ||
    item?.media?.video_url ||
    item?.media?.videoUrl ||
    item?.media?.image_url ||
    item?.media?.imageUrl ||
    item?.media?.url ||
    item?.url ||
    ""
  );
}

function isVideo(item, url) {
  const declaredType = String(
    item?.mime_type ||
      item?.mimeType ||
      item?.content_type ||
      item?.contentType ||
      item?.media_type ||
      item?.mediaType ||
      item?.media?.type ||
      "",
  ).toLowerCase();

  return (
    item?.is_video === true ||
    Boolean(item?.video_url || item?.videoUrl || item?.media?.video_url) ||
    declaredType.includes("video") ||
    VIDEO_EXTENSION.test(url)
  );
}

function RollcallImages({ items = [], onActiveChange }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const total = items.length;

  useEffect(() => {
    setActiveIndex(0);
    if (items[0]) onActiveChange?.(items[0]);
  }, [items, onActiveChange]);

  if (!total) return null;

  return (
    <div className="w-full max-w-sm mx-auto overflow-hidden">
      <Swiper
        effect="cards"
        grabCursor
        modules={[EffectCards]}
        className="w-78 sm:w-78 aspect-[3/4]"
        cardsEffect={{
          rotate: true,
          perSlideOffset: 10,
          perSlideRotate: 1,
          slideShadows: false,
        }}
        onSlideChange={(swiper) => {
          const nextIndex = swiper.activeIndex;
          setActiveIndex(nextIndex);
          onActiveChange?.(items[nextIndex]);
        }}
      >
        {items.map((item, index) => {
          const isActive = index === activeIndex;
          const shouldLoad = Math.abs(index - activeIndex) <= 1;

          return (
            <SwiperSlide key={item.uid || item.id || index}>
              <div className="relative w-full h-full overflow-hidden rounded-lg">
                <RollcallMedia
                  item={item}
                  shouldLoad={shouldLoad}
                  isActive={isActive}
                />

                {isActive && (
                  <div className="absolute z-[2] font-semibold top-2 right-2 bg-base-300/80 backdrop-blur px-3 py-1 rounded-full text-sm">
                    {activeIndex + 1}/{total}
                  </div>
                )}

                {isActive && (
                  <ReactionButton onClick={() => console.log("open modal")} />
                )}

                {isActive && <ReactionList reactions={item.reactions} />}
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
}

export default RollcallImages;

const RollcallMedia = memo(function RollcallMedia({
  item,
  shouldLoad,
  isActive,
}) {
  const rawUrl = useMemo(() => getMediaUrl(item), [item]);
  const video = useMemo(() => isVideo(item, rawUrl), [item, rawUrl]);
  const [objectUrl, setObjectUrl] = useState("");
  const [state, setState] = useState("idle");
  const [retryKey, setRetryKey] = useState(0);
  const objectUrlRef = useRef("");

  const clearObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = "";
    }
    setObjectUrl("");
  }, []);

  useEffect(() => {
    if (!shouldLoad || !rawUrl) {
      clearObjectUrl();
      setState(rawUrl ? "idle" : "missing");
      return undefined;
    }

    const controller = new AbortController();
    let disposed = false;
    clearObjectUrl();
    setState("loading");

    getRollcallMediaObjectUrl(rawUrl, { signal: controller.signal })
      .then((url) => {
        if (disposed) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrlRef.current = url;
        setObjectUrl(url);
      })
      .catch((error) => {
        if (
          disposed ||
          error?.name === "CanceledError" ||
          error?.code === "ERR_CANCELED"
        ) {
          return;
        }
        console.warn("Failed to load Rollcall media", error);
        setState("error");
      });

    return () => {
      disposed = true;
      controller.abort();
    };
  }, [shouldLoad, rawUrl, retryKey, clearObjectUrl]);

  useEffect(() => clearObjectUrl, [clearObjectUrl]);

  const handleRetry = () => {
    clearObjectUrl();
    setState("loading");
    setRetryKey((value) => value + 1);
  };

  if (!shouldLoad) {
    return <div className="w-full h-full bg-base-300" />;
  }

  return (
    <div className="relative w-full h-full bg-base-300">
      {state !== "ready" && (
        <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 bg-base-300">
          {state === "loading" || state === "idle" ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin opacity-70" />
              <span className="text-sm opacity-70">Đang tải…</span>
            </>
          ) : (
            <>
              <span className="px-5 text-center text-sm opacity-70">
                {state === "missing"
                  ? "Không tìm thấy đường dẫn media"
                  : "Tải media Rollcall thất bại"}
              </span>
              {state === "error" && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="flex items-center gap-1.5 rounded-lg bg-base-100 px-3 py-1.5 text-sm font-medium"
                >
                  <RotateCcw className="h-4 w-4" />
                  Thử lại
                </button>
              )}
            </>
          )}
        </div>
      )}

      {objectUrl &&
        (video ? (
          <video
            src={objectUrl}
            preload={isActive ? "metadata" : "none"}
            playsInline
            controls={isActive}
            onLoadedData={() => setState("ready")}
            onError={() => setState("error")}
            className={`h-full w-full object-cover transition-opacity duration-300 ${
              state === "ready" ? "opacity-100" : "opacity-0"
            }`}
          />
        ) : (
          <img
            src={objectUrl}
            alt=""
            loading={isActive ? "eager" : "lazy"}
            fetchPriority={isActive ? "high" : "low"}
            decoding="async"
            onLoad={() => setState("ready")}
            onError={() => setState("error")}
            className={`h-full w-full object-cover transition-opacity duration-300 ${
              state === "ready" ? "opacity-100" : "opacity-0"
            }`}
            draggable={false}
          />
        ))}
    </div>
  );
});

function ReactionButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute z-[2] bottom-2 right-2 bg-base-100/80 backdrop-blur p-2 rounded-full"
    >
      <SmilePlus className="w-6 h-6" />
    </button>
  );
}

function ReactionList({ reactions = [] }) {
  if (!reactions.length) return null;

  return (
    <div className="absolute z-[2] bottom-4 left-4 flex">
      {reactions.map((reaction) => (
        <span
          key={reaction.uid}
          style={{
            transform: `translate(${reaction.x * 10}px, ${
              reaction.y * 10
            }px) rotate(${reaction.rotation}rad) scale(${reaction.scale})`,
          }}
          className="text-2xl select-none"
        >
          {reaction.reaction}
        </span>
      ))}
    </div>
  );
}
