import { LockKeyhole, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores";

export default function VipRequired({ compact = false }) {
  const navigate = useNavigate();
  const clearAndlogout = useAuthStore((state) => state.clearAndlogout);

  const handleLogout = async () => {
    await clearAndlogout();
    navigate("/login", { replace: true });
  };

  return (
    <section
      className={`flex w-full flex-col items-center justify-center px-5 text-center text-base-content ${
        compact ? "min-h-[360px] py-10" : "min-h-[70vh] py-16"
      }`}
    >
      <div className="grid h-14 w-14 place-items-center rounded-lg bg-warning/15 text-warning">
        <LockKeyhole className="h-7 w-7" aria-hidden="true" />
      </div>
      <h1 className="mt-4 text-xl font-bold sm:text-2xl">
        Cần Mua Gói Vip Để Sử Dụng
      </h1>
      <p className="mt-2 max-w-md text-sm opacity-70">
        Tài khoản Celebrity chỉ được sử dụng Celebrity Tool.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link to="/tools#celebrity" className="btn btn-primary">
          Mở Celebrity Tool
        </Link>
        <button type="button" className="btn btn-outline" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Đăng xuất
        </button>
      </div>
    </section>
  );
}
