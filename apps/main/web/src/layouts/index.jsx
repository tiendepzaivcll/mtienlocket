import LocketLayout from "./locketLayout";
import DefaultLayout from "./mainLayout";

const getLayout = (pathname) => {
  // 🚀 Sửa logic: Chỉ dùng LocketLayout cho đúng những gì liên quan đến camera
  if (pathname === "/locket-beta" || pathname.startsWith("/locket/")) {
    return LocketLayout;
  }
  // Tất cả những thứ còn lại (bao gồm cả lúc đang load dở) thì dùng Default
  return DefaultLayout;
};

export default getLayout;