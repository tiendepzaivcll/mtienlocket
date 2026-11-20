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
      <button className="cursor-pointer" onClick={handleRotateCamera}>
        <RefreshCcw
          size={35}
          className="transition-transform duration-500 active:scale-95"
          style={{ transform: `rotate(${rotation}deg)` }}
        />
      </button>
    </>
  );
};

export default CameraToggle;
