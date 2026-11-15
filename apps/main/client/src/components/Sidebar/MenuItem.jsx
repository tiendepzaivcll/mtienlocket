import React from "react";
import { Link } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
// Helper components
export const MenuItem = ({ to, icon, children, badge, locked, onClick }) => (
  <li>
    <Link
      to={to}
      className={`flex items-center px-3 py-2.5 mb-1 rounded-lg transition ${
        location.pathname === to ? "bg-base-300" : "hover:bg-base-200"
      }`}
      onClick={onClick}
    >
      {React.createElement(icon, { size: 22 })}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {locked ? (
        <LockKeyhole className="h-4 w-4 shrink-0 text-warning" aria-label="Cần quyền VIP" />
      ) : badge ? (
        <div className="badge badge-sm badge-secondary ml-auto">{badge}</div>
      ) : null}
    </Link>
  </li>
);
