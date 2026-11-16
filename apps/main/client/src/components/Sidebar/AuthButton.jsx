import { Link } from "react-router-dom";
import { LogOut, LogIn } from "lucide-react";

export const AuthButton = ({ user, onLogout, onClose }) => (
  <div className="mtien-menu-auth">
    {user ? (
      <button
        type="button"
        onClick={() => {
          onLogout();
          onClose();
        }}
      >
        <LogOut size={17} aria-hidden="true" /> Đăng xuất
      </button>
    ) : (
      <Link to="/login" onClick={onClose}>
        <LogIn size={17} aria-hidden="true" /> Đăng nhập
      </Link>
    )}
  </div>
);
