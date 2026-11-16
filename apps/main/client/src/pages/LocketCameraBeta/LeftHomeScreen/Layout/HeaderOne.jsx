import { ChevronRight } from "lucide-react";
import React from "react";

function HeaderOne({ setIsProfileOpen }) {
  return (
    <div className="flex items-center justify-between px-4 py-1">
      <div className="select-none px-3 py-2">
        <div className="text-lg font-bold tracking-tight">LOCKET-PRO</div>
        <div className="text-xs opacity-70">Admin <strong>MTIEN</strong></div>
      </div>
      <button
        onClick={() => setIsProfileOpen(false)}
        className="btn btn-circle p-1 border-0 hover:bg-base-200 transition cursor-pointer"
      >
        <ChevronRight size={40} />
      </button>
    </div>
  );
}

export default HeaderOne;
