import { X, Info } from "lucide-react";
import LoadingActivityItem from "./LoadingActivityItem";
import { formatFirestoreTime, formatTimeAgo } from "@/utils";
import ReactDOM from "react-dom";
import { useEffect, useState } from "react";
import { getAvatarSource, handleAvatarError } from "@/utils/avatar";

const getDisplayName = (user = {}) => {
  const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return name || user.username || "Ẩn danh";
};

// ================= Component: ActivityModal =================
export const ActivityModal = ({
  show,
  onClose,
  activity,
  pollSummary,
  isLoading,
  activeTooltip,
  setActiveTooltip,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [animate, setAnimate] = useState(false);

  // Lock scroll khi mở modal
  useEffect(() => {
    document.body.style.overflow = showModal ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showModal]);

  // Xử lý mở/đóng modal với animation
  useEffect(() => {
    if (show) {
      // Mở modal với animation
      setShowModal(true);
      setTimeout(() => setAnimate(true), 10);
    } else {
      // Đóng modal với animation
      setAnimate(false);
      setTimeout(() => setShowModal(false), 300);
    }
  }, [show]);

  if (!showModal) return null;

  return ReactDOM.createPortal(
    <div
      className={`fixed inset-0 z-60 flex items-end bg-base-100/30 backdrop-blur-[4px] duration-500 transition-all ${
        animate ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        className={`relative w-full h-2/3 bg-base-100 rounded-t-3xl shadow-lg p-4 transform transition-transform duration-500 border-t border-base-300 text-base-content ${
          animate ? "translate-y-0" : "translate-y-full"
        } flex flex-col`}
      >
        {/* Header - fixed */}
        <div className="sticky top-0 z-10 border-b border-base-300">
          <div className="relative flex items-center">
            <h2 className="text-lg font-bold text-center flex-1">Hoạt động</h2>
            <button
              onClick={onClose}
              className="absolute right-0 p-2 rounded-full"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Tổng kết */}
          {!isLoading && activity.length > 0 && (
            <div className="mt-3 text-sm space-y-1">
              <p>
                - 👁️ Tổng người xem:{" "}
                <span className="font-semibold">
                  {activity.filter((i) => i.viewedAt).length}
                </span>
              </p>
              <p>
                - 💖 Tổng người đã thả cảm xúc/bình chọn:{" "}
                <span className="font-semibold">
                  {activity.filter((i) => i.reaction || i.vote).length}
                </span>
              </p>
              {pollSummary?.total > 0 && (
                <p>
                  - 🗳️ Bình chọn:{" "}
                  <span className="font-semibold">
                    {pollSummary.leftEmoji} {pollSummary.leftCount}
                  </span>{" "}
                  ·{" "}
                  <span className="font-semibold">
                    {pollSummary.rightEmoji} {pollSummary.rightCount}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Nội dung cuộn */}
        <div className="flex-1 overflow-y-auto mt-1">
          {isLoading ? (
            <ul className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <LoadingActivityItem key={i} />
              ))}
            </ul>
          ) : activity.length > 0 ? (
            <ul className="space-y-2">
              {activity.map((item) => (
                <li
                  key={item?.user?.uid}
                  className="flex items-center gap-3 relative"
                >
                  <img
                    src={getAvatarSource(item?.user)}
                    alt={getDisplayName(item?.user)}
                    onError={handleAvatarError}
                    className="w-12 h-12 rounded-full border-[2.5px] p-0.5 border-amber-400 object-cover"
                  />
                  <div className="flex flex-col flex-1">
                    <span className="text-base font-semibold">
                      {getDisplayName(item.user)}
                    </span>
                    {item.vote && (
                      <span className="text-sm">
                        đã bình chọn {item.vote.emoji}{" "}
                        {formatTimeAgo(item.vote.createdAt)}
                      </span>
                    )}
                    {item.reaction && (
                      <span className="text-sm">
                        đã thả cảm xúc {item.reaction.emoji}{" "}
                        {formatTimeAgo(item.reaction.createdAt)}
                      </span>
                    )}
                    {!item.vote && !item.reaction && (
                      <span className="text-sm">
                        ✨ đã xem {formatFirestoreTime(item?.viewedAt)}
                      </span>
                    )}
                  </div>

                  {/* Info button */}
                  <div className="relative">
                    <button
                      onClick={() =>
                        setActiveTooltip(
                          activeTooltip === item?.user?.uid
                            ? null
                            : item?.user?.uid
                        )
                      }
                      className="p-2 rounded-full hover:bg-base-200 transition-colors"
                    >
                      <Info className="w-5 h-5 text-base-content/60" />
                    </button>

                    {/* Tooltip */}
                    {activeTooltip === item?.user?.uid && (
                      <div className="absolute right-6 top-full mt-2 w-64 bg-base-200 rounded-lg shadow-xl p-3 z-50 border border-base-300">
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 pb-2 border-b border-base-300">
                            <img
                              src={getAvatarSource(item?.user)}
                              alt={getDisplayName(item?.user)}
                              onError={handleAvatarError}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                            <div>
                              <p className="font-semibold">
                                {getDisplayName(item.user)}
                              </p>
                              <p className="text-xs text-base-content/60">
                                @{item.user?.username || "N/A"}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <p className="text-xs text-base-content/70">
                              <span className="font-medium">User ID:</span>{" "}
                              {item.user?.uid}
                            </p>

                            {item.viewedAt && (
                              <p className="text-xs text-base-content/70">
                                <span className="font-medium">
                                  Thời gian xem:
                                </span>
                                <br />
                                {formatFirestoreTime(item.viewedAt)}
                              </p>
                            )}

                            {item.vote && (
                              <>
                                <p className="text-xs text-base-content/70">
                                  <span className="font-medium">
                                    Bình chọn:
                                  </span>{" "}
                                  {item.vote.emoji}
                                </p>
                                <p className="text-xs text-base-content/70">
                                  <span className="font-medium">Cường độ:</span>{" "}
                                  {item.vote.intensity || 0}
                                </p>
                                {item.vote.createdAt && (
                                  <p className="text-xs text-base-content/70">
                                    <span className="font-medium">
                                      Thời gian bình chọn:
                                    </span>
                                    <br />
                                    {new Date(
                                      item.vote.createdAt
                                    ).toLocaleString("vi-VN")}
                                  </p>
                                )}
                              </>
                            )}

                            {item.reaction && (
                              <>
                                <p className="text-xs text-base-content/70">
                                  <span className="font-medium">
                                    Cảm xúc:
                                  </span>{" "}
                                  {item.reaction.emoji}
                                </p>
                                <p className="text-xs text-base-content/70">
                                  <span className="font-medium">Cường độ:</span>{" "}
                                  {item.reaction.intensity || 0}
                                </p>
                                {item.reaction.createdAt && (
                                  <p className="text-xs text-base-content/70">
                                    <span className="font-medium">
                                      Thời gian cảm xúc:
                                    </span>
                                    <br />
                                    {new Date(
                                      item.reaction.createdAt
                                    ).toLocaleString("vi-VN")}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center justify-center h-full text-base-content/60 italic">
              Chưa có hoạt động nào
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
