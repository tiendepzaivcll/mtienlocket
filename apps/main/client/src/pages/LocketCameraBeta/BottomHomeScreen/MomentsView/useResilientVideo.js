import { useCallback, useEffect, useRef, useState } from "react";

const MAX_AUTO_RETRIES = 4;
const STALL_TIMEOUT_MS = 7000;

const addRetryQuery = (source, attempt) => {
  if (!source || source.startsWith("blob:") || source.startsWith("data:")) {
    return source;
  }

  try {
    const url = new URL(source, window.location.href);
    url.searchParams.set("t97_video_retry", `${attempt}-${Date.now()}`);
    return url.toString();
  } catch {
    const separator = source.includes("?") ? "&" : "?";
    return `${source}${separator}t97_video_retry=${attempt}-${Date.now()}`;
  }
};

export const useResilientVideo = ({ source, isActive }) => {
  const videoRef = useRef(null);
  const resumeTimeRef = useRef(0);
  const retryCountRef = useRef(0);
  const lastProgressAtRef = useRef(Date.now());
  const bufferingRef = useRef(Boolean(source));

  const [playbackUrl, setPlaybackUrl] = useState(source || "");
  const [isReady, setIsReady] = useState(false);
  const [isBuffering, setIsBuffering] = useState(Boolean(source));
  const [hasFailed, setHasFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const setBuffering = useCallback((value) => {
    bufferingRef.current = value;
    setIsBuffering(value);
  }, []);

  const requestPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isActive) return;

    // Tự động kiểm tra cài đặt âm thanh người dùng (mặc định bật âm thanh)
    const savedMuted = localStorage.getItem("locket_video_muted");
    const shouldMute = savedMuted === "true";
    if (video.muted !== shouldMute) {
      video.muted = shouldMute;
    }

    const playRequest = video.play();
    if (playRequest?.catch) {
      playRequest.catch((error) => {
        if (error?.name === "NotAllowedError" && isActive) {
          // Trình duyệt chặn autoplay có tiếng khi chưa tương tác: tạm thời muted để video tự phát hình ảnh
          video.muted = true;
          video.play().catch(() => {});
        } else if (isActive) {
          setBuffering(true);
        }
      });
    }
  }, [isActive, setBuffering]);

  const recoverVideo = useCallback(
    ({ manual = false } = {}) => {
      if (!source || !isActive) return;

      const video = videoRef.current;
      if (video && Number.isFinite(video.currentTime)) {
        resumeTimeRef.current = video.currentTime;
      }

      if (manual) {
        retryCountRef.current = 0;
      }

      const nextAttempt = retryCountRef.current + 1;
      if (!manual && nextAttempt > MAX_AUTO_RETRIES) {
        setBuffering(false);
        setHasFailed(true);
        return;
      }

      retryCountRef.current = nextAttempt;
      setRetryCount(nextAttempt);
      setHasFailed(false);
      setBuffering(true);
      lastProgressAtRef.current = Date.now();
      setPlaybackUrl(addRetryQuery(source, nextAttempt));
    },
    [isActive, setBuffering, source],
  );

  useEffect(() => {
    retryCountRef.current = 0;
    resumeTimeRef.current = 0;
    lastProgressAtRef.current = Date.now();
    setPlaybackUrl(source || "");
    setIsReady(false);
    setHasFailed(false);
    setRetryCount(0);
    setBuffering(Boolean(source));
  }, [setBuffering, source]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!isActive) {
      video.pause();
      if (Number.isFinite(video.currentTime)) video.currentTime = 0;
      setBuffering(false);
      return;
    }

    setBuffering(video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA);
    requestPlay();

    return () => video.pause();
  }, [isActive, playbackUrl, requestPlay, setBuffering]);

  useEffect(() => {
    if (!isActive || !source || !isBuffering || hasFailed) return undefined;

    let timeoutId;
    const checkStall = () => {
      const video = videoRef.current;
      if (!video || !bufferingRef.current || !isActive) return;

      if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        requestPlay();
        return;
      }

      const idleFor = Date.now() - lastProgressAtRef.current;
      if (idleFor < STALL_TIMEOUT_MS) {
        timeoutId = window.setTimeout(checkStall, STALL_TIMEOUT_MS - idleFor);
        return;
      }

      if (navigator.onLine !== false) recoverVideo();
    };

    timeoutId = window.setTimeout(checkStall, STALL_TIMEOUT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [
    hasFailed,
    isActive,
    isBuffering,
    playbackUrl,
    recoverVideo,
    requestPlay,
    retryCount,
    source,
  ]);

  useEffect(() => {
    const handleOnline = () => {
      if (isActive && source && (bufferingRef.current || hasFailed)) {
        recoverVideo({ manual: true });
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && isActive) requestPlay();
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [hasFailed, isActive, recoverVideo, requestPlay, source]);

  const markProgress = useCallback(() => {
    lastProgressAtRef.current = Date.now();
    const video = videoRef.current;
    if (video?.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      setBuffering(false);
    }
  }, [setBuffering]);

  const handleLoadedMetadata = useCallback((event) => {
    const video = event.currentTarget;
    const resumeAt = resumeTimeRef.current;
    if (resumeAt <= 0 || !Number.isFinite(video.duration)) return;

    video.currentTime = Math.min(resumeAt, Math.max(0, video.duration - 0.1));
  }, []);

  const handleLoadedData = useCallback(() => {
    setIsReady(true);
    markProgress();
    requestPlay();
  }, [markProgress, requestPlay]);

  const handlePlaying = useCallback(() => {
    setIsReady(true);
    setBuffering(false);
    setHasFailed(false);
    retryCountRef.current = 0;
    setRetryCount(0);
    lastProgressAtRef.current = Date.now();
  }, [setBuffering]);

  const handleWaiting = useCallback(() => {
    if (!isActive) return;
    if (!bufferingRef.current) lastProgressAtRef.current = Date.now();
    setBuffering(true);
  }, [isActive, setBuffering]);

  const handleError = useCallback(() => {
    if (!isActive || navigator.onLine === false) {
      setBuffering(Boolean(isActive));
      return;
    }

    recoverVideo();
  }, [isActive, recoverVideo, setBuffering]);

  const retryManually = useCallback(() => {
    recoverVideo({ manual: true });
  }, [recoverVideo]);

  return {
    videoRef,
    playbackUrl,
    isReady,
    isBuffering,
    hasFailed,
    requestPlay,
    retryManually,
    videoEvents: {
      onCanPlay: requestPlay,
      onError: handleError,
      onLoadedData: handleLoadedData,
      onLoadedMetadata: handleLoadedMetadata,
      onPlaying: handlePlaying,
      onProgress: markProgress,
      onStalled: handleWaiting,
      onSuspend: markProgress,
      onTimeUpdate: markProgress,
      onWaiting: handleWaiting,
    },
  };
};
