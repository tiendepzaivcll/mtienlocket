import React from "react";
// const CameraCapture = React.lazy(() => import("../pages/UILocket"));
import Home from "../pages/Public/Home";
import Login from "../pages/Public/Login";
import { CONFIG } from "@/config";
import ToolsLocket from "../pages/Auth/LocketDioTools";
// import LocketCameraBeta from "@/pages/LocketCameraBeta";
const LocketCameraBeta = React.lazy(() => import("../pages/LocketCameraBeta"));
// import CameraCapture from "@/pages/UILocket";
// const WhitePage = React.lazy(() => import("@/pages/Public/WhitePage"));
const NewsPage = React.lazy(() => import("@/pages/Public/NewsPage"));
const NewsDetailPage = React.lazy(() => import("@/pages/Public/NewsDetailPage"));
const ForgotPassword = React.lazy(() => import("@/pages/Public/ForgotPassword"));
const PrivacyPolicy = React.lazy(() => import("../pages/Public/PrivacyPolicy"));
const PricingPage = React.lazy(() => import("../pages/Public/Pricing"));
const Settings = React.lazy(() => import("../pages/Public/Settings"));
const DevPage = React.lazy(() => import("../pages/Public/DevPage"));
const AddToHomeScreenGuide = React.lazy(() => import("../pages/Public/AddToScreen"));
const ReferencePage = React.lazy(() => import("../pages/Public/APIDocs"));
const BirthdayPage = React.lazy(() => import("../pages/Public/BirthdayPage"));
const CaptionPresetManager = React.lazy(() => import("../pages/Public/CaptionPresetManager"));
const AdminPanel = React.lazy(() => import("../pages/Public/Admin"));
const Contact = React.lazy(() => import("../pages/Public/Contact"));

const APP_NAME = CONFIG.app.fullName;

export const publicRoutes = [
  { path: "/", component: Home, title: `Trang Chủ | ${APP_NAME}` },
  { path: "/login", component: Login, title: `Đăng Nhập | ${APP_NAME}` },
  { path: "/admin", component: AdminPanel, title: `Admin | ${APP_NAME}` },
  { path: "/contact", component: Contact, title: `Liên hệ admin | ${APP_NAME}` },

  { path: "/newsfeed", component: NewsPage, title: `Bảng tin | ${APP_NAME}` },
  { path: "/newsfeed/:slug", component: NewsDetailPage, title: `Bảng tin | ${APP_NAME}` },
  
  { path: "/download", component: AddToHomeScreenGuide, title: `Thêm ứng dụng vào màn hình chính | ${APP_NAME}` },
  { path: "/preset", component: CaptionPresetManager, title: `Quản lý Caption Preset | ${APP_NAME}` },
  { path: "/locket-beta", component: LocketCameraBeta, title: `Locket Camera Beta | ${APP_NAME}` },

  { path: "/privacy", component: PrivacyPolicy, title: `Chính sách riêng tư | ${APP_NAME}` },
  { path: "/pricing", component: PricingPage, title: `LOCKET-PRO Full Access | ${APP_NAME}` },
  { path: "/pricing/:planId", component: PricingPage, title: `LOCKET-PRO Full Access | ${APP_NAME}` },
  { path: "/tools", component: ToolsLocket, title: `Công cụ mở rộng | ${APP_NAME}` },

  { path: "/settings", component: Settings, title: `Cài đặt | ${APP_NAME}` },
  { path: "/devpage", component: DevPage, title: `Dev Page | ${APP_NAME}` },
  { path: "/reference", component: ReferencePage, title: `API Docs | ${APP_NAME}` },

  { path: "/happy-birthday", component: BirthdayPage, title: `Chúc mừng sinh nhật MTIEN | ${APP_NAME}` },

  // { path: "/wt", component: WhitePage, title: `White Page for Development | ${APP_NAME}` },
  // { path: "/locket", component: LocketCameraBeta, title: `White Page for Development | ${APP_NAME}` },

  { path: "/forgot-password", component: ForgotPassword, title: `Khôi phục mật khẩu | ${APP_NAME}` },
];
