import "./styles.css";
import React, { useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { getVideoRecordLimit } from "@/hooks/useFeature";
import { CAMERA_CONFIG } from "@/config/configAlias";
import { detectAppEnvironment } from "@/utils/logic/checkIfRunningAsPWA";
import { SonnerInfo } from "@/components/ui/SonnerToast";

const CameraButton = () => {
  const { camera, post, useloading } = useApp();
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
  } = camera;
  const { preview, setPreview, setSelectedFile, setSizeMedia } = post;
  const { setIsCaptionLoading, uploadLoading, setUploadLoading } = useloading;

  const holdStartTimeRef = useRef(null);
  const holdTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const micStreamRef = useRef(null);
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

    isTryingToRecordRef.current = true;
    isRecordingRef.current = false; // Reset recording state
    holdStartTimeRef.current = Date.now();

    holdTimeoutRef.current = setTimeout(async () => {
      if (!isTryingToRecordRef.current) return;

      // Đánh dấu đang recording
      isRecordingRef.current = true;
      setIsHolding(true);

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

      // Điều chỉnh FPS dựa trên môi trường
      const targetFPS = detectAppEnvironment() ? 45 : undefined; // PWA: 45fps, Web: tự động
      const canvasStream = targetFPS
        ? canvas.captureStream(targetFPS)
        : canvas.captureStream();

      // Kết hợp video từ canvas và âm thanh từ Micro
      const combinedStream = new MediaStream();
      canvasStream.getVideoTracks().forEach((track) => combinedStream.addTrack(track));

      let micStream = null;
      const isMicEnabled = localStorage.getItem("setting_camera_mic_enabled") !== "false"; // Mặc định bật mic

      if (isMicEnabled && navigator.mediaDevices?.getUserMedia) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          micStream.getAudioTracks().forEach((track) => combinedStream.addTrack(track));
          micStreamRef.current = micStream;
          console.log("🎙️ Đã kết nối Microphone vào luồng ghi hình");
        } catch (audioErr) {
          console.warn("⚠️ Không thể truy cập mic, quay video im lặng:", audioErr);
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

      // Cấu hình recorder options với bitrate phù hợp cho PWA
      const recorderOptions = mimeType ? { mimeType } : {};
      if (detectAppEnvironment() && mimeType) {
        recorderOptions.videoBitsPerSecond = 8000000; // 8 Mbps cho FullHD
        if (micStream) recorderOptions.audioBitsPerSecond = 128000;
      } else if (mimeType) {
        recorderOptions.videoBitsPerSecond = 12000000; // 12 Mbps cho FullHD
        if (micStream) recorderOptions.audioBitsPerSecond = 128000;
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

        const sx = (video.videoWidth - side) / 2;
        const sy = (video.videoHeight - side) / 2;
        ctx.drawImage(video, sx, sy, side, side, 0, 0, outputSize, outputSize);

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

  const endHold = (e) => {
    // Prevent default để tránh conflict trên iOS
    e.preventDefault();

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

  const captureImage = () => {
    if (isFlashOn) {
      window.dispatchEvent(new CustomEvent("camera-flash-burst"));
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    canvas.width = CAMERA_CONFIG.imageSizePx;
    canvas.height = CAMERA_CONFIG.imageSizePx;

    let sx = 0,
      sy = 0,
      sw = video.videoWidth,
      sh = video.videoHeight;

    if (video.videoWidth > video.videoHeight) {
      const offset = (video.videoWidth - video.videoHeight) / 2;
      sx = offset;
      sw = video.videoHeight;
    } else {
      const offset = (video.videoHeight - video.videoWidth) / 2;
      sy = offset;
      sh = video.videoWidth;
    }

    if (cameraMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

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
          setIsCaptionLoading(true);
          setCameraActive(false);
        }
      },
      "image/jpeg",
      1.0
    );

    // Fix iOS
    setTimeout(() => {
      const videoEl = document.querySelector("video");
      if (videoEl) videoEl.setAttribute("playsinline", "true");
    }, 100);
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

  return (
    <>
      <button
        onMouseDown={startHold}
        onMouseUp={endHold}
        onMouseLeave={endHold}
        onTouchStart={startHold}
        onTouchEnd={endHold}
        // Thêm các event cho iOS
        onTouchCancel={endHold}
        onContextMenu={(e) => e.preventDefault()} // Prevent long press menu on iOS
        className="relative flex items-center justify-center w-24 h-24 active:scale-97"
        style={{
          touchAction: "manipulation", // Improve touch response on iOS
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        <div
          className={`absolute w-20 h-20 border-camera-custome text-primary/80 rounded-full z-10 ${
            isHolding ? "animate-borderExpand" : ""
          }`}
        ></div>
        <div
          className={`absolute rounded-full btn w-19 h-19 camera-inner-circle z-0 transition-all duration-500 ${
            isHolding ? "scale-77 opacity-90" : "scale-100 opacity-100"
          }`}
        ></div>
      </button>
    </>
  );
};

export default CameraButton;
