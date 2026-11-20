import React, { useCallback } from "react";
import { useApp } from "@/context/AppContext";
import { useMomentsStoreV2 } from "@/stores";
import { ImageUp } from "lucide-react";
import { SonnerInfo, SonnerError } from "@/components/ui/SonnerToast";
import { classifyPhoneMedia, normalizePhoneImage } from "@/utils/imageUtils";
import { MAX_VIDEO_UPLOAD_MB } from "@/config/uploadLimits";

const UploadFile = () => {
  const { post, useloading, camera } = useApp();
  const {
    setSelectedFile,
    setPreview,
    setSizeMedia,
    setImageToCrop,
    setVideoCrop,
    setVideoCropArea,
  } = post;
  const { setIsCaptionLoading } = useloading;
  const { setCameraActive } = camera;

  //Handle tải file
  const handleFileChange = useCallback(async (event) => {
    setCameraActive(false);
    setSelectedFile(null);
    setVideoCropArea(null);
    setImageToCrop(null);
    setVideoCrop(null);
    const rawFile = event.target.files[0];
    if (!rawFile) return;
    event.target.value = "";
    const fileType = classifyPhoneMedia(rawFile);

    if (!fileType) {
      SonnerInfo("Chỉ hỗ trợ ảnh và video.");
      return;
    }

    // Convert file size to MB
    const fileSizeInMB = rawFile.size / (1024 * 1024); // size in MB

    if (fileType === "video" && fileSizeInMB > MAX_VIDEO_UPLOAD_MB) {
      SonnerError("File quá bự!", "Up dưới 40MB thôi nha!");
      return;
    }

    setIsCaptionLoading(true);
    if (fileType === "image") {
      try {
        const normalizedFile = await normalizePhoneImage(rawFile, {
          maxEdge: 2048,
          quality: 0.94,
        });
        const localPreviewUrl = URL.createObjectURL(normalizedFile);
        setSizeMedia((normalizedFile.size / (1024 * 1024)).toFixed(2));
        setImageToCrop(localPreviewUrl);
      } catch (error) {
        setIsCaptionLoading(false);
        SonnerError(
          "Không thể đọc ảnh",
          error?.message || "Ảnh không hợp lệ hoặc chưa được hỗ trợ.",
        );
      }
      return;
    }
    // if (fileType === "video") {
    //   setVideoCrop(localPreviewUrl);
    //   return;
    // }
    const localPreviewUrl = URL.createObjectURL(rawFile);
    setSizeMedia(fileSizeInMB.toFixed(2));
    setPreview({ type: fileType, data: localPreviewUrl }); // Preview local ngay
    setSelectedFile(rawFile); // Lưu file đã chọn
  }, [
    setCameraActive,
    setImageToCrop,
    setIsCaptionLoading,
    setPreview,
    setSelectedFile,
    setSizeMedia,
    setVideoCrop,
    setVideoCropArea,
  ]);

  const isPWA = post?.isPWA || Boolean(window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone);
  const latestMoment = useMomentsStoreV2((s) => s.momentsByUser["all"]?.items?.[0]);
  const latestThumb = latestMoment?.thumbnail_url || latestMoment?.image_url;

  return (
    <>
      <input
        type="file"
        accept="image/*,video/*,.heic,.heif,.avif,.mov,.m4v"
        onChange={handleFileChange}
        className="hidden"
        id="file-upload"
      />
      <label htmlFor="file-upload" className="cursor-pointer active:scale-95 block">
        {isPWA ? (
          latestThumb ? (
            <div className="w-12 h-12 rounded-2xl overflow-hidden ring-2 ring-white/20 shadow-md bg-black/40">
              <img src={latestThumb} alt="Ảnh mới nhất" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center text-white shadow-md">
              <ImageUp size={24} />
            </div>
          )
        ) : (
          <ImageUp size={35} />
        )}
      </label>
    </>
  );
};
export default UploadFile;
