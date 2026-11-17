import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { getAvailableCameras, isIOS } from "@/utils";
const AutoResizeCaption = lazy(() => import("../CaptionViews"));
import { useApp } from "@/context/AppContext";
import { CONFIG } from "@/config";
import BorderProgress from "../../Widgets/SquareProgress";
import { SonnerInfo, SonnerSuccess } from "@/components/ui/SonnerToast";
import { useUIStore } from "@/stores";
import { Mic, MicOff, Volume2, VolumeX, X, Zap } from "lucide-react";
import AiSparkleIcon from "../../ActionControls/MediaControls/AiSparkleIcon.jsx";
import AiGenerationEffect from "./AiGenerationEffect.jsx";

const MediaPreview = () => {
  const { post, useloading, camera, navigation } = useApp();
  const {
    selectedFile,
    preview,
    postOverlay,
    selectedAiFilter,
    setSelectedAiFilter,
  } = post;
  const { isAiGenerating } = useloading;
  const { isBottomOpen, isHomeOpen, isProfileOpen } = navigation;
  const { setIsAiFilterOpen } = navigation;
  const {
    streamRef,
    videoRef,
    cameraActive,
    setCameraActive,
    cameraMode,
    zoomLevel,
    setZoomLevel,
    deviceId,
    setDeviceId,
    isFlashOn,
    setIsFlashOn,
  } = camera;
  const cameraInitialized = useRef(false);
  const cameraRequestId = useRef(0);
  const lastCameraMode = useRef(cameraMode);

  // Trạng thái mic khi quay video (mặc định bật)
  const [isMicEnabled, setIsMicEnabled] = useState(() => {
    const saved = localStorage.getItem("setting_camera_mic_enabled");
    return saved !== null ? saved === "true" : true;
  });
  const [isPreviewMuted, setIsPreviewMuted] = useState(false);
  const [isFlashBursting, setIsFlashBursting] = useState(false);

  // Lắng nghe hiệu ứng chớp flash khi chụp ảnh
  useEffect(() => {
    const handleFlashBurst = () => {
      setIsFlashBursting(true);
      setTimeout(() => setIsFlashBursting(false), 220);
    };
    window.addEventListener("camera-flash-burst", handleFlashBurst);
    return () => window.removeEventListener("camera-flash-burst", handleFlashBurst);
  }, []);

  const toggleMic = () => {
    const newVal = !isMicEnabled;
    setIsMicEnabled(newVal);
    localStorage.setItem("setting_camera_mic_enabled", String(newVal));
    if (newVal) {
      SonnerSuccess("Đã bật Mic 🎙️", "Video quay sẽ có âm thanh");
    } else {
      SonnerInfo("Đã tắt Mic 🔇", "Video quay sẽ không có âm thanh");
    }
  };

  // Helper áp dụng torch vật lý cho camera thiết bị
  const applyTorchSafe = async (track, enabled) => {
    if (!track || track.readyState !== "live") return false;
    try {
      const capabilities = typeof track.getCapabilities === "function" ? track.getCapabilities() : {};
      if (capabilities && capabilities.torch) {
        await track.applyConstraints({
          advanced: [{ torch: Boolean(enabled) }],
        });
        return true;
      }
    } catch (err) {
      console.warn("Lỗi khi áp dụng torch cho camera:", err);
    }
    return false;
  };

  const toggleFlash = async () => {
    const newVal = !isFlashOn;
    setIsFlashOn(newVal);
    localStorage.setItem("setting_camera_flash_enabled", String(newVal));

    const videoTrack = streamRef.current?.getVideoTracks()?.[0];
    let hardwareTorch = false;
    if (videoTrack) {
      hardwareTorch = await applyTorchSafe(videoTrack, newVal);
    }

    if (newVal) {
      if (hardwareTorch) {
        SonnerSuccess("Đã bật Đèn Flash ⚡", "Đèn flash vật lý trên máy đã bật");
      } else {
        SonnerSuccess("Đã bật Flash ⚡", "Chế độ flash trợ sáng đã kích hoạt");
      }
    } else {
      SonnerInfo("Đã tắt Flash", "Đèn flash / trợ sáng đã tắt");
    }
  };

  const cameraFrame = useUIStore((s) => s.cameraFrame);
  const normalizedOverlayType =
    postOverlay?.type === "image_icon" || postOverlay?.type === "caption_icon"
      ? "caption_image"
      : postOverlay?.type === "image_gif"
        ? "caption_gif"
        : postOverlay?.type;
  const hasCaptionOverlay =
    normalizedOverlayType &&
    (
      normalizedOverlayType !== "default" ||
      postOverlay.is_selected === true ||
      Boolean(postOverlay.caption) ||
      Boolean(postOverlay.icon) ||
      Boolean(postOverlay.color_top) ||
      Boolean(postOverlay.color_bottom) ||
      Boolean(postOverlay.background?.colors?.length) ||
      Boolean(Array.isArray(postOverlay.background) && postOverlay.background.length)
    );

  const iosDevice = isIOS();
  const isCameraScreenActive = !isBottomOpen && !isHomeOpen && !isProfileOpen;
  const openAiFilterStudio = () => setIsAiFilterOpen(true);
  const stopCamera = () => {
    cameraRequestId.current += 1;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          if (typeof track.getCapabilities === "function" && track.getCapabilities()?.torch) {
            track.applyConstraints({ advanced: [{ torch: false }] });
          }
        } catch {}
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    cameraInitialized.current = false;
  };

  const startCamera = async () => {
    let requestId = cameraRequestId.current;
    try {
      if (
        cameraInitialized.current &&
        streamRef.current &&
        lastCameraMode.current === cameraMode
      ) {
        if (videoRef.current && !videoRef.current.srcObject) {
          videoRef.current.srcObject = streamRef.current;
        }
        return;
      }

      if (streamRef.current && lastCameraMode.current !== cameraMode) {
        stopCamera();
      }

      let videoConstraints = {
        facingMode: cameraMode || "user",
      };

      if (iosDevice && deviceId) {
        videoConstraints.deviceId = { exact: deviceId };
      }

      const isUser = cameraMode === "user";
      const isZoom05 = zoomLevel === "0.5x";

      if (!(isUser && isZoom05)) {
        videoConstraints = {
          ...videoConstraints,
          ...CONFIG.app.camera.constraints.default,
        };
      }

      requestId = ++cameraRequestId.current;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });

      // A route change can finish before the native camera request resolves.
      if (requestId !== cameraRequestId.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      cameraInitialized.current = true;
      lastCameraMode.current = cameraMode;

      if (isFlashOn) {
        applyTorchSafe(stream.getVideoTracks()?.[0], true);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      if (requestId === cameraRequestId.current) {
        setCameraActive(false);
        cameraInitialized.current = false;
      }
    }
  };

  // useEffect(() => {
  //   if (!cameraActive) return;

  //   if (!preview && !selectedFile) {
  //     startCamera();
  //   } else {
  //     stopCamera();
  //   }

  //   return () => {
  //     stopCamera();
  //   };
  // }, [cameraActive, cameraMode, preview, selectedFile]);

  useEffect(() => {
    if (cameraActive && isCameraScreenActive && !preview && !selectedFile) {
      startCamera();
    } else if (!cameraActive || !isCameraScreenActive || preview || selectedFile) {
      if (streamRef.current) {
        stopCamera();
      }
    }

    return () => {
      stopCamera();
    };
  }, [cameraActive, cameraMode, preview, selectedFile, isCameraScreenActive]);

  useEffect(() => {
    if (isCameraScreenActive && !preview && !selectedFile && !cameraActive) {
      setCameraActive(true);
    }
  }, [preview, selectedFile, cameraActive, isCameraScreenActive]);

  const handleCycleZoomCamera = async () => {
    const cameras = await getAvailableCameras();
    const isBackCamera = cameraMode === "environment";
    const isFrontCamera = cameraMode === "user";

    let newZoom = "1x";
    let newDeviceId = null;

    if (isFrontCamera) {
      newZoom = zoomLevel === "1x" ? "0.5x" : "1x";
      newDeviceId = cameras?.frontCameras?.[0]?.deviceId;
    } else if (isBackCamera) {
      if (zoomLevel === "1x") {
        newZoom = "0.5x";
        newDeviceId = cameras?.backUltraWideCamera?.deviceId;
      } else if (zoomLevel === "0.5x") {
        newZoom = "3x";
        newDeviceId = cameras?.backZoomCamera?.deviceId;
      } else if (zoomLevel === "3x") {
        newZoom = "1x";
        newDeviceId = cameras?.backNormalCamera?.deviceId;
      }

      if (!newDeviceId && zoomLevel !== "1x") {
        newZoom = "1x";
        newDeviceId =
          cameras?.backNormalCamera?.deviceId ||
          cameras?.backCameras?.[0]?.deviceId;
      }
    }

    if (newDeviceId) {
      setZoomLevel(newZoom);
      setDeviceId(newDeviceId);
      setCameraActive(false);
      setTimeout(() => setCameraActive(true), 300);
    } else {
      SonnerInfo("Không tìm thấy camera phù hợp để chuyển zoom");
    }
  };

  return (
    <>
      <div
        className={`relative w-full max-w-md aspect-square bg-gray-800 rounded-[65px] overflow-hidden transition-transform duration-500 `}
      >
        {!preview && !selectedFile && cameraActive && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`
              w-full h-full object-cover transition-all duration-500 ease-in-out
              ${cameraMode === "user" ? "scale-x-[-1]" : ""}
              ${
                cameraActive
                  ? "opacity-100 scale-100"
                  : "opacity-0 scale-95 pointer-events-none"
              }
            `}
          />
        )}

        {!preview && !selectedFile && (
          <>
            {/* Top Bar: Mic góc trên bên trái, Zoom góc trên bên phải */}
            <div className="absolute inset-x-0 top-6 px-6 z-30 pointer-events-none flex justify-between items-center text-base-content text-xs font-semibold">
              {/* Nút Mic góc trên bên trái */}
              <button
                type="button"
                onClick={toggleMic}
                className={`pointer-events-auto h-8 w-8 rounded-full backdrop-blur-md flex items-center justify-center transition active:scale-95 shadow-sm ${
                  isMicEnabled
                    ? "bg-emerald-500/90 text-white shadow-emerald-500/30"
                    : "bg-black/60 text-red-400 border border-white/20 hover:bg-black/80"
                }`}
                title={isMicEnabled ? "Mic: Đang BẬT (Video có tiếng)" : "Mic: Đang TẮT (Video không tiếng)"}
                aria-label="Bật/Tắt Mic"
              >
                {isMicEnabled ? <Mic size={16} /> : <MicOff size={16} />}
              </button>

              {/* Nút Zoom góc trên bên phải */}
              <button
                onClick={handleCycleZoomCamera}
                className="pointer-events-auto min-w-[32px] h-8 px-2.5 text-primary-content font-semibold text-xs rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center hover:bg-white/40 active:scale-95 transition shadow-sm"
                title={`Chế độ Zoom: ${zoomLevel}`}
              >
                {zoomLevel}
              </button>
            </div>

            {/* Bottom Controls: Flash góc dưới bên trái, AI Filter góc dưới bên phải */}
            <div className="pointer-events-none absolute inset-x-0 bottom-6 z-[70] flex items-center justify-between px-6">
              {/* Nút Flash góc dưới bên trái - Bật/Tắt đèn Flash vật lý & màn hình */}
              <button
                type="button"
                onClick={toggleFlash}
                className={`pointer-events-auto h-9 w-9 rounded-full backdrop-blur-md flex items-center justify-center transition active:scale-90 shadow-md ${
                  isFlashOn
                    ? "bg-amber-400 text-black shadow-amber-400/50 ring-2 ring-amber-300 scale-105"
                    : "bg-black/60 text-white/80 border border-white/20 hover:bg-black/80"
                }`}
                title={isFlashOn ? "Đèn Flash: Đang BẬT" : "Đèn Flash: Đang TẮT"}
                aria-label="Bật/Tắt Flash"
              >
                <Zap
                  size={17}
                  className={isFlashOn ? "fill-black text-black" : "text-white/80"}
                />
              </button>

              {/* Nhóm góc dưới bên phải: AI Filter */}
              <div className="flex items-center gap-2.5 pointer-events-auto">
                {selectedAiFilter ? (
                  <>
                    <button
                      type="button"
                      onClick={openAiFilterStudio}
                      disabled={isAiGenerating}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 text-black shadow-lg shadow-amber-400/40 transition active:scale-90"
                      aria-label="Đổi AI Filter"
                    >
                      <AiSparkleIcon />
                    </button>

                    <button
                      type="button"
                      onClick={openAiFilterStudio}
                      disabled={isAiGenerating}
                      className="h-11 w-11 overflow-hidden rounded-full bg-white/20 shadow-md transition active:scale-95 border border-white/40"
                      aria-label={`Đổi filter ${selectedAiFilter.filter_label}`}
                    >
                      <img
                        src={selectedAiFilter.icon_url}
                        alt={selectedAiFilter.filter_label}
                        className="h-full w-full object-cover"
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedAiFilter(null)}
                      disabled={isAiGenerating}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-black/60 text-white shadow-md backdrop-blur-md transition active:scale-90"
                      aria-label="Hủy AI Filter"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={openAiFilterStudio}
                    disabled={isAiGenerating}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/30 text-white shadow-md backdrop-blur-md transition active:scale-90 hover:bg-white/40"
                    aria-label="Mở Filter"
                    title="Bộ lọc AI"
                  >
                    <AiSparkleIcon />
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {preview?.type === "video" && (
          <div className="relative w-full h-full">
            <video
              src={preview.data}
              autoPlay
              loop
              playsInline
              muted={isPreviewMuted}
              className={`w-full h-full object-cover ${
                preview ? "opacity-100" : "opacity-0"
              }`}
            />
            <button
              type="button"
              onClick={() => setIsPreviewMuted(!isPreviewMuted)}
              className="absolute top-4 left-4 z-[75] p-2 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white rounded-full transition active:scale-90 shadow-lg"
              title={isPreviewMuted ? "Bật âm thanh" : "Tắt âm thanh"}
              aria-label={isPreviewMuted ? "Bật âm thanh" : "Tắt âm thanh"}
            >
              {isPreviewMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
          </div>
        )}

        {preview?.type === "image" && (
          <img
            src={preview.data}
            alt="Preview"
            className={`w-full h-full object-cover select-none transition-all duration-300 ${
              preview ? "opacity-100" : "opacity-0"
            }`}
          />
        )}

        {preview?.type === "image" && selectedFile?.type?.startsWith("image/") && (
          <div className="pointer-events-none absolute inset-x-0 bottom-7 z-[70] flex items-center justify-between px-7">
            {selectedAiFilter ? (
              <>
                <button
                  type="button"
                  onClick={openAiFilterStudio}
                  disabled={isAiGenerating}
                  className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 text-black shadow-lg shadow-amber-400/40 transition active:scale-90 disabled:opacity-60"
                  aria-label="Đổi AI Filter"
                >
                  <AiSparkleIcon />
                </button>

                <button
                  type="button"
                  onClick={openAiFilterStudio}
                  disabled={isAiGenerating}
                  className="pointer-events-auto h-13 w-13 overflow-hidden rounded-full bg-white/20 shadow-md transition active:scale-95"
                  aria-label={`Đổi filter ${selectedAiFilter.filter_label}`}
                >
                  <img
                    src={selectedAiFilter.icon_url}
                    alt={selectedAiFilter.filter_label}
                    className="h-full w-full object-cover"
                  />
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedAiFilter(null)}
                  disabled={isAiGenerating}
                  className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-black/60 text-white shadow-md backdrop-blur-md transition active:scale-90 disabled:opacity-60"
                  aria-label="Hủy AI Filter"
                >
                  <X className="h-5 w-5" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={openAiFilterStudio}
                disabled={isAiGenerating}
                className="pointer-events-auto ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/30 text-white shadow-md backdrop-blur-md transition active:scale-90"
                aria-label="Mở Filter"
              >
                <AiSparkleIcon />
              </button>
            )}
          </div>
        )}

        <div
          className={`absolute z-10 inset-x-0 bottom-0 px-4 pb-4 transform transition-all duration-300 
          ${
            hasCaptionOverlay
              ? "opacity-100"
              : "opacity-0 scale-95 pointer-events-none"
          }`}
        >
          <Suspense fallback={null}>
            <AutoResizeCaption />
          </Suspense>
        </div>

        {isAiGenerating && (
          <AiGenerationEffect
            filterName={selectedAiFilter?.filter_label}
          />
        )}

        {/* <div className="absolute top-6 right-7 z-50 text-primary-content">
          <button>
            <CircleHelpIcon />
          </button>
        </div> */}
        <div className="absolute inset-0 z-50 pointer-events-none">
          <BorderProgress />
        </div>

        {/* Trợ sáng màn hình khi Flash đang bật (dành cho selfie / thiếu sáng) */}
        {isFlashOn && !preview && !selectedFile && cameraActive && (
          <div className="absolute inset-0 pointer-events-none z-20 border-[6px] border-amber-300/40 bg-amber-100/10 mix-blend-screen transition-opacity duration-300" />
        )}

        {/* Hiệu ứng chớp trắng toàn màn hình khi bấm chụp ảnh có flash */}
        {isFlashBursting && (
          <div className="absolute inset-0 z-[100] bg-white pointer-events-none transition-opacity duration-200" />
        )}

        {/* Frame overlay - always on top when selected */}
        {cameraFrame?.imageSrc && (
          <div className="absolute inset-0 z-[60] pointer-events-none">
            <img
              src={cameraFrame.imageSrc}
              loading="lazy"
              alt="Khung viền camera"
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>
    </>
  );
};

export default MediaPreview;
