import "swiper/css";
import "swiper/css/effect-coverflow";
import { CONFIG } from "@/config";
import { useEffect, useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { Swiper, SwiperSlide } from "swiper/react";
import { EffectCoverflow } from "swiper/modules";
import { LOCKET_THEMES_INFO } from "./ThemeSelector";

const ThemeSelector = () => {
  const { theme, changeTheme } = useTheme();
  const activeIndex = CONFIG.ui.themes.indexOf(theme);

  const [swiper, setSwiper] = useState(null);

  useEffect(() => {
    if (swiper && activeIndex >= 0) {
      swiper.slideTo(activeIndex);
    }
  }, [activeIndex, swiper]);

  return (
    <div className="w-full flex justify-center overflow-hidden">
      <div className="h-full max-w-md">
        <h1 className="font-lovehouse text-[var(--text-primary)] text-center text-3xl font-semibold">
          Setting Theme
        </h1>

        <Swiper
          direction="horizontal"
          modules={[EffectCoverflow]}
          effect={"coverflow"}
          onSwiper={setSwiper}
          initialSlide={activeIndex >= 0 ? activeIndex : 0}
          centeredSlides={true}
          coverflowEffect={{
            rotate: 50,
            stretch: 20,
            depth: 100,
            modifier: 1,
            slideShadows: false,
          }}
          slidesPerView={2}
          spaceBetween={20}
          className="w-full mt-4 px-3"
        >
          {CONFIG.ui.themes.map((t) => {
            const isActive = theme === t;
            const info = LOCKET_THEMES_INFO[t] || {
              name: t,
              primary: "#FFB800",
              shutterGradient: "linear-gradient(135deg, #FFB800, #FF7A00)",
              bg: "#000000",
            };

            return (
              <SwiperSlide key={t}>
                <div
                  onClick={() => {
                    changeTheme(t);
                  }}
                  data-theme={t}
                  style={{ background: info.bg }}
                  className={`relative 
                    flex flex-col justify-between items-center
                    aspect-[9/16] gap-3 space-y-3 w-full py-1.5
                    rounded-3xl cursor-pointer
                    transition-all duration-300 border border-white/10
                    ${
                      isActive
                        ? "ring-2 ring-[var(--accent-primary)] scale-100 shadow-xl opacity-100"
                        : "opacity-75 hover:opacity-100 scale-95"
                    }
                  `}
                >
                  {/* ===== TOP BAR ===== */}
                  <div className="w-full flex flex-row justify-between items-center p-2 relative">
                    <div className="w-6 h-6 rounded-full bg-white/15" />
                    <div className="absolute mx-auto left-1/2 -translate-x-1/2 w-20 h-6 rounded-2xl bg-white/15" />
                    <div className="flex flex-row gap-1">
                      <div className="w-6 h-6 rounded-full bg-white/15" />
                      <div className="w-6 h-6 rounded-full bg-white/15" />
                    </div>
                  </div>

                  {/* ===== MAIN CONTENT ===== */}
                  <div className="w-[85%] aspect-square bg-white/10 rounded-3xl border border-white/10" />

                  {/* ===== ACTION BAR ===== */}
                  <div className="w-full flex flex-row justify-between items-center px-6">
                    <div className="w-6 h-6 rounded-full bg-white/15" />
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center p-[2px] shadow-sm"
                      style={{ background: info.shutterGradient }}
                    >
                      <div className="w-full h-full rounded-full bg-white" />
                    </div>
                    <div className="w-6 h-6 rounded-full bg-white/15" />
                  </div>

                  {/* ===== BOTTOM INFO ===== */}
                  <div className="flex flex-row gap-1 items-center justify-center p-1">
                    <div className="w-4 h-4 rounded-2xl bg-white/15" />
                    <div className="w-10 h-4 rounded-2xl bg-white/15" />
                  </div>
                  <div className="h-[3px] bg-white/20 w-15 rounded-2xl"></div>
                </div>
                {/* ===== THEME NAME ===== */}
                <div
                  className={`mt-2 text-center text-sm font-semibold ${
                    isActive ? "text-[var(--accent-primary)]" : "text-[var(--text-secondary)]"
                  }`}
                >
                  {info.name}
                </div>
              </SwiperSlide>
            );
          })}
        </Swiper>
      </div>
    </div>
  );
};

export default ThemeSelector;
