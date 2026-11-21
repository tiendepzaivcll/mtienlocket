import * as services from "@/services";
import { useApp } from "@/context/AppContext.jsx";
import { useCallback, useState } from "react";
import { defaultPostOverlay } from "@/stores/usePost.js";
import UploadStatusIcon from "./UploadStatusIcon.jsx";
import { getMaxUploads } from "@/hooks/useFeature.js";
import {
  SonnerError,
  SonnerInfo,
  SonnerSuccess,
  SonnerWarning,
} from "@/components/ui/SonnerToast";
import {
  usePostStore,
  useStreakStore,
  useUploadQueueStore,
  useUIStore,
} from "@/stores";
import { compositeFrameOnImage } from "@/utils/process/PrsImage/compositeFrame";
import { toDisplayMessage } from "@/utils";
import {
  getNextRestoreDate,
  getRestoreToday,
} from "@/utils/streakRestoreFlow";

const SendButton = () => {
  const { post, useloading, camera } = useApp();
  const { uploadLoading, setUploadLoading } = useloading;
  const cameraFrame = useUIStore((s) => s.cameraFrame);
  const streak = useStreakStore((s) => s.streak);
  const restoreFlow = usePostStore((s) => s.restoreFlow);
  const markRestoreFlowPending = usePostStore(
    (s) => s.markRestoreFlowPending,
  );
  const markRestoreFlowFailed = usePostStore(
    (s) => s.markRestoreFlowFailed,
  );
  const {
    preview,
    setPreview,
    selectedFile,
    setSelectedFile,
    isSizeMedia,
    setSizeMedia,
    postOverlay,
    setPostOverlay,
    audience,
    setAudience,
    selectedRecipients,
  } = post;
  const { setCameraActive } = camera;

  //Nhap hooks
  const { maxImageSizeMB, maxVideoSizeMB } = getMaxUploads();
  const enqueueUploadItem = useUploadQueueStore((s) => s.enqueueUploadItem);

  const isImage = preview?.type === "image";
  const isVideo = preview?.type === "video";

  const isTooBig = isImage
    ? isSizeMedia > maxImageSizeMB
    : isVideo
      ? isSizeMedia > maxVideoSizeMB
      : false;
  const hasNoData = false;

  // State để quản lý hiệu ứng loading và success
  const [isSuccess, setIsSuccess] = useState(false);

  const handleDelete = useCallback(() => {
    // Dừng stream cũ nếu có
    if (camera.streamRef.current) {
      camera.streamRef.current.getTracks().forEach((track) => track.stop());
      camera.streamRef.current = null;
    }
    setSelectedFile(null);
    setPreview(null);
    setSizeMedia(null);
    setPostOverlay(defaultPostOverlay);
    setAudience("all");
    setCameraActive(true); // Giữ dòng này để trigger useEffect
    setIsSuccess(false); // Reset success state
  }, [
    camera.streamRef,
    setAudience,
    setCameraActive,
    setPostOverlay,
    setPreview,
    setSelectedFile,
    setSizeMedia,
  ]);

  // Hàm submit được cải tiến
  const handleSubmit = async () => {
    if (!selectedFile) {
      SonnerWarning("Không có dữ liệu để tải lên.");
      return;
    }

    const { type: previewType } = preview || {};
    const isImage = previewType === "image";
    const isVideo = previewType === "video";
    const maxFileSize = isImage ? maxImageSizeMB : maxVideoSizeMB;

    if (isVideo && (!selectedFile.size || selectedFile.size < 1024)) {
      SonnerWarning("Video rỗng hoặc không hợp lệ.");
      return;
    }
    if (isSizeMedia > maxFileSize) {
      SonnerWarning(
        "Tệp vượt giới hạn kỹ thuật!",
        `${
          isImage ? "Ảnh" : "Video"
        } vượt quá dung lượng. Tối đa ${maxFileSize} MB.`,
      );
      return;
    }

    const today = getRestoreToday();
    const selectedRestoreDate = Number(restoreFlow.selectedDate) || null;
    if (restoreFlow.pendingDate) {
      SonnerInfo(
        "Đang xác nhận ngày khôi phục",
        "Vui lòng chờ Locket xác nhận trước khi đăng ngày tiếp theo.",
      );
      return;
    }
    if (selectedRestoreDate) {
      const expectedRestoreDate = getNextRestoreDate({
        streak,
        confirmedDate: restoreFlow.confirmedDate,
        today,
      });

      if (selectedRestoreDate !== expectedRestoreDate) {
        SonnerWarning(
          "Ngày khôi phục không còn hợp lệ",
          "Hãy mở lịch Locket và chọn lại ngày tiếp theo.",
        );
        return;
      }
    }

    try {
      // Bắt đầu loading
      setUploadLoading(true);
      setIsSuccess(false);

      // Composite frame onto image if frame is selected and it's an image
      let fileToUpload = selectedFile;
      if (isImage && cameraFrame?.imageSrc) {
        try {
          fileToUpload = await compositeFrameOnImage(selectedFile, cameraFrame.imageSrc);
          SonnerInfo("Ghép khung thành công!", "Đang tải lên...");
        } catch (frameError) {
          console.error("Error compositing frame:", frameError);
          // If compositing fails, continue with original file
          SonnerWarning("Ghép khung thất bại, tiếp tục gửi ảnh gốc.");
        }
      }

      // Tạo payload
      const isPastRestore =
        selectedRestoreDate && selectedRestoreDate < today;
      const restoreStreakData = isPastRestore
        ? {
            data: selectedRestoreDate,
            mode: "restore",
            name: "Khôi phục chuỗi từ lịch Locket",
          }
        : null;
      const payload = isPastRestore
        ? await services.createRequestPayloadV4(
            fileToUpload,
            previewType,
            postOverlay,
            restoreStreakData,
            audience,
            selectedRecipients,
          )
        : await services.createRequestPayloadV5(
            fileToUpload,
            previewType,
            postOverlay,
            audience,
            selectedRecipients,
          );

      if (!payload) {
        throw new Error("Không tạo được payload. Hủy tiến trình tải lên.");
      }

      if (selectedRestoreDate) {
        payload.restoreFlow = {
          selectedDate: selectedRestoreDate,
          mode: isPastRestore ? "restore" : "normal",
        };
        markRestoreFlowPending(selectedRestoreDate);
      }

      // Lưu payload vào memory và start
      await enqueueUploadItem(payload);

      // Kết thúc loading và hiển thị success
      setUploadLoading(false);
      setIsSuccess(true);
      // Hiển thị thông báo thành công
      SonnerSuccess(
        "Thêm vào hàng đợi!", // Title
        "Bài viết đang được xử lý...", // Body
      );
      // Reset success state sau 1 giây
      setTimeout(() => {
        setIsSuccess(false);
        handleDelete();
      }, 1000);
    } catch (error) {
      setUploadLoading(false);
      setIsSuccess(false);

      const errorMessage = toDisplayMessage(
        error?.response?.data?.message || error?.response?.data || error,
        "Lỗi không xác định",
      );
      SonnerError("Tạo payload thất bại!", errorMessage);

      if (restoreFlow.selectedDate) {
        markRestoreFlowFailed(restoreFlow.selectedDate, errorMessage);
      }

      console.error("❌ Tạo payload thất bại:", error);
    }
  };

  return (
    <>
      <button
        onClick={handleSubmit}
        disabled={uploadLoading || Boolean(restoreFlow.pendingDate)}
        className={`rounded-full w-[84px] h-[84px] duration-500 backdrop-blur-2xl text-center flex items-center justify-center disabled:opacity-50 transition-all ease-in-out active:scale-95 shadow-xl text-white ${
          hasNoData
            ? "bg-yellow-500/20 border border-yellow-500/30"
            : isTooBig
              ? "bg-red-500/20 border border-red-500/30"
              : isSuccess
                ? "bg-green-500/20 border border-green-500/30"
                : uploadLoading
                  ? "bg-blue-500/20 border border-blue-500/30"
                  : "border border-white/20 hover:opacity-95"
        }`}
        style={{
          background:
            !hasNoData && !isTooBig && !isSuccess && !uploadLoading
              ? "var(--shutter-gradient)"
              : undefined,
          animation: isSuccess ? "success-pulse 1s ease-in-out" : "none",
        }}
      >
        <UploadStatusIcon
          loading={uploadLoading}
          success={isSuccess}
          overLimit={isTooBig}
        />
      </button>
    </>
  );
};

export default SendButton;
