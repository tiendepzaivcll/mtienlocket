import { Camera, Check, Crown, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAllFrameCamera } from "@/services";
import { useUIStore, useAuthStore } from "@/stores";
import { CAMERA_FRAMES } from "@/data/cameraFrames";

export default function CameraFrameSelector() {
  const [frames, setFrames] = useState([{ id: 0, name: "Không có", imageSrc: null }, ...CAMERA_FRAMES]);
  const navigate = useNavigate();
  const accessRole = useAuthStore((s) => s.accessRole);
  const isVip = accessRole === "vip";

  const setCameraFrame = useUIStore((s) => s.setCameraFrame);
  const cameraFrame = useUIStore((s) => s.cameraFrame);

  useEffect(() => {
    const fetchFrames = async () => {
      try {
        const result = await getAllFrameCamera();
        // Thêm frame mặc định vào đầu danh sách
        const apiFrames = result || [];
        const defaultFrame = { id: 0, name: "Không có", imageSrc: null };

        const localIds = new Set(CAMERA_FRAMES.map((frame) => String(frame.id)));
        setFrames([defaultFrame, ...CAMERA_FRAMES, ...apiFrames.filter((frame) => frame.id !== 0 && !localIds.has(String(frame.id)))]);
      } catch (err) {
        console.error("Lỗi khi lấy danh sách khung:", err);
        // Nếu lỗi API, vẫn hiển thị frame mặc định
        setFrames([{ id: 0, name: "Không có", imageSrc: null }, ...CAMERA_FRAMES]);
      }
    };

    fetchFrames();
  }, []);

  // Khung camera chỉ dành cho VIP
  if (!isVip) {
    return (
      <div className="w-full">
        <div className="flex items-center mb-4 text-base-content">
          <Camera className="w-5 h-5 mr-2" />
          <h2 className="text-lg font-semibold">Chọn Khung Camera</h2>
          <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-yellow-400 to-orange-500 text-black">
            <Crown className="w-3 h-3" /> VIP
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mb-3">
            <Lock className="w-8 h-8 text-yellow-500" />
          </div>
          <p className="text-base-content/70 text-sm mb-3">
            Khung camera là tính năng dành riêng cho VIP
          </p>
          <button
            onClick={() => navigate("/pricing")}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold text-sm hover:opacity-90 transition"
          >
            <Crown className="w-4 h-4 inline mr-1 -mt-0.5" />
            Nâng cấp VIP
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center mb-4 text-base-content">
        <Camera className="w-5 h-5 mr-2" />
        <h2 className="text-lg font-semibold">Chọn Khung Camera</h2>
      </div>

      {/* Preview khung đã chọn */}
      <div className="flex justify-center mb-4">
        <div className="relative">
          {/* Camera preview */}
          <div className="w-32 h-32 bg-gray-200 rounded-3xl flex items-center justify-center overflow-hidden">
            <Camera className="w-8 h-8 text-gray-400" />
          </div>

          {/* Frame overlay nếu có */}
          {cameraFrame?.imageSrc && (
            <div className="absolute inset-0 pointer-events-none">
              <img
                src={cameraFrame.imageSrc}
                alt={cameraFrame.name}
                className="w-full h-full object-cover rounded-3xl"
                onError={(e) => (e.target.style.display = "none")}
              />
            </div>
          )}
        </div>
      </div>

      {/* Tên frame hiện tại */}
      <div className="text-center mb-4">
        <span className="text-sm font-medium text-base-content/80">
          {cameraFrame?.name || "Chưa chọn khung"}
        </span>
      </div>

      {/* Danh sách frame */}
      <div className="grid grid-cols-4 gap-3">
        {frames.map((frame) => (
          <button
            key={frame.id}
            onClick={() => setCameraFrame(frame)}
            className={`
              relative group p-2 rounded-xl transition-all duration-200
              ${
                cameraFrame?.id === frame.id
                  ? "bg-blue-100 ring-2 ring-blue-500 scale-105"
                  : "hover:bg-gray-100 hover:scale-105"
              }
            `}
          >
            {/* Thumbnail */}
            <div className="w-14 h-14 mx-auto bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden relative">
              {frame.imageSrc ? (
                <img
                  src={frame.imageSrc}
                  alt={frame.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = "none";
                    e.target.nextSibling.style.display = "flex";
                  }}
                />
              ) : null}
              <Camera
                className={`w-3 h-3 text-gray-400 ${
                  frame.imageSrc ? "hidden" : "block"
                }`}
              />
            </div>

            {/* Selected indicator */}
            {cameraFrame?.id === frame.id && (
              <div className="absolute -top-1 -right-1 bg-blue-500 text-white rounded-full p-1">
                <Check className="w-3 h-3" />
              </div>
            )}

            {/* Frame name */}
            <div className="text-xs text-gray-600 mt-1 text-center truncate">
              {frame.name}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
