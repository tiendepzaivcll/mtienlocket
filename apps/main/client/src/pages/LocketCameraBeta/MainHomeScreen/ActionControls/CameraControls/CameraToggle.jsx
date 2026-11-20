import React from "react";
import { useApp } from "@/context/AppContext";
import { RefreshCcw } from "lucide-react";
import { CONFIG } from "@/config";

const CameraToggle = () => {
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
    setZoomScale,
    isFlashOn,
  } = camera;

  const handleRotateCamera = async () => {
    setRotation((prev) => prev - 180);
    const newMode = cameraMode === "user" ? "environment" : "user";
    setCameraMode(newMode);
    // ✅ Reset deviceId để tránh bị giữ lại cam cũ (zoom cam)
    setZoomLevel("1x");
    setZoomScale(1);
    setDeviceId(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          if (typeof track.getCapabilities === "function" && track.getCapabilities()?.torch) {
            track.applyConstraints({ advanced: [{ torch: false }] });
          }
        } catch {}
        track.stop();
      });
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: newMode,
          ...CONFIG.app.camera.constraints.default,
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Lỗi khi đổi camera:", error);
    }
  };

  return (
    <>
      <button
        type="button"
        className="cursor-pointer active:scale-90 transition text-base-content"
        onClick={handleRotateCamera}
        aria-label="Đổi camera"
      >
        <RefreshCcw
          size={32}
          className="transition-transform duration-500"
          style={{ transform: `rotate(${rotation}deg)` }}
        />
      </button>
    </>
  );
};

export default CameraToggle;
