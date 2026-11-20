import { ChevronRight } from "lucide-react";
import React from "react";

function HeaderOne({ setIsProfileOpen }) {
  return (
    <div className="flex items-center justify-between px-4 py-1">
      <div className="select-none px-3 py-2">
        <div className="text-lg font-bold tracking-tight">LOCKET-PRO</div>
      </div>
      <button
        onClick={() => setIsProfileOpen(false)}
        className="btn btn-circle p-1 border border-[var(--border-subtle)] bg-[var(--surface-pill)] text-[var(--text-primary)] hover:opacity-80 transition cursor-pointer"
      >
        <ChevronRight size={28} />
      </button>
    </div>
  );
}

export default HeaderOne;
