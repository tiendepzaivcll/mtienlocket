import React from "react";
import { NavLink } from "react-router-dom";
import { LockKeyhole } from "lucide-react";

export const MenuItem = ({ to, icon, children, badge, locked, onClick }) => (
  <li>
    <NavLink
      to={to}
      end
      className={({ isActive }) => `mtien-menu-link${isActive ? " active" : ""}`}
      onClick={onClick}
    >
      {React.createElement(icon, { size: 19, "aria-hidden": true })}
      <span>{children}</span>
      {locked ? (
        <LockKeyhole className="mtien-menu-lock" size={15} aria-label="Cần quyền VIP" />
      ) : badge ? (
        <span className="mtien-menu-badge">{badge}</span>
      ) : null}
    </NavLink>
  </li>
);
