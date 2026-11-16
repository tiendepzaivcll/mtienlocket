import { CONFIG } from "@/config";
import React from "react";
import ToolsLocket from "../pages/Auth/LocketDioTools";
// import CameraCapture from "../pages/UILocket";
const DiaryPage = React.lazy(() => import("@/pages/Auth/DiaryPage"));
const RestoreStreak = React.lazy(() => import("@/pages/Auth/RestoreStreak"));
const NewsPage = React.lazy(() => import("@/pages/Public/NewsPage"));
const NewsDetailPage = React.lazy(() => import("@/pages/Public/NewsDetailPage"));
const AuthHome = React.lazy(() => import("../pages/Auth/Home"));
const Profile = React.lazy(() => import("../pages/Auth/Profile"));
const PostMoments = React.lazy(() => import("../pages/Auth/PostMoments"));
const Photobooth = React.lazy(() => import("../pages/Auth/Photobooth"));
const Settings = React.lazy(() => import("../pages/Public/Settings"));
const DevPage = React.lazy(() => import("../pages/Public/DevPage"));
const AddToHomeScreenGuide = React.lazy(() => import("../pages/Public/AddToScreen"));
const PricingPage = React.lazy(() => import("../pages/Public/Pricing"));
const PrivacyPolicy = React.lazy(() => import("../pages/Public/PrivacyPolicy"));
const BirthdayPage = React.lazy(() => import("../pages/Public/BirthdayPage"));

const APP_NAME = CONFIG.app.fullName;

export const authRoutes = [
  { path: "/home", component: AuthHome, title: `Trang chủ | ${APP_NAME}` },

  { path: "/newsfeed", component: NewsPage, title: `Bảng tin | ${APP_NAME}` },
  { path: "/newsfeed/:slug", component: NewsDetailPage, title: `Bảng tin | ${APP_NAME}` },

  { path: "/download", component: AddToHomeScreenGuide, title: `Thêm ứng dụng vào màn hình chính | ${APP_NAME}` },

  { path: "/pricing", component: PricingPage, title: `LOCKET-PRO Full Access | ${APP_NAME}` },
  { path: "/pricing/:planId", component: PricingPage, title: `LOCKET-PRO Full Access | ${APP_NAME}` },

  { path: "/profile", component: Profile, title: `Hồ sơ | ${APP_NAME}` },
  { path: "/postmoments", component: PostMoments, title: `Đăng Moment Mới | ${APP_NAME}` },
  { path: "/photobooth", component: Photobooth, title: `Photobooth 4 ô | ${APP_NAME}` },
  { path: "/restore-streak", component: RestoreStreak, title: `Khôi phục chuỗi Locket | ${APP_NAME}` },
  { path: "/tools", component: ToolsLocket, title: `Công cụ mở rộng | ${APP_NAME}` },
  { path: "/diary", component: DiaryPage, title: `Nhật ký Locket | ${APP_NAME}` },

  { path: "/settings", component: Settings, title: `Cài đặt | ${APP_NAME}` },
  { path: "/devpage", component: DevPage, title: `Dev Page | ${APP_NAME}` },
  { path: "/privacy", component: PrivacyPolicy, title: `Chính sách bảo mật | ${APP_NAME}` },

  { path: "/happy-birthday", component: BirthdayPage, title: `Chúc mừng sinh nhật MTIEN | ${APP_NAME}` },
];
