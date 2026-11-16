import React, { lazy, Suspense, useEffect, useRef } from "react";
import { getAvailableCameras, isIOS } from "@/utils";
const AutoResizeCaption = lazy(() => import("../CaptionViews"));
import { useApp } from "@/context/AppContext";
import { CONFIG } from "@/config";
import BorderProgress from "../../Widgets/SquareProgress";
import { SonnerInfo, SonnerWarning } from "@/components/ui/SonnerToast";
import { useAuthStore, useUIStore } from "@/stores";
import { X } from "lucide-react";
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
  const aiFilterEnabled = useAuthStore((state) => state.aiFilterEnabled);
  const refreshAccessRole = useAuthStore((state) => state.refreshAccessRole);
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
  } = camera;
  const cameraInitialized = useRef(false);
  const cameraRequestId = useRef(0);
  const lastCameraMode = useRef(cameraMode);

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
  const openAiFilterStudio = async () => {
    if (aiFilterEnabled) {
      setIsAiFilterOpen(true);
      return;
    }

    const access = await refreshAccessRole();
    if (access?.features?.aiFilter === true) {
      setIsAiFilterOpen(true);
      return;
    }

    SonnerWarning("Tính năng trả phí", "Liên hệ admin để sử dụng");
  };
  const stopCamera = () => {
    cameraRequestId.current += 1;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
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
            <div className="absolute inset-0 top-7 px-7 z-30 pointer-events-none flex justify-between text-base-content text-xs font-semibold">
              <button
                onClick={() => SonnerInfo("Chức năng này sẽ sớm có mặt!")}
                className="pointer-events-auto w-7 h-7 p-1.5 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center"
              >
                <img src="/icons/bolt.fill.png" alt="Icon sấm sét" />
              </button>

              <button
                onClick={handleCycleZoomCamera}
                className="pointer-events-auto w-6 h-6 text-primary-content font-semibold rounded-full bg-white/30 backdrop-blur-md p-3.5 flex items-center justify-center"
              >
                {zoomLevel}
              </button>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-7 z-[70] flex items-center justify-between px-7">
              {selectedAiFilter ? (
                <>
                  <button
                    type="button"
                    onClick={openAiFilterStudio}
                    disabled={isAiGenerating}
                    className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 text-black shadow-lg shadow-amber-400/40 transition active:scale-90"
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
                    className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-black/60 text-white shadow-md backdrop-blur-md transition active:scale-90"
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
                  aria-label="Chọn AI Filter"
                >
                  <AiSparkleIcon />
                </button>
              )}
            </div>
          </>
        )}

        {preview?.type === "video" && (
          <video
            src={preview.data}
            autoPlay
            loop
            playsInline
            className={`w-full h-full object-cover ${
              preview ? "opacity-100" : "opacity-0"
            }`}
          />
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
                aria-label="Chọn AI Filter"
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
