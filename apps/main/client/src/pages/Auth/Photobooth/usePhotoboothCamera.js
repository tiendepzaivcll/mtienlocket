import { useCallback, useEffect, useRef, useState } from "react";

const pageIsVisible = () =>
  typeof document === "undefined" || document.visibilityState !== "hidden";

const stopTracks = (stream) => {
  stream?.getTracks().forEach((track) => {
    try { track.stop(); } catch { /* Continue releasing the remaining tracks. */ }
  });
};

const cameraErrorMessage = (error) => {
  switch (error?.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Bạn chưa cho phép truy cập camera. Hãy cấp quyền camera rồi thử lại.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "Không tìm thấy camera trên thiết bị này.";
    case "NotReadableError":
    case "TrackStartError":
      return "Không thể sử dụng camera. Hãy đóng ứng dụng khác đang dùng camera rồi thử lại.";
    case "OverconstrainedError":
      return "Camera không hỗ trợ chế độ này. Hãy thử đổi camera hoặc thử lại.";
    case "SecurityError":
      return "Trình duyệt đang chặn camera. Hãy kiểm tra quyền truy cập và thử lại.";
    default:
      return "Không thể mở camera. Hãy kiểm tra quyền truy cập và thử lại.";
  }
};

export function usePhotoboothCamera({ enabled = true } = {}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mountedRef = useRef(false);
  const enabledRef = useRef(enabled);
  const wantedRef = useRef(false);
  const facingRef = useRef("user");
  const generationRef = useRef(0);
  const scheduledStartRef = useRef(0);
  const pendingRequestRef = useRef(null);
  const restartPendingRef = useRef(false);
  const videoCleanupRef = useRef(null);
  const streamCleanupRef = useRef(null);
  const requestRunnerRef = useRef(null);

  const [facingMode, setFacingMode] = useState("user");
  const [isReady, setIsReady] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");
  enabledRef.current = enabled;

  const updateReadiness = useCallback(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!mountedRef.current) return;
    setIsReady(Boolean(
      enabledRef.current && wantedRef.current && pageIsVisible() &&
      video && stream && video.srcObject === stream && video.readyState >= 2 &&
      stream.getVideoTracks().some((track) => track.readyState === "live")
    ));
  }, []);

  const playOnNode = useCallback((node) => {
    const stream = streamRef.current;
    if (!node || !stream || !mountedRef.current) return;
    node.muted = true;
    node.playsInline = true;
    node.autoplay = true;
    if (node.srcObject !== stream) {
      setIsReady(false);
      node.srcObject = stream;
    }
    updateReadiness();
    try {
      const playing = node.play();
      playing?.then(updateReadiness).catch((playError) => {
        // Moving the preview between grid cells can abort an old play request.
        if (playError?.name === "AbortError" || !mountedRef.current ||
            videoRef.current !== node || streamRef.current !== stream ||
            !enabledRef.current || !wantedRef.current || !pageIsVisible()) return;
        setIsReady(false);
        setError("Không thể phát hình camera. Hãy chạm thử lại camera để tiếp tục.");
      });
    } catch {
      if (mountedRef.current && videoRef.current === node) {
        setIsReady(false);
        setError("Không thể phát hình camera. Hãy chạm thử lại camera để tiếp tục.");
      }
    }
  }, [updateReadiness]);

  const attachVideoRef = useCallback((node) => {
    videoCleanupRef.current?.();
    videoCleanupRef.current = null;
    const previousNode = videoRef.current;
    if (previousNode && previousNode !== node) {
      previousNode.pause();
      previousNode.srcObject = null;
    }
    videoRef.current = node;
    if (mountedRef.current) setIsReady(false);
    if (!node) return;
    const handleReady = () => {
      if (videoRef.current === node) updateReadiness();
    };
    const readyEvents = ["loadeddata", "canplay", "playing"];
    readyEvents.forEach((event) => node.addEventListener(event, handleReady));
    videoCleanupRef.current = () => {
      readyEvents.forEach((event) => node.removeEventListener(event, handleReady));
    };
    playOnNode(node);
  }, [playOnNode, updateReadiness]);

  const releaseStream = useCallback(() => {
    streamCleanupRef.current?.();
    streamCleanupRef.current = null;
    const stream = streamRef.current;
    streamRef.current = null;
    const video = videoRef.current;
    if (video && video.srcObject === stream) {
      video.pause();
      video.srcObject = null;
    }
    stopTracks(stream);
    if (mountedRef.current) setIsReady(false);
  }, []);

  const stopCamera = useCallback(() => {
    wantedRef.current = false;
    generationRef.current += 1;
    scheduledStartRef.current += 1;
    restartPendingRef.current = false;
    releaseStream();
    if (mountedRef.current) setIsStarting(false);
  }, [releaseStream]);

  const runCameraRequest = useCallback(async () => {
    if (!mountedRef.current || !enabledRef.current || !wantedRef.current || !pageIsVisible()) return null;
    const currentStream = streamRef.current;
    if (currentStream?.getVideoTracks().some((track) => track.readyState === "live")) {
      setIsStarting(false);
      playOnNode(videoRef.current);
      return currentStream;
    }
    // A native permission request cannot be aborted. Serialize subsequent requests
    // and stop a stale result before requesting the latest desired camera.
    if (pendingRequestRef.current) {
      setIsStarting(true);
      if (pendingRequestRef.current.generation !== generationRef.current) {
        restartPendingRef.current = true;
      }
      return pendingRequestRef.current.promise;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setIsStarting(false);
      setError("Trình duyệt không hỗ trợ camera tại đây. Hãy mở bằng HTTPS hoặc localhost và thử lại.");
      return null;
    }
    releaseStream();
    setIsReady(false);
    setIsStarting(true);
    const request = { generation: generationRef.current, promise: null };
    pendingRequestRef.current = request;
    request.promise = (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facingRef.current },
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
        });
        if (!mountedRef.current || !enabledRef.current || !wantedRef.current ||
            !pageIsVisible() || request.generation !== generationRef.current) {
          stopTracks(stream);
          return null;
        }
        if (!stream.getVideoTracks().some((track) => track.readyState === "live")) {
          stopTracks(stream);
          setError("Không nhận được hình ảnh từ camera. Hãy thử lại.");
          return null;
        }
        streamRef.current = stream;
        const handleEnded = () => {
          if (streamRef.current !== stream || !mountedRef.current) return;
          wantedRef.current = false;
          releaseStream();
          setIsStarting(false);
          setError("Camera đã ngừng hoạt động. Hãy thử lại để tiếp tục.");
        };
        stream.getVideoTracks().forEach((track) => track.addEventListener("ended", handleEnded));
        streamCleanupRef.current = () => {
          stream.getVideoTracks().forEach((track) => track.removeEventListener("ended", handleEnded));
        };
        setError("");
        playOnNode(videoRef.current);
        return stream;
      } catch (cameraError) {
        if (mountedRef.current && enabledRef.current && wantedRef.current &&
            pageIsVisible() && request.generation === generationRef.current) {
          setIsReady(false);
          setError(cameraErrorMessage(cameraError));
        }
        return null;
      } finally {
        if (pendingRequestRef.current === request) pendingRequestRef.current = null;
        if (mountedRef.current && request.generation === generationRef.current) setIsStarting(false);
        const shouldRestart = restartPendingRef.current;
        restartPendingRef.current = false;
        if (shouldRestart && mountedRef.current && enabledRef.current &&
            wantedRef.current && pageIsVisible()) {
          requestRunnerRef.current?.();
        }
      }
    })();
    return request.promise;
  }, [playOnNode, releaseStream]);
  requestRunnerRef.current = runCameraRequest;

  const startCamera = useCallback(() => {
    if (!mountedRef.current || !enabledRef.current || !pageIsVisible()) return Promise.resolve(null);
    wantedRef.current = true;
    setError("");
    return requestRunnerRef.current?.() ?? Promise.resolve(null);
  }, []);

  const flipCamera = useCallback(() => {
    if (!mountedRef.current) return;
    const nextFacingMode = facingRef.current === "user" ? "environment" : "user";
    stopCamera();
    facingRef.current = nextFacingMode;
    setFacingMode(nextFacingMode);
    return startCamera();
  }, [startCamera, stopCamera]);

  const scheduleStart = useCallback(() => {
    const scheduled = ++scheduledStartRef.current;
    // StrictMode's initial effect cleanup cancels this before a permission prompt.
    queueMicrotask(() => {
      if (scheduled === scheduledStartRef.current && mountedRef.current &&
          enabledRef.current && pageIsVisible()) startCamera();
    });
  }, [startCamera]);

  useEffect(() => {
    mountedRef.current = true;
    if (videoRef.current) attachVideoRef(videoRef.current);
    const handleVisibility = () => {
      if (!pageIsVisible()) stopCamera();
      else if (enabledRef.current) scheduleStart();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      mountedRef.current = false;
      stopCamera();
      videoCleanupRef.current?.();
      videoCleanupRef.current = null;
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [attachVideoRef, scheduleStart, stopCamera]);

  useEffect(() => {
    if (enabled && pageIsVisible()) scheduleStart();
    else stopCamera();
    return () => { scheduledStartRef.current += 1; };
  }, [enabled, scheduleStart, stopCamera]);

  return { videoRef, attachVideoRef, facingMode, isReady, isStarting, error, startCamera, flipCamera, stopCamera };
}

export default usePhotoboothCamera;
