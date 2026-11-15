import "./styles.css";
import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";

import Login from "../Login"; 

const NotificationPrompt = lazy(() =>
  import("@/components/ui/NotificationPrompt")
);

const Home = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full text-center bg-grid bg-base-100 relative">
      
      {/* Bao bọc toàn bộ form Login và Nút bấm */}
      <div className="flex flex-col items-center justify-center w-full z-10">
        
        {/* Module Đăng nhập hiển thị ngay lập tức */}
        <Login />

        {/* Nút thêm vào màn hình nằm ngay dưới cùng */}
        <div className="mt-2 pb-10">
          <Link
            to={"/download"}
            className="inline-block px-8 py-3 rotate-[1deg] gradient-effect text-white font-semibold rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 hover:scale-105 active:scale-95"
          >
            Thêm vào màn hình
          </Link>
        </div>
        
      </div>

      {/* 👉 Component xin quyền thông báo chạy ngầm */}
      <Suspense fallback={null}>
        <NotificationPrompt />
      </Suspense>
    </div>
  );
};

export default Home;
