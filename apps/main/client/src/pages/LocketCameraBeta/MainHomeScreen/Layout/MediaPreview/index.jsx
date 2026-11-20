import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { getAvailableCameras, isIOS } from "@/utils";
const AutoResizeCaption = lazy(() => import("../CaptionViews"));
import { useApp } from "@/context/AppContext";
import { CONFIG } from "@/config";
import BorderProgress from "../../Widgets/SquareProgress";
import { SonnerInfo, SonnerSuccess, SonnerWarning } from "@/components/ui/SonnerToast";
import { useUIStore, usePhotoboothStore } from "@/stores";
import { useCameraCaptureMode } from "@/hooks/useCameraCaptureMode";
import { PHOTOBOOTH_FRAMES } from "@/data/photoboothFrames";
import { Mic, MicOff, Sparkles, Volume2, VolumeX, X, Zap } from "lucide-react";
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
  const isPWA =
    Boolean(navigation?.isPWA) ||
    (typeof window !== "undefined" &&
      (window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true));
  const { setIsAiFilterOpen } = navigation;
  const {
    streamRef,
    videoRef,
    cameraActive,
    setCameraActive,
    cameraMode,
    zoomLevel,
    setZoomLevel,
    zoomScale,
    setZoomScale,
    hasHardwareZoom,
    setHasHardwareZoom,
    isScreenFlashing,
    setIsScreenFlashing,
    deviceId,
    setDeviceId,
    isFlashOn,
    setIsFlashOn,
  } = camera;
  const { showPhotobooth, selectedFrameId } = useCameraCaptureMode();
  const photoboothPhotos = usePhotoboothStore((state) => state.photos);
  const isComposing = usePhotoboothStore((state) => state.isComposing);
  const currentBoothFrame = PHOTOBOOTH_FRAMES.find((f) => f.id === selectedFrameId) || null;
  const cameraInitialized = useRef(false);
  const cameraRequestId = useRef(0);
  const lastCameraMode = useRef(cameraMode);

  // Pinch-to-zoom (thu phóng bằng chụm 2 ngón tay banh ra/thu vào)
  const cameraContainerRef = useRef(null);
  const initialPinchDist = useRef(0);
  const initialPinchZoom = useRef(1);
  const [isPinching, setIsPinching] = useState(false);
  const pinchTimeoutRef = useRef(null);
  const [zoomRange, setZoomRange] = useState({ min: 0.5, max: 6 });

  // Kiểm tra khả năng zoom phần cứng của camera thiết bị
  const updateCameraZoomCapabilities = (track, mode = cameraMode) => {
    if (!track || track.readyState !== "live") return;
    try {
      const caps = typeof track.getCapabilities === "function" ? track.getCapabilities() : {};
      const isFront = mode === "user";

      if (isFront) {
        // Cam trước: Giới hạn từ 1.0x đến tối đa 2.5x để đảm bảo ảnh selfie nét, không vỡ hạt
        const minZ = caps && caps.zoom && caps.zoom.min !== undefined ? Math.max(caps.zoom.min, 1.0) : 1.0;
        const maxZ = caps && caps.zoom && caps.zoom.max ? Math.min(caps.zoom.max, 2.5) : 2.5;
        setHasHardwareZoom(Boolean(caps?.zoom));
        setZoomRange({ min: minZ, max: maxZ, step: caps?.zoom?.step || 0.1 });
        return;
      }

      // Cam sau: Nhận diện chính xác theo phần cứng máy (từ 0.5x đến caps.zoom.max của thiết bị)
      if (caps && caps.zoom) {
        setHasHardwareZoom(true);
        const minZ = caps.zoom.min !== undefined ? Math.min(caps.zoom.min, 0.5) : 0.5;
        const maxZ = caps.zoom.max ? Math.min(caps.zoom.max, 10) : 6;
        setZoomRange({
          min: minZ,
          max: maxZ,
          step: caps.zoom.step || 0.1,
        });
        return;
      }
    } catch (err) {
      console.warn("Lỗi kiểm tra capabilities zoom:", err);
    }

    if (mode === "user") {
      setHasHardwareZoom(false);
      setZoomRange({ min: 1.0, max: 2.5, step: 0.1 });
    } else {
      setHasHardwareZoom(false);
      setZoomRange({ min: 0.5, max: 6.0, step: 0.1 });
    }
  };

  const applyHardwareZoom = async (val) => {
    const track = streamRef.current?.getVideoTracks()?.[0];
    if (!track || track.readyState !== "live") return;
    try {
      const caps = typeof track.getCapabilities === "function" ? track.getCapabilities() : {};
      if (caps && caps.zoom) {
        const minZ = zoomRange.min !== undefined ? zoomRange.min : (caps.zoom.min || 1);
        const maxZ = zoomRange.max !== undefined ? zoomRange.max : (caps.zoom.max || 6);
        const clamped = Math.min(Math.max(val, minZ), maxZ);
        await track.applyConstraints({ advanced: [{ zoom: clamped }] });
      }
    } catch (e) {}
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialPinchDist.current = d;
      initialPinchZoom.current = zoomScale || 1;
      setIsPinching(true);
      if (pinchTimeoutRef.current) clearTimeout(pinchTimeoutRef.current);
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && initialPinchDist.current > 0) {
      if (e.cancelable) e.preventDefault();
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = currentDist / initialPinchDist.current;
      let nextZoom = initialPinchZoom.current * factor;
      const minZ = zoomRange.min !== undefined ? zoomRange.min : 0.5;
      const maxZ = zoomRange.max || 6;
      nextZoom = Math.min(Math.max(nextZoom, minZ), maxZ);
      const rounded = Math.round(nextZoom * 10) / 10;
      setZoomScale(rounded);
      applyHardwareZoom(rounded);
      setIsPinching(true);
    }
  };

  const handleTouchEnd = async (e) => {
    if (e.touches.length < 2) {
      initialPinchDist.current = 0;
      if (pinchTimeoutRef.current) clearTimeout(pinchTimeoutRef.current);
      pinchTimeoutRef.current = setTimeout(() => {
        setIsPinching(false);
      }, 1000);

      // Nếu người dùng chụm ngón tay thu về mức 0.5x trên cam sau
      if (zoomScale <= 0.6 && cameraMode === "environment" && zoomLevel !== "0.5x") {
        try {
          const cameras = await getAvailableCameras();
          if (cameras?.backUltraWideCamera?.deviceId) {
            setZoomLevel("0.5x");
            setZoomScale(1);
            setDeviceId(cameras.backUltraWideCamera.deviceId);
            setCameraActive(false);
            setTimeout(() => setCameraActive(true), 250);
            SonnerSuccess("Đã chuyển sang Camera 0.5x (Góc siêu rộng)");
          }
        } catch {}
      }
    }
  };

  // Ngăn chặn trình duyệt di động zoom cả trang web khi đang chụm 2 ngón tay trên camera
  useEffect(() => {
    const el = cameraContainerRef.current;
    if (!el) return;
    const onTouchMovePrevent = (e) => {
      if (e.touches.length === 2 && e.cancelable) {
        e.preventDefault();
      }
    };
    el.addEventListener("touchmove", onTouchMovePrevent, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMovePrevent);
  }, []);

  // Trạng thái mic khi quay video (mỗi khi vào web/app luôn mặc định TẮT theo yêu cầu)
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isPreviewMuted, setIsPreviewMuted] = useState(false);
  const [isFlashBursting, setIsFlashBursting] = useState(false);

  // Luôn reset mic về trạng thái TẮT mỗi khi vào app/web
  useEffect(() => {
    try {
      localStorage.setItem("setting_camera_mic_enabled", "false");
    } catch {}
  }, []);

  // Lắng nghe hiệu ứng chớp flash khi chụp ảnh
  useEffect(() => {
    const handleFlashBurst = () => {
      setIsFlashBursting(true);
      setTimeout(() => setIsFlashBursting(false), 220);
    };
    window.addEventListener("camera-flash-burst", handleFlashBurst);
    return () => window.removeEventListener("camera-flash-burst", handleFlashBurst);
  }, []);

  const toggleMic = async () => {
    if (isMicEnabled) {
      // Đang bật -> Tắt mic
      setIsMicEnabled(false);
      localStorage.setItem("setting_camera_mic_enabled", "false");
      SonnerInfo("Đã tắt Mic 🔇", "Video quay sẽ không có âm thanh");
      return;
    }

    // Đang tắt -> Bật mic: Kích hoạt ngay yêu cầu quyền microphone của trình duyệt / iOS
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Tắt ngay track sau khi xin quyền để không chiếm micro khi chưa bấm quay
        stream.getTracks().forEach((track) => track.stop());

        setIsMicEnabled(true);
        localStorage.setItem("setting_camera_mic_enabled", "true");
        SonnerSuccess("Đã bật Mic 🎙️", "Đã cấp quyền micro, video sẽ có âm thanh");
      } catch (err) {
        console.warn("Người dùng từ chối hoặc lỗi cấp quyền mic:", err);
        setIsMicEnabled(false);
        localStorage.setItem("setting_camera_mic_enabled", "false");
        SonnerWarning(
          "Chưa cấp quyền Micro",
          "Vui lòng chọn 'Cho phép' khi thiết bị hỏi quyền Micro để quay video có tiếng."
        );
      }
    } else {
      setIsMicEnabled(true);
      localStorage.setItem("setting_camera_mic_enabled", "true");
      SonnerSuccess("Đã bật Mic 🎙️", "Video quay sẽ có âm thanh");
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

    if (newVal) {
      if (cameraMode === "environment") {
        SonnerSuccess("Đã bật Flash ⚡", "Sẽ chớp đèn flash máy khi bấm chụp");
      } else {
        SonnerSuccess("Đã bật Flash ⚡", "Màn hình sẽ sáng rực khi bấm chụp");
      }
    } else {
      const videoTrack = streamRef.current?.getVideoTracks()?.[0];
      if (videoTrack) {
        applyTorchSafe(videoTrack, false);
      }
      SonnerInfo("Đã tắt Flash", "Chụp không đèn flash");
    }
  };

  const cameraFrame = useUIStore((s) => s.cameraFrame);
  const normalizedOverlayType =
    postOverlay?.type === "image_icon" || postOverlay?.type === "caption_icon"
      ? "caption_image"
      : postOverlay?.type === "image_gif"
        ? "caption_gif"
        : postOverlay?.type;
  const hasMedia = Boolean(preview) || Boolean(selectedFile);
  // Chỉ xuất hiện caption khi đã chụp ảnh xong hoặc quay video xong (hasMedia === true)
  const hasCaptionOverlay = hasMedia;

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

      if (deviceId) {
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

      const videoTrack = stream.getVideoTracks()?.[0];
      if (videoTrack) {
        updateCameraZoomCapabilities(videoTrack, cameraMode);
        if (Math.abs(zoomScale - 1) > 0.05) {
          applyHardwareZoom(zoomScale);
        }
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
    setZoomScale(1);
    const videoTrack = streamRef.current?.getVideoTracks()?.[0];
    if (videoTrack) {
      updateCameraZoomCapabilities(videoTrack, cameraMode);
    }
  }, [cameraMode]);

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

  const handleZoomButtonClick = () => {
    if (Math.abs(zoomScale - 1) > 0.05) {
      setZoomScale(1);
      applyHardwareZoom(1);
      SonnerInfo("Đã đặt lại zoom 1x");
    } else {
      handleCycleZoomCamera();
    }
  };

  return (
    <>
      <div
        ref={cameraContainerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className={`relative ${
          isPWA
            ? "pwa-camera-frame w-[92vw] max-w-[min(92vw,calc(100dvh-310px),414px)] aspect-square rounded-[40px]"
            : "w-[min(calc(100vw-24px),calc(100dvh-290px),400px)] aspect-square rounded-[48px]"
        } bg-gray-900 overflow-hidden transition-all duration-300 touch-none select-none shadow-2xl`}
      >
        {!preview && !selectedFile && cameraActive && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              transform: `${cameraMode === "user" ? "scaleX(-1)" : ""} ${
                !hasHardwareZoom && Math.abs(zoomScale - 1) > 0.05 ? `scale(${zoomScale})` : ""
              }`.trim(),
            }}
            className={`
              w-full h-full object-cover transition-transform duration-75 ease-out
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
            {/* Top Bar bên trong Camera (Mic góc trái, Zoom góc phải chuẩn Locket Real) */}
            <div className="absolute inset-x-0 top-4 px-4 z-30 pointer-events-none flex justify-between items-center text-xs font-semibold">
              {/* Nút Mic góc trên bên trái */}
              <button
                type="button"
                onClick={toggleMic}
                className={`pointer-events-auto h-9 w-9 rounded-full backdrop-blur-md flex items-center justify-center transition active:scale-90 shadow-md ${
                  isMicEnabled
                    ? "bg-emerald-500 text-white shadow-emerald-500/40 ring-1 ring-emerald-400"
                    : "bg-black/45 text-white/90 hover:bg-black/60"
                }`}
                title={isMicEnabled ? "Mic: Đang BẬT (Video có tiếng)" : "Mic: Đang TẮT (Video không tiếng)"}
                aria-label="Bật/Tắt Mic"
              >
                {isMicEnabled ? <Mic size={18} /> : <MicOff size={18} />}
              </button>

              {/* Nút Zoom góc trên bên phải */}
              <button
                onClick={handleZoomButtonClick}
                className="pointer-events-auto min-w-[36px] h-9 px-2.5 text-white font-bold text-xs rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center hover:bg-black/60 active:scale-90 transition shadow-sm"
                title={Math.abs(zoomScale - 1) > 0.05 ? "Nhấn để trở về 1x" : `Chế độ Zoom: ${zoomLevel}`}
              >
                {Math.abs(zoomScale - 1) > 0.05
                  ? `${zoomScale.toFixed(1)}x`
                  : zoomLevel}
              </button>
            </div>

            {/* Bottom Controls bên trong Camera (Flash góc trái, Filter góc phải chuẩn Locket Real) */}
            <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[70] flex items-center justify-between px-4">
              {/* Nút Flash góc dưới bên trái */}
              <button
                type="button"
                onClick={toggleFlash}
                className={`pointer-events-auto h-9 w-9 rounded-full backdrop-blur-md flex items-center justify-center transition active:scale-90 shadow-md ${
                  isFlashOn
                    ? "bg-amber-400 text-black shadow-amber-400/50 ring-2 ring-amber-300 scale-105"
                    : "bg-black/45 text-white/90 hover:bg-black/60"
                }`}
                title={isFlashOn ? "Đèn Flash: Đang BẬT" : "Đèn Flash: Đang TẮT"}
                aria-label="Bật/Tắt Flash"
              >
                <Zap
                  size={18}
                  className={isFlashOn ? "fill-black text-black" : "text-white"}
                />
              </button>

              {/* Nút Filter Sparkle góc dưới bên phải */}
              <button
                type="button"
                onClick={openAiFilterStudio}
                disabled={isAiGenerating}
                className={`pointer-events-auto h-9 w-9 rounded-full backdrop-blur-md flex items-center justify-center transition active:scale-90 shadow-md ${
                  selectedAiFilter
                    ? "bg-amber-400 text-black shadow-amber-400/50 ring-2 ring-amber-300 scale-105"
                    : "bg-black/45 text-white/90 hover:bg-black/60"
                }`}
                title="Bộ lọc & Hiệu ứng AI"
                aria-label="Bộ lọc AI"
              >
                <Sparkles size={18} />
              </button>
            </div>
          </>
        )}

        {/* Photobooth HUD: Top badge & Bottom status + 4-cell preview */}
        {showPhotobooth && !preview && !selectedFile && (
          <>
            {/* Top badge: Ảnh X/4 */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[70] pointer-events-none">
              <span className="bg-black/60 backdrop-blur-md text-white text-xs px-3.5 py-1 rounded-full font-semibold border border-white/10 shadow-lg">
                Ảnh {Math.min(photoboothPhotos.length + 1, 4)}/4
              </span>
            </div>

            {/* Bottom center: text + mini 4-cell layout preview box */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[70] flex flex-col items-center pointer-events-none select-none">
              <span className="text-white text-[13px] font-semibold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] mb-2">
                {isComposing
                  ? "Đang ghép 4 ảnh Photobooth…"
                  : `Chạm nút chụp • ảnh ${Math.min(photoboothPhotos.length + 1, 4)}/4`}
              </span>

              {/* Khung 4 ô photobooth mini */}
              <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-black/50 backdrop-blur-md border border-white/30 p-1 shadow-2xl">
                <div className="grid grid-cols-2 grid-rows-2 gap-1 w-full h-full">
                  {[0, 1, 2, 3].map((index) => {
                    const photo = photoboothPhotos[index];
                    const isCurrent = index === photoboothPhotos.length;
                    return (
                      <div
                        key={index}
                        className={`relative w-full h-full rounded-sm overflow-hidden flex items-center justify-center transition-all duration-200 ${
                          photo
                            ? "bg-black"
                            : isCurrent
                            ? "bg-white/30 ring-1 ring-white/60 animate-pulse"
                            : "bg-white/10"
                        }`}
                      >
                        {photo ? (
                          <img
                            src={photo.url}
                            alt={`Ảnh ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {/* Nếu có khung viền photobooth, phủ viền lên mini box */}
                {currentBoothFrame?.src && (
                  <img
                    src={currentBoothFrame.src}
                    alt=""
                    className="absolute inset-0 w-full h-full pointer-events-none object-cover"
                  />
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

        {/* Badge hiển thị mức zoom khi đang chụm phóng to/thu nhỏ */}
        {isPinching && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[85] bg-black/80 backdrop-blur-md text-amber-300 font-bold text-base px-4 py-1.5 rounded-full border border-amber-400/40 shadow-2xl flex items-center gap-1.5 animate-pulse">
            <span>🔍</span>
            <span>{zoomScale.toFixed(1)}x</span>
          </div>
        )}

        {/* Hiệu ứng chớp trắng toàn màn hình khi bấm chụp ảnh có flash */}
        {isFlashBursting && (
          <div className="absolute inset-0 z-[100] bg-white pointer-events-none transition-opacity duration-200" />
        )}

        {/* Frame overlay - always on top when selected, perfectly fitted to rounded container */}
        {cameraFrame?.imageSrc && (
          <div className="absolute inset-0 z-[60] pointer-events-none overflow-hidden rounded-[inherit]">
            <img
              src={cameraFrame.imageSrc}
              loading="lazy"
              alt="Khung viền camera"
              className="w-full h-full object-contain pointer-events-none select-none"
            />
          </div>
        )}
      </div>

      {/* Sáng toàn màn hình khi ấn chụp bằng camera trước (Screen Flash) - Rực sáng tối đa như Locket thật */}
      {isScreenFlashing && (
        <>
          {/* Lớp nền trắng chính - opacity 100%, z-index cực cao */}
          <div
            className="fixed inset-0 pointer-events-none"
            style={{
              zIndex: 2147483647,
              backgroundColor: '#FFFFFF',
              opacity: 1,
              animation: 'screenFlashIn 100ms ease-out forwards',
            }}
          />
          {/* Lớp phụ mix-blend-mode: screen để tăng thêm độ sáng */}
          <div
            className="fixed inset-0 pointer-events-none"
            style={{
              zIndex: 2147483646,
              backgroundColor: '#FFFFFF',
              opacity: 1,
              mixBlendMode: 'screen',
              animation: 'screenFlashIn 100ms ease-out forwards',
            }}
          />
          {/* Inject keyframes animation cho screen flash */}
          <style>{`
            @keyframes screenFlashIn {
              0% { opacity: 0.7; }
              100% { opacity: 1; }
            }
          `}</style>
        </>
      )}
    </>
  );
};

export default MediaPreview;
