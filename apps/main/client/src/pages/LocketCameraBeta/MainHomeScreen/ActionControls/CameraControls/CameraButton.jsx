import "./styles.css";
import React, { useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { getVideoRecordLimit } from "@/hooks/useFeature";
import { CAMERA_CONFIG } from "@/config/configAlias";
import { detectAppEnvironment } from "@/utils/logic/checkIfRunningAsPWA";
import { SonnerError, SonnerInfo } from "@/components/ui/SonnerToast";
import { useCameraCaptureMode } from "@/hooks/useCameraCaptureMode";
import { usePhotoboothStore } from "@/stores";
import { PHOTOBOOTH_FRAMES } from "@/data/photoboothFrames";
import { capturePhotoboothFrame, composePhotoboothGrid } from "@/utils/photobooth";
import { defaultPostOverlay } from "@/stores/usePost.js";

const CameraButton = () => {
  const { camera, post, useloading, navigation } = useApp();
  const { showPhotobooth, selectedFrameId, chooseCaptureMode } = useCameraCaptureMode();
  const photoboothPhotos = usePhotoboothStore((state) => state.photos);
  const isComposing = usePhotoboothStore((state) => state.isComposing);
  const addPhoto = usePhotoboothStore((state) => state.addPhoto);
  const clearPhotos = usePhotoboothStore((state) => state.clearPhotos);
  const setComposing = usePhotoboothStore((state) => state.setComposing);
  const {
    videoRef,
    streamRef,
    canvasRef,
    cameraRef,
    rotation,
    isHolding,
    setIsHolding,
    permissionChecked,
    setPermissionChecked,
    holdTime,
    setHoldTime,
    setRotation,
    cameraMode,
    setCameraMode,
    cameraActive,
    setCameraActive,
    setLoading,
    setDeviceId,
    setZoomLevel,
    isFlashOn,
    zoomScale,
    hasHardwareZoom,
    isScreenFlashing,
    setIsScreenFlashing,
  } = camera;
  const { preview, setPreview, setSelectedFile, setSizeMedia, setPostOverlay } = post;
  const { setIsCaptionLoading, uploadLoading, setUploadLoading } = useloading;

  const holdStartTimeRef = useRef(null);
  const holdTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const micStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const intervalRef = useRef(null);
  const isTryingToRecordRef = useRef(false);
  const isRecordingRef = useRef(false);

  const MAX_RECORD_TIME = getVideoRecordLimit();

  const stopCamera = () => {
    console.log("Hello đang test camera à babi");
  };

  const startHold = (e) => {
    // Prevent default để tránh conflict trên iOS
    e.preventDefault();
    if (showPhotobooth) return;

    // Chặn mouse events trùng với touch events trên thiết bị cảm ứng
    if (e.type === "mousedown" && e.nativeEvent?.sourceCapabilities?.firesTouchEvents) return;
    // Nếu đang xử lý rồi thì bỏ qua (tránh double-fire)
    if (isTryingToRecordRef.current) return;

    isTryingToRecordRef.current = true;
    isRecordingRef.current = false; // Reset recording state
    holdStartTimeRef.current = Date.now();

    holdTimeoutRef.current = setTimeout(async () => {
      if (!isTryingToRecordRef.current) return;

      // Đánh dấu đang recording
      isRecordingRef.current = true;
      setIsHolding(true);

      // Bật đèn flash torch khi quay video cam sau nếu bật flash
      if (isFlashOn && cameraMode === "environment") {
        const vTrack = streamRef.current?.getVideoTracks()?.[0];
        if (vTrack && typeof vTrack.getCapabilities === "function" && vTrack.getCapabilities()?.torch) {
          vTrack.applyConstraints({ advanced: [{ torch: true }] }).catch(() => {});
        }
      }

      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        SonnerInfo("Camera chưa sẵn sàng, vui lòng chờ giây lát...");
        isTryingToRecordRef.current = false;
        setIsHolding(false);
        return;
      }

      // Tạo canvas vuông
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const side = Math.min(video.videoWidth, video.videoHeight);
      const outputSize = CAMERA_CONFIG.videoResolutionPx;
      canvas.width = outputSize;
      canvas.height = outputSize;

      // FPS 30 chuẩn video mượt mà, chống tràn RAM và chống reload trang trên iOS Safari
      const targetFPS = 30;
      const canvasStream = canvas.captureStream(targetFPS);

      // Kết hợp video từ canvas và âm thanh từ Micro
      const combinedStream = new MediaStream();
      canvasStream.getVideoTracks().forEach((track) => combinedStream.addTrack(track));

      let micStream = null;
      const isMicEnabled = localStorage.getItem("setting_camera_mic_enabled") === "true"; // Mic luôn tắt mặc định, chỉ thu khi người dùng chủ động bật mic

      if (isMicEnabled && navigator.mediaDevices?.getUserMedia) {
        try {
          // Tắt triệt để echoCancellation, noiseSuppression và autoGainControl
          // để ép iPhone/Android thu âm nguyên bản chất lượng cao như app Locket native, KHÔNG bị tự động dìm/bóp âm thanh
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            },
          });
        } catch (audioErr) {
          try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          } catch (fallbackErr) {
            console.warn("⚠️ Không thể truy cập mic, quay video im lặng:", fallbackErr);
          }
        }

        if (micStream) {
          micStreamRef.current = micStream;
          let trackToAdd = micStream.getAudioTracks()[0];

          // Dùng Web Audio GainNode khuếch đại âm lượng 1.8x cố định, tuyệt đối không bị bóp nghẹt
          try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
              const audioCtx = new AudioCtx();
              if (audioCtx.state === "suspended") {
                await audioCtx.resume();
              }
              const source = audioCtx.createMediaStreamSource(micStream);
              const gainNode = audioCtx.createGain();
              gainNode.gain.value = 1.8; // Tăng âm lượng 1.8x cố định
              const dest = audioCtx.createMediaStreamDestination();
              source.connect(gainNode);
              gainNode.connect(dest);
              trackToAdd = dest.stream.getAudioTracks()[0];
              audioContextRef.current = audioCtx;
            }
          } catch (gainErr) {
            console.warn("⚠️ GainNode fallback:", gainErr);
          }

          if (trackToAdd) {
            combinedStream.addTrack(trackToAdd);
            console.log("🎙️ Đã kết nối Microphone (thuần khiết, gain 1.8x, không AGC) vào luồng ghi hình");
          }
        }
      }

      console.log(
        `🎥 Recording mode: ${detectAppEnvironment() ? "PWA" : "Web"}, FPS: ${
          targetFPS || "auto"
        }, Audio: ${micStream ? "ON (có tiếng)" : "OFF"}`
      );

      // Thử các MIME type khác nhau có hỗ trợ audio
      let mimeType = "video/webm;codecs=vp8,opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm";
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = "video/mp4";
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ""; // Để MediaRecorder tự chọn
          }
        }
      }

      // Cấu hình recorder options với bitrate tối ưu: siêu nét nhưng file nhẹ (~3-4MB cho 15s), upload lên R2 cực nhanh
      const recorderOptions = mimeType ? { mimeType } : {};
      if (mimeType) {
        recorderOptions.videoBitsPerSecond = 2500000; // 2.5 Mbps: Nét chuẩn HD, nhẹ, upload 1-2s
        if (micStream) recorderOptions.audioBitsPerSecond = 96000;
      }

      const recorder = new MediaRecorder(combinedStream, recorderOptions);
      mediaRecorderRef.current = recorder;

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        console.log("📹 Video recording stopped, chunks:", chunks.length);

        if (audioContextRef.current) {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }

        if (micStreamRef.current) {
          micStreamRef.current.getTracks().forEach((track) => track.stop());
          micStreamRef.current = null;
        }
        if (micStream) {
          micStream.getTracks().forEach((track) => track.stop());
        }

        if (chunks.length === 0) {
          console.error("No video data captured");
          return;
        }

        // Tắt torch sau khi dừng quay video
        if (cameraMode === "environment") {
          const vTrack = streamRef.current?.getVideoTracks()?.[0];
          if (vTrack && typeof vTrack.getCapabilities === "function" && vTrack.getCapabilities()?.torch) {
            vTrack.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
          }
        }

        // Tạo blob với MIME type phù hợp
        const finalMimeType = mimeType || "video/mp4";
        const blob = new Blob(chunks, { type: finalMimeType });

        // Tạo file name với extension phù hợp
        const extension = finalMimeType.includes("webm") ? "webm" : "mp4";
        const file = new File([blob], `t97.${extension}`, {
          type: finalMimeType,
        });

        console.log("📹 Video file created:", {
          size: file.size,
          type: file.type,
          name: file.name,
          environment: detectAppEnvironment() ? "PWA" : "Web",
        });

        const videoUrl = URL.createObjectURL(file);
        const fileSizeInMB = file.size / (1024 * 1024);

        setSizeMedia(fileSizeInMB.toFixed(2));
        setPreview({ type: "video", data: videoUrl });
        setSelectedFile(file);
        setPostOverlay(defaultPostOverlay);
        setCameraActive(false);
        setIsCaptionLoading(true);
        stopCamera();
        setLoading(false);

        // Reset states
        isRecordingRef.current = false;
        setIsHolding(false);
      };

      recorder.onerror = (e) => {
        console.error("MediaRecorder error:", e);
        isRecordingRef.current = false;
        setIsHolding(false);
      };

      try {
        recorder.start();
        console.log(
          "📹 Started recording with MIME type:",
          mimeType || "default"
        );
      } catch (error) {
        console.error("Failed to start recording:", error);
        isRecordingRef.current = false;
        setIsHolding(false);
        return;
      }

      // Hàm vẽ mỗi frame vào canvas với FPS control cho PWA
      let lastFrameTime = 0;
      const frameInterval = detectAppEnvironment() ? 1000 / 45 : 0; // 45fps cho PWA, unlimited cho web

      const drawFrame = (currentTime) => {
        if (video.paused || video.ended || recorder.state !== "recording") {
          return;
        }

        // Kiểm tra frame rate cho PWA
        if (
          detectAppEnvironment() &&
          currentTime - lastFrameTime < frameInterval
        ) {
          if (recorder.state === "recording") {
            requestAnimationFrame(drawFrame);
          }
          return;
        }

        lastFrameTime = currentTime;

        ctx.save();

        if (cameraMode === "user") {
          ctx.translate(outputSize, 0);
          ctx.scale(-1, 1);
        }

        const effectiveScale = (!hasHardwareZoom && Math.abs(zoomScale - 1) > 0.05) ? zoomScale : 1;
        const cropSide = Math.min(side / effectiveScale, Math.min(video.videoWidth, video.videoHeight));
        const sx = (video.videoWidth - cropSide) / 2;
        const sy = (video.videoHeight - cropSide) / 2;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(video, sx, sy, cropSide, cropSide, 0, 0, outputSize, outputSize);

        ctx.restore();

        if (recorder.state === "recording") {
          requestAnimationFrame(drawFrame);
        }
      };

      requestAnimationFrame(drawFrame);

      // Auto stop sau MAX_RECORD_TIME
      setTimeout(() => {
        if (recorder.state === "recording") {
          console.log("📹 Auto stopping recording after max time");
          recorder.stop();
        }
      }, MAX_RECORD_TIME * 1000);
    }, 600);
  };

  const capturePhotoboothStep = async () => {
    if (isComposing) return;
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      SonnerInfo("Camera chưa sẵn sàng, vui lòng chờ giây lát...");
      return;
    }

    const videoTrack = streamRef.current?.getVideoTracks()?.[0];
    let torchTurnedOnByCapture = false;

    // 1. Flash nếu đang bật
    if (isFlashOn) {
      if (cameraMode === "environment") {
        try {
          if (videoTrack && typeof videoTrack.getCapabilities === "function" && videoTrack.getCapabilities()?.torch) {
            await videoTrack.applyConstraints({ advanced: [{ torch: true }] });
            torchTurnedOnByCapture = true;
            await new Promise((r) => setTimeout(r, 160));
          } else {
            window.dispatchEvent(new CustomEvent("camera-flash-burst"));
            await new Promise((r) => setTimeout(r, 80));
          }
        } catch (err) {
          console.warn("Lỗi bật torch cam sau:", err);
        }
      } else if (cameraMode === "user") {
        setIsScreenFlashing(true);
        await new Promise((r) => setTimeout(r, 350));
      }
    }

    try {
      // 2. Chụp khung hình vuông từ video
      const photoFile = await capturePhotoboothFrame(video, {
        mirror: cameraMode === "user",
        size: CAMERA_CONFIG.imageSizePx || 1920,
      });
      const photoUrl = URL.createObjectURL(photoFile);

      const nextPhotos = addPhoto({ blob: photoFile, url: photoUrl });

      // Nếu đã chụp đủ 4 ảnh: tự động ghép và hiển thị sang màn hình gửi Locket
      if (nextPhotos.length >= 4) {
        setComposing(true);
        try {
          const selectedFrame = PHOTOBOOTH_FRAMES.find((f) => f.id === selectedFrameId) || null;
          const frameOption = selectedFrame?.src ? selectedFrame : null;

          const composedFile = await composePhotoboothGrid(
            nextPhotos.map((p) => p.blob),
            {
              frame: frameOption,
              size: 1920,
            }
          );
          const composedUrl = URL.createObjectURL(composedFile);

          const fileSizeInMB = (composedFile.size / (1024 * 1024)).toFixed(2);
          setSizeMedia(fileSizeInMB);
          setPreview({ type: "image", data: composedUrl });
          setSelectedFile(composedFile);
          setIsCaptionLoading(true);
          setCameraActive(false);

          // Thoát Photobooth mode
          clearPhotos();
          chooseCaptureMode(false);
        } catch (composeErr) {
          console.error("Lỗi tự động ghép ảnh Photobooth:", composeErr);
          SonnerError("Không thể ghép ảnh Photobooth. Vui lòng thử lại!");
          setComposing(false);
        }
      }
    } catch (err) {
      console.error("Lỗi chụp ảnh Photobooth:", err);
      SonnerError(err.message || "Không thể chụp ảnh Photobooth.");
    } finally {
      // 3. Tắt Flash
      if (isFlashOn) {
        if (cameraMode === "environment" && torchTurnedOnByCapture && videoTrack) {
          try {
            await videoTrack.applyConstraints({ advanced: [{ torch: false }] });
          } catch (e) {}
        } else if (cameraMode === "user") {
          setTimeout(() => setIsScreenFlashing(false), 150);
        }
      }
    }
  };

  const endHold = (e) => {
    // Prevent default để tránh conflict trên iOS
    e.preventDefault();

    // Chặn mouse events trùng với touch events trên thiết bị cảm ứng
    if (e.type?.startsWith("mouse") && e.nativeEvent?.sourceCapabilities?.firesTouchEvents) return;

    // Nếu không có hold nào đang active thì bỏ qua (tránh double-fire)
    if (!isTryingToRecordRef.current && !isHolding && !isRecordingRef.current) return;

    if (showPhotobooth) {
      if (isComposing) return;
      capturePhotoboothStep();
      return;
    }

    const heldTime = Date.now() - (holdStartTimeRef.current || Date.now());

    // Clear timeouts
    clearTimeout(holdTimeoutRef.current);
    clearInterval(intervalRef.current);
    setHoldTime(heldTime);

    // Đánh dấu không còn trying to record
    isTryingToRecordRef.current = false;

    // Nếu đang trong quá trình recording
    if (
      isRecordingRef.current &&
      mediaRecorderRef.current?.state === "recording"
    ) {
      console.log("📹 Stopping video recording manually");
      mediaRecorderRef.current.stop();
      return; // Không chụp ảnh
    }

    // Nếu đã timeout và đang holding nhưng chưa bắt đầu record
    if (isHolding && !isRecordingRef.current) {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
        micStreamRef.current = null;
      }
      setIsHolding(false);
      return;
    }

    // Nếu không quay video (nhấn giữ < 600ms), tiến hành chụp ảnh
    if (!isRecordingRef.current) {
      captureImage();
    }
  };

  const captureImage = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const videoTrack = streamRef.current?.getVideoTracks()?.[0];
    let torchTurnedOnByCapture = false;

    // 1. Kích hoạt Flash trước khi chụp
    if (isFlashOn) {
      if (cameraMode === "environment") {
        // Cam sau: Bật đèn flash LED vật lý soi sáng khung cảnh
        try {
          if (videoTrack && typeof videoTrack.getCapabilities === "function" && videoTrack.getCapabilities()?.torch) {
            await videoTrack.applyConstraints({ advanced: [{ torch: true }] });
            torchTurnedOnByCapture = true;
            // Đợi 160ms để đèn LED sáng và cảm biến máy thích ứng độ sáng
            await new Promise((r) => setTimeout(r, 160));
          } else {
            // Hiệu ứng chớp màn hình nếu thiết bị không có torch LED
            window.dispatchEvent(new CustomEvent("camera-flash-burst"));
            await new Promise((r) => setTimeout(r, 80));
          }
        } catch (err) {
          console.warn("Lỗi bật torch cam sau:", err);
        }
      } else if (cameraMode === "user") {
        // Cam trước: Toàn màn hình sáng trắng rực rỡ tối đa để chiếu sáng mặt (giống Locket thật)
        setIsScreenFlashing(true);
        // Đợi 350ms để khuôn mặt được chiếu sáng rõ nét tối đa trước khi chụp
        await new Promise((r) => setTimeout(r, 350));
      }
    }

    try {
      const ctx = canvas.getContext("2d");
      const baseSide = Math.min(video.videoWidth, video.videoHeight);
      // Zoom kỹ thuật số nếu không có hardware zoom và zoomScale !== 1
      const effectiveScale = (!hasHardwareZoom && Math.abs(zoomScale - 1) > 0.05) ? zoomScale : 1;
      const cropSide = Math.min(baseSide / effectiveScale, Math.min(video.videoWidth, video.videoHeight));

      const sx = (video.videoWidth - cropSide) / 2;
      const sy = (video.videoHeight - cropSide) / 2;

      // Giữ độ phân giải sắc nét Full HD chuẩn cảm biến (1080px đến 1920px), chống upscale làm mờ
      const captureOutputSize = Math.min(CAMERA_CONFIG.imageSizePx, Math.max(cropSide, 1080));
      canvas.width = captureOutputSize;
      canvas.height = captureOutputSize;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      ctx.save();
      if (cameraMode === "user") {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, sx, sy, cropSide, cropSide, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const file = new File([blob], "t97.jpg", {
              type: "image/jpeg",
            });
            const imgUrl = URL.createObjectURL(file);
            setPreview({ type: "image", data: imgUrl });

            const fileSizeInMB = file.size / (1024 * 1024);
            setSizeMedia(fileSizeInMB.toFixed(2));

            setSelectedFile(file);
            setPostOverlay(defaultPostOverlay);
            setIsCaptionLoading(true);
            setCameraActive(false);
          }
        },
        "image/jpeg",
        0.96
      );

      // Fix iOS
      setTimeout(() => {
        const videoEl = document.querySelector("video");
        if (videoEl) videoEl.setAttribute("playsinline", "true");
      }, 100);
    } finally {
      // 3. Tắt Flash ngay sau khi chụp xong để trở lại bình thường
      if (isFlashOn) {
        if (cameraMode === "environment" && torchTurnedOnByCapture && videoTrack) {
          try {
            await videoTrack.applyConstraints({ advanced: [{ torch: false }] });
          } catch (e) {}
        } else if (cameraMode === "user") {
          // Giữ sáng thêm chút rồi tắt mượt (fade-out tự nhiên)
          setTimeout(() => setIsScreenFlashing(false), 150);
        }
      }
    }
  };

  // Cleanup khi component unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      clearTimeout(holdTimeoutRef.current);
      clearInterval(intervalRef.current);
    };
  }, []);

  if (showPhotobooth) {
    return (
      <button
        type="button"
        onClick={capturePhotoboothStep}
        disabled={isComposing}
        className="relative flex items-center justify-center w-24 h-24 active:scale-95 transition"
        style={{
          touchAction: "manipulation",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
        aria-label="Chụp ảnh Photobooth"
      >
        {/* Vòng tròn viền xanh cyan phát sáng */}
        <div className="absolute w-20 h-20 rounded-full border-[3.5px] border-cyan-400 shadow-[0_0_22px_rgba(34,211,238,0.7)] animate-pulse" />

        {/* Nút tròn màu trắng ở giữa */}
        <div className="absolute w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-lg transition active:scale-90">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-black"
          >
            <rect width="14" height="20" x="5" y="2" rx="3" />
            <line x1="5" x2="19" y1="8" y2="8" />
            <line x1="5" x2="19" y1="14" y2="14" />
          </svg>
        </div>
      </button>
    );
  }

  return (
    <>
      <button
        onMouseDown={startHold}
        onMouseUp={endHold}
        onMouseLeave={(e) => {
          // Chỉ cancel recording khi mouse thật sự rời nút (không chụp ảnh)
          if (isTryingToRecordRef.current || isRecordingRef.current || isHolding) {
            clearTimeout(holdTimeoutRef.current);
            clearInterval(intervalRef.current);
            isTryingToRecordRef.current = false;
            if (mediaRecorderRef.current?.state === "recording") {
              mediaRecorderRef.current.stop();
            } else {
              setIsHolding(false);
            }
          }
        }}
        onTouchStart={startHold}
        onTouchEnd={endHold}
        // Thêm các event cho iOS
        onTouchCancel={(e) => {
          e.preventDefault();
          clearTimeout(holdTimeoutRef.current);
          clearInterval(intervalRef.current);
          isTryingToRecordRef.current = false;
          if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
          } else {
            setIsHolding(false);
          }
        }}
        onContextMenu={(e) => e.preventDefault()} // Prevent long press menu on iOS
        className="relative flex items-center justify-center w-24 h-24 active:scale-95 transition-transform duration-150"
        style={{
          touchAction: "manipulation", // Improve touch response on iOS
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        <div
          className={`absolute w-20 h-20 rounded-full z-10 border-camera-custome pointer-events-none transition-transform duration-300 ${
            isHolding ? "animate-borderExpand" : ""
          }`}
        ></div>
        <div
          className={`absolute rounded-full z-0 transition-all duration-300 shadow-md ${
            navigation?.isPWA
              ? `w-16 h-16 bg-white ${isHolding ? "scale-75 opacity-90" : "scale-100 opacity-100"}`
              : `btn w-19 h-19 bg-white border-0 ${isHolding ? "scale-77 opacity-90" : "scale-100 opacity-100"}`
          }`}
        ></div>
      </button>
    </>
  );
};

export default CameraButton;
