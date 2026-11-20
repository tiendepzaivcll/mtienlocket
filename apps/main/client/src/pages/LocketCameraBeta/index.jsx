import React, { lazy, Suspense, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import MainHomeScreen from "./MainHomeScreen";
import { MusicPlayer } from "./Widgets/MusicPlayer";
import { useUIStore } from "@/stores";
import NavigationDock from "./Layout/NavigationDock";
import { shouldHideNavigationDock } from "./Layout/navigationDockVisibility";
// import CropVideoStudio from "./ModalViews/CropVideoStudio";
// const Snowfall = lazy(() => import("@/components/Effects/SnowBanner"));
const BgLocketdio = lazy(() => import("@/components/Effects/BgLocketDio"));

const LeftHomeScreen = lazy(() => import("./LeftHomeScreen"));
const RightHomeScreen = lazy(() => import("./RightHomeScreen"));

const FriendsContainer = lazy(() => import("./ModalViews/FriendsContainer"));
const EmojiPicker = lazy(() => import("./ModalViews/EmojiStudio"));
const ScreenCustomeStudio = lazy(() => import("./ModalViews/CustomeStudio"));
const AiFilterStudio = lazy(() => import("./ModalViews/AiFilterStudio"));
const CropImageStudio = lazy(() => import("@/features/EditorStudio/CropImageStudio"));
const OptionMoment = lazy(() => import("./ModalViews/OptionMoment"));

export default function LocketCameraBeta() {
  const { navigation, camera, post } = useApp();

  const {
    setIsHomeOpen,
    setIsProfileOpen,
    isOptionModalOpen,
    setOptionModalOpen,
  } = navigation;
  const { canvasRef } = camera;
  const {
    postOverlay,
    selectedFile,
    selectedQueue,
    imageToCrop,
    videoCrop,
  } = post;
  const background = useUIStore((s) => s.background);

  useEffect(() => {
    import("./LeftHomeScreen");
    import("./RightHomeScreen");
  }, []);

  return (
    <div
      className="w-full h-full min-h-[100dvh] relative overflow-hidden"
      style={{ background: "var(--bg-app)", color: "var(--text-primary)" }}
    >
      <Suspense fallback={null}>
        <BgLocketdio bgSrc={background?.url} />
      </Suspense>

      <MainHomeScreen />
      {/* Page Views */}
      <Suspense fallback={null}>
        <LeftHomeScreen setIsProfileOpen={setIsProfileOpen} />
        <RightHomeScreen setIsHomeOpen={setIsHomeOpen} />
      </Suspense>

      <NavigationDock
        hidden={shouldHideNavigationDock({
          selectedFile,
          selectedQueue,
          imageToCrop,
          videoCrop,
        })}
      />

      {/* Modal Views */}
      <Suspense fallback={null}>
        <FriendsContainer />
        <CropImageStudio />
        <ScreenCustomeStudio />
        <AiFilterStudio />
        {/* <CropVideoStudio /> */}
        <EmojiPicker />
        <OptionMoment
          setOptionModalOpen={setOptionModalOpen}
          isOptionModalOpen={isOptionModalOpen}
        />
      </Suspense>

      {/* Canvas for capturing image/video */}
      <canvas ref={canvasRef} className="hidden" />
      {/* Audio Music */}
      {postOverlay.music && <MusicPlayer music={postOverlay.music} />}
    </div>
  );
}
