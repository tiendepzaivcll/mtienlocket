import { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { Check, RotateCcw, Trash2, X } from "lucide-react";
import LoadingOverlay from "@/components/ui/Loading/LineSpinner";
import { useUploadQueueStore } from "@/stores";
import { toDisplayMessage } from "@/utils";
import { uploadRetryRemainingMs } from "@/stores/PostStores/uploadQueuePolicy";

const QueueViewer = () => {
  const { post } = useApp();
  const retryUploadItem = useUploadQueueStore((s) => s.retryUploadItem);
  const removeUploadItemById = useUploadQueueStore(
    (s) => s.removeUploadItemById,
  );
  const { selectedQueue, setSelectedQueue, selectedQueueId } = post;
  const queueInfo = useUploadQueueStore((s) =>
    s.uploadItems.find((i) => i.id === selectedQueueId)
  );

  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [clock, setClock] = useState(Date.now());

  // Mở hiệu ứng khi có selectedQueue
  useEffect(() => {
    if (selectedQueue !== null) {
      setIsVisible(true);
    }
  }, [selectedQueue]);

  const handleClose = () => {
    setIsAnimating(true);
    setIsVisible(false);
    setTimeout(() => {
      setSelectedQueue(null);
      setIsAnimating(false);
    }, 300);
  };

  // Khóa cuộn khi mở modal
  useEffect(() => {
    const shouldLock = selectedQueue !== null || isAnimating;
    if (shouldLock) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }

    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [selectedQueue, isAnimating]);

  useEffect(() => {
    if (!queueInfo?.nextRetryAt) return undefined;
    const intervalId = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [queueInfo?.nextRetryAt]);

  const handleRetry = async () => {
    if (!queueInfo?.id) return;

    try {
      const started = await retryUploadItem(queueInfo.id);
      if (started) handleClose();
    } catch (err) {
      console.error("❌ Retry failed:", err);
    }
  };

  const handleRemove = async () => {
    if (!queueInfo?.id || queueInfo.status === "uploading") return;
    await removeUploadItemById(queueInfo.id);
    handleClose();
  };

  if (!queueInfo && !isAnimating) return null;

  const mediaType = queueInfo?.mediaInfo?.type;
  const mediaUrl =
    queueInfo?.mediaInfo?.publicUrl || queueInfo?.mediaInfo?.url;
  const caption = queueInfo?.caption || "";
  const icon = queueInfo?.options?.icon || "";
  const colorTop = queueInfo?.options?.color_top || "#00000088";
  const colorBottom = queueInfo?.options?.color_bottom || "#000000cc";
  const textColor = queueInfo?.options?.text_color || "#ffffff";
  const errorMessage = toDisplayMessage(queueInfo?.errorMessage, "");
  const retryRemainingSeconds = Math.ceil(
    uploadRetryRemainingMs(queueInfo, clock) / 1000,
  );

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-between items-center transition-all duration-300 ease-in-out bg-base-100 ${
        isVisible && !isAnimating
          ? "opacity-100"
          : "opacity-0 pointer-events-none"
      }`}
      tabIndex={0}
    >
      <div className="flex-1 flex flex-col justify-center items-center w-full gap-2 pb-25">
        <div
          className={`relative w-full max-w-md aspect-square bg-base-200 rounded-[64px] overflow-hidden transition-all duration-300 ease-in-out ${
            isVisible && !isAnimating
              ? "opacity-100 scale-100"
              : "opacity-0 scale-90 pointer-events-none"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Nút đóng */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-50 p-2 bg-black/40 rounded-full hover:bg-black/60"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Nội dung media */}
          <div className="h-full w-full flex items-center justify-center relative bg-gradient-to-br from-base-300/20 to-base-100/20">
            {mediaType === "video" ? (
              <video
                src={mediaUrl}
                className="max-h-full max-w-full object-contain rounded-2xl"
                autoPlay
                muted
                loop
                playsInline
              />
            ) : (
              <img
                src={mediaUrl}
                alt={caption}
                className="max-h-full max-w-full object-contain rounded-2xl"
              />
            )}

            {/* Status Icon */}
            {queueInfo?.status && (
              <>
                <div className="absolute inset-0 backdrop-blur-[2px] bg-black/40 flex items-center justify-center z-10"></div>

                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
                  {(queueInfo?.status === "queued" ||
                    queueInfo?.status === "uploading") && (
                    <LoadingOverlay color="white" />
                  )}
                  {queueInfo?.status === "done" && (
                    <Check className="text-green-400 w-6 h-6 animate-bounce" />
                  )}
                  {queueInfo?.status === "failed" && (
                    <div className="flex flex-col items-center justify-center text-error">
                      <RotateCcw
                        strokeWidth={1.5}
                        className="w-16 h-16 transition-transform duration-700"
                      />

                      {errorMessage && (
                        <p className="text-xs text-center mt-2 text-white bg-black/50 px-2 py-1 rounded">
                          {errorMessage} - Lần thử lại:{" "}
                          {queueInfo?.retryCount || 0}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Caption nếu có */}
            {caption && (
              <div
                className="absolute bottom-4 w-fit backdrop-blur-sm rounded-2xl px-3 py-2"
                style={{
                  background: `linear-gradient(to bottom, ${colorTop}, ${colorBottom})`,
                }}
              >
                <p className="text-sm font-medium" style={{ color: textColor }}>
                  {icon} {caption}
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-center z-30">
          {queueInfo?.status === "failed" && (
            <button
              onClick={handleRetry}
              disabled={retryRemainingSeconds > 0}
              className="flex items-center gap-1 px-5 py-3 rounded-2xl font-semibold text-error disabled:opacity-50"
            >
              <RotateCcw strokeWidth={2} className="w-8 h-8" />
              {retryRemainingSeconds > 0
                ? `Thử lại sau ${retryRemainingSeconds}s`
                : "Thử lại"}
            </button>
          )}
          {(queueInfo?.status === "queued" ||
            queueInfo?.status === "failed") && (
            <button
              onClick={handleRemove}
              className="flex items-center gap-1 px-5 py-3 rounded-2xl font-semibold"
            >
              <Trash2 className="h-6 w-6" />
              Xóa khỏi hàng đợi
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QueueViewer;
