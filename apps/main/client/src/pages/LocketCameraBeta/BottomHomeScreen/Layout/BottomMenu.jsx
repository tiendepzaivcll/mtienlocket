import { LayoutGrid, Share } from "lucide-react";
import InputForMoment from "./InputForMoment";
import { useApp } from "@/context/AppContext";

const BottomMenu = ({ setOptionModalOpen }) => {
  const { post } = useApp();
  const {
    selectedMoment,
    setSelectedMomentId,
    setSelectedQueueId,
    setSelectedMoment,
    selectedQueue,
    setSelectedQueue,
  } = post;

  const handleClose = () => {
    setSelectedMoment(null);
    setSelectedQueue(null);
    setSelectedMomentId(null);
    setSelectedQueueId(null);
  };

  return (
    <>
      {(selectedMoment !== null || selectedQueue !== null) && (
        <div
          className="fixed inset-x-0 z-70 w-full px-5 text-base-content"
          style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          {typeof selectedMoment === "number" && (
            <div className="mb-3">
              <InputForMoment />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <button
                aria-label="Xem dạng lưới"
                className="btn btn-circle h-12 min-h-12 w-12 p-2 backdrop-blur-md bg-[var(--surface-pill)] text-[var(--text-primary)] border border-[var(--border-subtle)] cursor-pointer hover:opacity-80 rounded-full transition-colors"
                onClick={handleClose}
              >
                <LayoutGrid size={28} />
              </button>
            </div>

            <div>
              <button
                aria-label="Chia sẻ moment"
                onClick={() => setOptionModalOpen(true)}
                className="btn btn-circle h-12 min-h-12 w-12 p-2 backdrop-blur-md bg-[var(--surface-pill)] text-[var(--text-primary)] border border-[var(--border-subtle)] cursor-pointer hover:opacity-80 rounded-full transition-colors"
              >
                <Share size={28} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BottomMenu;
