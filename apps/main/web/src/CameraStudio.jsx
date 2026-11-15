import React, { useState, useEffect, useRef } from "react";
import { RefreshCcw, ImageUp, Send, X } from "lucide-react";

export default function CameraStudio() {
  // --- STATE QUẢN LÝ ---
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  
  const [cameraMode, setCameraMode] = useState("user"); // 'user' (trước) hoặc 'environment' (sau)
  const [isHolding, setIsHolding] = useState(false);
  const [preview, setPreview] = useState(null); // { type: 'image' | 'video', url: string, file: File }
  const [isUploading, setIsUploading] = useState(false);

  // --- 1. KHỞI ĐỘNG CAMERA ---
  const startCamera = async (mode = "user") => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode },
        audio: true, // Bật mic nếu muốn quay video có tiếng
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Lỗi Camera:", error);
      alert("Không thể mở camera. Vui lòng cấp quyền!");
    }
  };

  useEffect(() => {
    startCamera(cameraMode);
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    };
  }, [cameraMode]);

  // --- 2. XỬ LÝ NÚT CHỤP / QUAY ---
  let holdTimeout = null;

  const handlePointerDown = () => {
    holdTimeout = setTimeout(() => {
      // Nhấn giữ > 500ms => QUAY VIDEO
      setIsHolding(true);
      startRecording();
    }, 500);
  };

  const handlePointerUp = () => {
    clearTimeout(holdTimeout);
    if (isHolding) {
      // Đang quay thì DỪNG QUAY
      setIsHolding(false);
      stopRecording();
    } else {
      // Nhấn nhả nhanh => CHỤP ẢNH
      captureImage();
    }
  };

  const captureImage = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    
    // Lật ảnh nếu dùng cam trước
    if (cameraMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      const file = new File([blob], `locket_${Date.now()}.jpg`, { type: "image/jpeg" });
      setPreview({ type: "image", url: URL.createObjectURL(file), file });
    }, "image/jpeg", 0.9);
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;
    mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks = [];
    mediaRecorderRef.current.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const file = new File([blob], `locket_${Date.now()}.webm`, { type: "video/webm" });
      setPreview({ type: "video", url: URL.createObjectURL(file), file });
    };
    mediaRecorderRef.current.start();
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  // --- 3. UPLOAD FILE TỪ MÁY ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reject files above the configured upload limit.
    if (file.size > 40 * 1024 * 1024) {
      alert("File quá lớn. Kích thước tối đa là 40MB.");
      e.target.value = "";
      return;
    }

    const type = file.type.startsWith("video/") ? "video" : "image";
    setPreview({ type, url: URL.createObjectURL(file), file });
  };

  // --- 4. GỬI LÊN CLOUDFLARE R2 (Cổng 5003) ---
  const uploadToCloud = async () => {
    if (!preview?.file) return;
    if (preview.file.size > 40 * 1024 * 1024) {
      alert("File tải lên phải nhỏ hơn 40MB.");
      return;
    }
    setIsUploading(true);
    try {
      const storageApiUrl = import.meta.env.VITE_STORAGE_API_URL;
      if (!storageApiUrl) {
        throw new Error("VITE_STORAGE_API_URL chưa được cấu hình");
      }

      const res = await fetch(`${storageApiUrl.replace(/\/$/, "")}/api/presignedV3`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: preview.file.name,
          contentType: preview.file.type,
          type: preview.type
        })
      });
      const data = await res.json();
      
      if (!data.data?.url) throw new Error("Không lấy được link upload R2");

      await fetch(data.data.url, {
        method: "PUT",
        headers: { "Content-Type": preview.file.type },
        body: preview.file
      });

      alert(`Tải lên thành công!\nLink công khai:\n${data.data.publicURL}`);
      setPreview(null);
    } catch (error) {
      console.error(error);
      alert("Lỗi tải lên: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden flex flex-col items-center justify-center">
      
      {/* KHUNG HIỂN THỊ CAMERA HOẶC PREVIEW */}
      <div className="relative w-full max-w-md aspect-[3/4] bg-gray-900 rounded-3xl overflow-hidden shadow-2xl">
        {!preview ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${cameraMode === "user" ? "scale-x-[-1]" : ""}`}
          />
        ) : preview.type === "image" ? (
          <img src={preview.url} alt="Preview" className="w-full h-full object-cover" />
        ) : (
          <video src={preview.url} autoPlay loop playsInline className="w-full h-full object-cover" />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* CỤM NÚT ĐIỀU KHIỂN BÊN DƯỚI */}
      <div className="absolute bottom-10 w-full max-w-md px-6 flex justify-evenly items-center">
        
        {/* NẾU CHƯA CHỤP -> HIỆN 3 NÚT CAMERA */}
        {!preview ? (
          <>
            {/* Nút 1: Upload File */}
            <label className="cursor-pointer active:scale-95 text-white bg-white/20 p-4 rounded-full backdrop-blur-md">
              <input type="file" accept="image/*,video/*" onChange={handleFileUpload} className="hidden" />
              <ImageUp size={30} />
            </label>

            {/* Nút 2: Nút Chụp / Quay (Giữ nguyên class CSS của Locket) */}
            <button
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className="relative flex items-center justify-center w-24 h-24 active:scale-95"
              style={{ touchAction: "manipulation" }}
            >
              <div className={`absolute w-20 h-20 border-4 border-amber-400 rounded-full z-10 transition-all ${isHolding ? "scale-110" : ""}`}></div>
              <div className={`absolute bg-white rounded-full z-0 transition-all duration-300 ${isHolding ? "w-12 h-12 bg-red-500" : "w-16 h-16"}`}></div>
            </button>

            {/* Nút 3: Lật Camera */}
            <button
              onClick={() => setCameraMode(p => p === "user" ? "environment" : "user")}
              className="cursor-pointer active:scale-95 text-white bg-white/20 p-4 rounded-full backdrop-blur-md"
            >
              <RefreshCcw size={30} />
            </button>
          </>
        ) : (
          
          /* NẾU ĐÃ CHỤP XONG -> HIỆN NÚT GỬI VÀ HỦY */
          <>
            <button
              onClick={() => setPreview(null)}
              className="cursor-pointer active:scale-95 text-white bg-red-500/80 p-4 rounded-full backdrop-blur-md"
            >
              <X size={30} />
            </button>

            <button
              onClick={uploadToCloud}
              disabled={isUploading}
              className="cursor-pointer active:scale-95 text-black bg-amber-400 p-5 rounded-full backdrop-blur-md shadow-xl flex items-center gap-2 font-bold"
            >
              {isUploading ? "Đang Upload..." : <><Send size={28} /> ĐĂNG LÊN</>}
            </button>
          </>
        )}

      </div>
    </div>
  );
}
