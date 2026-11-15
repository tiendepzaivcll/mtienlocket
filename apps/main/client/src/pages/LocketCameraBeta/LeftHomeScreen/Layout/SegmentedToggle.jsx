import { CalendarDays, Megaphone } from "lucide-react";

export default function SegmentedToggle({ active, setActive }) {
  const showingRollcalls = active === "rollcall";

  return (
    <div className="flex w-full items-center justify-start px-5">
      <button
        type="button"
        aria-label={showingRollcalls ? "Quay lại lịch Locket" : "Mở Rollcall"}
        title={showingRollcalls ? "Lịch Locket" : "Rollcall"}
        onClick={() => setActive(showingRollcalls ? "lockets" : "rollcall")}
        className={`flex h-12 w-12 items-center justify-center rounded-full shadow-lg backdrop-blur-xl transition-all active:scale-95 ${
          showingRollcalls
            ? "bg-primary text-primary-content"
            : "bg-base-300/75 text-base-content"
        }`}
      >
        {showingRollcalls ? (
          <CalendarDays size={23} strokeWidth={2.4} />
        ) : (
          <Megaphone size={23} strokeWidth={2.4} />
        )}
      </button>
    </div>
  );
}
