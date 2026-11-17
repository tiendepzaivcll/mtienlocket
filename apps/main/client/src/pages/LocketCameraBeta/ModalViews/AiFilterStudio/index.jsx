import { useCallback, useEffect, useState } from "react";
import { Camera, Check, Grid2X2, LoaderCircle, LockKeyhole, RefreshCw, Sparkles, X } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useCameraCaptureMode } from "@/hooks/useCameraCaptureMode";
import { PHOTOBOOTH_FRAMES } from "@/data/photoboothFrames";
import { useAuthStore } from "@/stores";
import { fetchAiFilters } from "@/services";
import { SonnerError } from "@/components/ui/SonnerToast";

const errorMessage = (error) =>
  error?.response?.data?.message ||
  error?.response?.data?.error?.message ||
  error?.message ||
  "Không thể tải danh sách AI Filter.";

function OpenFilterStudio() {
  const { navigation, post, camera, useloading } = useApp();
  const { setIsAiFilterOpen } = navigation;
  const { selectedFile, selectedAiFilter, setSelectedAiFilter } = post;
  const { showPhotobooth, selectedFrameId, mediaIsLocked, chooseCaptureMode } = useCameraCaptureMode();
  const aiFilterEnabled = useAuthStore((state) => state.aiFilterEnabled);
  const refreshAccessRole = useAuthStore((state) => state.refreshAccessRole);
  const [tab, setTab] = useState(() => selectedFile || selectedAiFilter ? "ai" : "photobooth");
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [groups, setGroups] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const aiSelectionLocked = Boolean(camera.isHolding || useloading.sendLoading ||
    useloading.uploadLoading || useloading.isAiGenerating || post.imageToCrop || post.videoCrop);

  // Photobooth is local. Check the separate AI permission only in its own tab.
  useEffect(() => {
    if (tab !== "ai" || aiFilterEnabled || accessChecked) return undefined;
    let active = true;
    setCheckingAccess(true);
    Promise.resolve(refreshAccessRole()).catch(() => null).finally(() => {
      if (active) {
        setCheckingAccess(false);
        setAccessChecked(true);
      }
    });
    return () => { active = false; };
  }, [tab, aiFilterEnabled, accessChecked, refreshAccessRole]);

  useEffect(() => {
    if (tab !== "ai" || !aiFilterEnabled || catalogLoaded) return undefined;
    let active = true;
    setLoadingCatalog(true);
    setCatalogError("");
    fetchAiFilters()
      .then((data) => {
        if (!active) return;
        setGroups(data);
        setCatalogLoaded(true);
      })
      .catch((error) => {
        if (!active) return;
        const message = errorMessage(error);
        setCatalogError(message);
        SonnerError("Không tải được AI Filter", message);
      })
      .finally(() => {
        if (active) setLoadingCatalog(false);
      });
    return () => { active = false; };
  }, [tab, aiFilterEnabled, catalogAttempt, catalogLoaded]);

  useEffect(() => {
    document.body.classList.add("overflow-hidden");
    return () => document.body.classList.remove("overflow-hidden");
  }, []);

  const close = useCallback(() => {
    setIsAiFilterOpen(false);
  }, [setIsAiFilterOpen]);

  const selectCapture = (photobooth, frameId = "none") => {
    if (mediaIsLocked || chooseCaptureMode(photobooth, frameId) === false) return;
    if (photobooth) setSelectedAiFilter(null);
    close();
  };

  const selectFilter = (filter) => {
    if (!aiFilterEnabled || aiSelectionLocked) return;
    if (showPhotobooth && chooseCaptureMode(false) === false) return;
    setSelectedAiFilter(filter);
    close();
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/40 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Filter Studio"
        data-testid="ai-filter-studio"
        className="relative flex h-[70dvh] max-h-[70dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-base-100 text-base-content shadow-2xl"
      >
        <header className="flex h-16 shrink-0 items-center gap-2 px-4">
          <Sparkles className="h-6 w-6 text-[#b2f5cf]" strokeWidth={2.5} />
          <h2 className="text-xl font-black uppercase tracking-tight">Filter Studio</h2>
          <span className="flex-1" />
          <button
            type="button"
            aria-label="Đóng Filter Studio"
            onClick={close}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-base-200/80 shadow-sm transition hover:bg-base-200 active:scale-95"
          >
            <X className="h-6 w-6" />
          </button>
        </header>

        <div className="mx-4 mb-3 flex shrink-0 gap-1 rounded-full bg-base-200 p-1" role="tablist" aria-label="Loại filter">
          {[{ id: "photobooth", label: "Photobooth" }, { id: "ai", label: "AI Filter" }].map(({ id, label }) => (
            <button
              key={id}
              id={`filter-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-controls={`filter-panel-${id}`}
              onClick={() => setTab(id)}
              className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full px-3 text-sm font-bold transition ${tab === id ? "bg-[#b2f5cf] text-[#112219] shadow-sm" : "text-base-content/70"}`}
            >
              {id === "photobooth" ? <Grid2X2 size={16} aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}{label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {tab === "photobooth" ? (
            <div role="tabpanel" id="filter-panel-photobooth" aria-labelledby="filter-tab-photobooth">
              <p className="mb-3 text-sm leading-relaxed text-base-content/65">Chọn khung để xem ngay trên camera, rồi chụp lần lượt 4 ảnh.</p>
              {mediaIsLocked && <p className="mb-3 rounded-xl bg-base-200 p-3 text-sm" role="status">Hãy hoàn tất hoặc huỷ ảnh đang chọn rồi quay lại camera để đổi chế độ chụp.</p>}
              <button
                type="button"
                aria-pressed={!showPhotobooth}
                disabled={mediaIsLocked}
                onClick={() => selectCapture(false)}
                className={`mb-4 flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition disabled:opacity-40 ${!showPhotobooth ? "border-[#b2f5cf] bg-[#b2f5cf]/10" : "border-base-content/15 bg-base-200/50"}`}
              >
                <Camera size={23} aria-hidden="true" /><span className="flex-1 text-sm font-semibold">Chụp thường</span>{!showPhotobooth && <Check size={18} aria-hidden="true" />}
              </button>
              <h3 className="mb-3 text-sm font-bold">Photobooth 4 ô</h3>
              <div className="grid grid-cols-2 gap-3">
                {PHOTOBOOTH_FRAMES.map((frame) => {
                  const selected = showPhotobooth && selectedFrameId === frame.id;
                  return (
                    <button
                      key={frame.id}
                      type="button"
                      aria-label={`Photobooth · ${frame.name}`}
                      aria-pressed={selected}
                      disabled={mediaIsLocked}
                      onClick={() => selectCapture(true, frame.id)}
                      className={`overflow-hidden rounded-2xl border p-2 text-left transition active:scale-95 disabled:opacity-40 ${selected ? "border-[#b2f5cf] bg-[#b2f5cf]/10" : "border-base-content/15 bg-base-200/50"}`}
                    >
                      <span className="relative mx-auto block aspect-square w-full max-w-36 overflow-hidden rounded-xl bg-base-300">
                        <span className="absolute inset-[10%] grid grid-cols-2 gap-[8%]" aria-hidden="true">
                          {[0, 1, 2, 3].map((cell) => <span key={cell} className="rounded-lg bg-base-content/15" />)}
                        </span>
                        {frame.src && <img src={frame.src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain" />}
                      </span>
                      <span className="mt-2 flex items-center gap-1 px-1 text-xs font-semibold"><span className="flex-1">{frame.name}</span>{selected && <Check size={15} aria-hidden="true" />}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div role="tabpanel" id="filter-panel-ai" aria-labelledby="filter-tab-ai">
              {!aiFilterEnabled ? (
                <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-3 text-center text-sm text-base-content/65">
                  {checkingAccess || !accessChecked ? <><LoaderCircle className="h-5 w-5 animate-spin" /><p>Đang kiểm tra quyền AI Filter…</p></> : <>
                    <LockKeyhole className="h-7 w-7 text-amber-400" />
                    <h3 className="font-bold text-base-content">AI Filter cần được admin bật quyền</h3>
                    <p>Bạn vẫn có thể chụp Photobooth và chọn khung ở tab bên cạnh.</p>
                    <a href="https://zalo.me/0359153413" target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#b2f5cf] px-4 py-2 font-semibold text-[#112219]">Liên hệ MTIEN</a>
                  </>}
                </div>
              ) : <>
                <div className="mb-3 flex items-center justify-between gap-2 text-sm"><p className="text-base-content/65">Chọn phong cách để tạo ảnh AI.</p><span className="rounded-full bg-amber-400/15 px-2 py-1 text-[11px] font-bold text-amber-400">Premium</span></div>
                {loadingCatalog && (
                  <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-base-content/60" role="status"><LoaderCircle className="h-5 w-5 animate-spin" />Đang tải filter…</div>
                )}
                {!loadingCatalog && catalogError && (
                  <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center text-sm text-base-content/60">
                    <p>Không tải được danh sách filter.</p>
                    <button type="button" onClick={() => setCatalogAttempt((value) => value + 1)} className="inline-flex items-center gap-2 rounded-full bg-base-200 px-4 py-2 font-semibold text-base-content transition active:scale-95"><RefreshCw className="h-4 w-4" />Thử lại</button>
                  </div>
                )}
                {!loadingCatalog && !catalogError && groups.map((group) => (
                  <div key={group.id} className="pb-5 pt-2">
                    <h3 className="mb-4 text-lg font-bold text-base-content">{group.title}</h3>
                    <div className="grid grid-cols-4 gap-x-4 gap-y-5">
                      {(group.filters || []).map((filter) => {
                        const selected = selectedAiFilter?.filter_id === filter.filter_id;
                        return (
                          <button type="button" key={filter.filter_id} onClick={() => selectFilter(filter)} disabled={aiSelectionLocked} className="group flex min-w-0 flex-col items-center text-center active:scale-95 disabled:opacity-40" aria-pressed={selected} title={filter.filter_label}>
                            <span className={`relative aspect-square w-full max-w-[64px] overflow-hidden rounded-[17px] bg-base-200 shadow-sm ring-offset-2 ring-offset-base-100 transition ${selected ? "ring-3 ring-amber-400" : "ring-0 group-hover:ring-2 group-hover:ring-base-300"}`}>
                              <img src={filter.icon_url} alt={filter.filter_label} loading="lazy" className="h-full w-full object-cover" />
                              {selected && <span className="absolute inset-0 grid place-items-center bg-amber-400/15"><Sparkles className="h-5 w-5 text-white drop-shadow" /></span>}
                            </span>
                            <span className="mt-2 w-full truncate text-[11px] leading-4 text-base-content/80">{filter.filter_label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function AiFilterStudio() {
  const { navigation } = useApp();
  return navigation.isAiFilterOpen ? <OpenFilterStudio /> : null;
}
