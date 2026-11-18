import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, LoaderCircle, LockKeyhole, RefreshCw, Sparkles, X } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useCameraCaptureMode } from "@/hooks/useCameraCaptureMode";
import { PHOTOBOOTH_FRAMES } from "@/data/photoboothFrames";
import { CAMERA_FRAMES } from "@/data/cameraFrames";
import { useAuthStore, useUIStore } from "@/stores";
import { fetchAiFilters, getAllFrameCamera } from "@/services";
import { SonnerError } from "@/components/ui/SonnerToast";
import "./styles.css";

const errorMessage = (error) =>
  error?.response?.data?.message ||
  error?.response?.data?.error?.message ||
  error?.message ||
  "Không thể tải danh sách AI Filter.";

function FrameThumbnail({ src, booth = false, selected = false }) {
  return (
    <span className={`filter-studio-thumbnail${booth ? " filter-studio-thumbnail-booth" : ""}`}>
      {booth ? <span className="filter-studio-mini-grid" aria-hidden="true">{[0, 1, 2, 3].map((cell) => <span key={cell} />)}</span> : <Camera size={25} aria-hidden="true" />}
      {src && <img src={src} alt="" loading="lazy" />}
      {selected && <span className="filter-studio-check"><Check size={13} aria-hidden="true" /></span>}
    </span>
  );
}

function OpenFilterStudio() {
  const { navigation, post, camera, useloading } = useApp();
  const { setIsAiFilterOpen } = navigation;
  const { selectedFile, selectedAiFilter, setSelectedAiFilter } = post;
  const { showPhotobooth, selectedFrameId, mediaIsLocked, chooseCaptureMode } = useCameraCaptureMode();
  const cameraFrame = useUIStore((state) => state.cameraFrame);
  const setCameraFrame = useUIStore((state) => state.setCameraFrame);
  const aiFilterEnabled = useAuthStore((state) => state.aiFilterEnabled);
  const refreshAccessRole = useAuthStore((state) => state.refreshAccessRole);
  const scrollRef = useRef(null);
  const aiSectionRef = useRef(null);
  const closeRef = useRef(null);
  const [aiSectionVisible, setAiSectionVisible] = useState(Boolean(selectedAiFilter));
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [remoteFrames, setRemoteFrames] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const localFrameIds = new Set(CAMERA_FRAMES.map((frame) => String(frame.id)));
  const cameraFrames = [...CAMERA_FRAMES, ...remoteFrames.filter((frame) => !localFrameIds.has(String(frame.id)))];
  const aiSelectionLocked = Boolean(camera.isHolding || useloading.sendLoading ||
    useloading.uploadLoading || useloading.isAiGenerating || post.imageToCrop || post.videoCrop);
  const hasImage = Boolean(selectedFile?.type?.startsWith("image/"));
  const frameSelectionLocked = aiSelectionLocked || Boolean(selectedFile && !hasImage) ||
    (mediaIsLocked && !hasImage);

  useEffect(() => {
    let active = true;
    getAllFrameCamera().then((frames) => {
      if (!active || !Array.isArray(frames)) return;
      const ids = new Set();
      setRemoteFrames(frames.filter((frame) => {
        if (!frame || frame.id == null || typeof frame.name !== "string" ||
          typeof frame.imageSrc !== "string" || !frame.imageSrc || ids.has(String(frame.id))) return false;
        ids.add(String(frame.id));
        return true;
      }));
    }).catch(() => { /* The local frame collection stays available. */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    document.body.classList.add("overflow-hidden");
    const previousFocus = document.activeElement;
    closeRef.current?.focus({ preventScroll: true });
    if (selectedAiFilter) aiSectionRef.current?.scrollIntoView({ block: "start" });
    return () => {
      document.body.classList.remove("overflow-hidden");
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
    // Start at the existing selection when this sheet is opened again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (aiSectionVisible) return undefined;
    if (!window.IntersectionObserver) {
      setAiSectionVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setAiSectionVisible(true);
        observer.disconnect();
      }
    }, { root: scrollRef.current, rootMargin: "140px 0px" });
    if (aiSectionRef.current) observer.observe(aiSectionRef.current);
    return () => observer.disconnect();
  }, [aiSectionVisible]);

  // Local frames never require AI access or an AI catalogue request.
  useEffect(() => {
    if (!aiSectionVisible || aiFilterEnabled || accessChecked) return undefined;
    let active = true;
    setCheckingAccess(true);
    Promise.resolve(refreshAccessRole()).catch(() => null).finally(() => {
      if (active) {
        setCheckingAccess(false);
        setAccessChecked(true);
      }
    });
    return () => { active = false; };
  }, [aiSectionVisible, aiFilterEnabled, accessChecked, refreshAccessRole]);

  useEffect(() => {
    if (!aiSectionVisible || !aiFilterEnabled || catalogLoaded) return undefined;
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
  }, [aiSectionVisible, aiFilterEnabled, catalogAttempt, catalogLoaded]);

  const close = useCallback(() => {
    setIsAiFilterOpen(false);
  }, [setIsAiFilterOpen]);

  const selectCameraFrame = (frame) => {
    if (frameSelectionLocked) return;
    if (showPhotobooth && chooseCaptureMode(false) === false) return;
    setCameraFrame(frame);
    setSelectedAiFilter(null);
    close();
  };

  const selectPhotobooth = (frameId) => {
    if (mediaIsLocked || chooseCaptureMode(true, frameId) === false) return;
    // Booth exports already contain their frame, so the send flow must not add another.
    setCameraFrame(null);
    setSelectedAiFilter(null);
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
      className="filter-studio-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
        if (event.key === "Tab") {
          const controls = event.currentTarget.querySelectorAll('button:not(:disabled), a[href]');
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}
    >
      <section role="dialog" aria-modal="true" aria-label="Filter Studio" data-testid="ai-filter-studio" className="filter-studio-sheet">
        <div className="filter-studio-grip" aria-hidden="true" />
        <header className="filter-studio-header">
          <h2>Filter</h2>
          <button ref={closeRef} type="button" aria-label="Đóng Filter Studio" onClick={close}><X size={22} /></button>
        </header>

        <div ref={scrollRef} className="filter-studio-content" data-testid="filter-scroll-content">
          <section className="filter-studio-category" aria-labelledby="camera-frames-title">
            <h3 id="camera-frames-title">Khung viền</h3>
            <p>Chọn khung để xem trực tiếp khi chụp.</p>
            <div className="filter-studio-row" role="group" aria-label="Khung viền camera">
              <button type="button" aria-label="Chụp thường · Không khung" aria-pressed={!showPhotobooth && !cameraFrame?.imageSrc} disabled={frameSelectionLocked} onClick={() => selectCameraFrame(null)} className="filter-studio-option">
                <FrameThumbnail selected={!showPhotobooth && !cameraFrame?.imageSrc} />
                <span>Không khung</span>
              </button>
              {cameraFrames.map((frame) => {
                const selected = !showPhotobooth && cameraFrame?.id === frame.id;
                return (
                  <button key={frame.id} type="button" aria-label={`Khung viền · ${frame.name}`} aria-pressed={selected} disabled={frameSelectionLocked} onClick={() => selectCameraFrame(frame)} className="filter-studio-option">
                    <FrameThumbnail src={frame.imageSrc} selected={selected} />
                    <span>{frame.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="filter-studio-category" aria-labelledby="photobooth-frames-title">
            <h3 id="photobooth-frames-title">Photobooth 4 ảnh</h3>
            <p>Chụp từng ô bằng tay hoặc đếm ngược.</p>
            {mediaIsLocked && <p className="filter-studio-hint" role="status">Hoàn tất hoặc huỷ ảnh đang chọn để chuyển sang Photobooth.</p>}
            <div className="filter-studio-row" role="group" aria-label="Khung Photobooth 4 ảnh">
              {PHOTOBOOTH_FRAMES.map((frame) => {
                const selected = showPhotobooth && selectedFrameId === frame.id;
                return (
                  <button key={frame.id} type="button" aria-label={`Photobooth · ${frame.name}`} aria-pressed={selected} disabled={mediaIsLocked} onClick={() => selectPhotobooth(frame.id)} className="filter-studio-option">
                    <FrameThumbnail src={frame.src} booth selected={selected} />
                    <span>{frame.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section ref={aiSectionRef} className="filter-studio-category filter-studio-ai" aria-labelledby="ai-filters-title">
            <div className="filter-studio-category-heading"><h3 id="ai-filters-title">AI Filter</h3><span className="filter-studio-premium"><Sparkles size={12} />Premium</span></div>
            <p>Chọn phong cách để tạo ảnh AI.</p>
            {!aiSectionVisible ? <div className="filter-studio-status">Cuộn để xem AI Filter.</div> : !aiFilterEnabled ? (
              <div className="filter-studio-status">
                {checkingAccess || !accessChecked ? <><LoaderCircle className="animate-spin" size={19} /><span>Đang kiểm tra quyền AI Filter…</span></> : <>
                  <LockKeyhole size={20} /><span>Mua gói AI Filter để sử dụng tính năng này.</span>
                  <a href="/pricing?tab=ai" onClick={(e) => { e.preventDefault(); window.location.href = "/pricing?tab=ai"; }}>Mua AI Filter</a>
                </>}
              </div>
            ) : <>
              {loadingCatalog && <div className="filter-studio-status" role="status"><LoaderCircle className="animate-spin" size={19} /><span>Đang tải filter…</span></div>}
              {!loadingCatalog && catalogError && <div className="filter-studio-status"><span>Không tải được danh sách AI Filter.</span><button type="button" onClick={() => setCatalogAttempt((value) => value + 1)}><RefreshCw size={15} />Thử lại</button></div>}
              {!loadingCatalog && !catalogError && catalogLoaded && !groups.length && <div className="filter-studio-status">Chưa có AI Filter.</div>}
              {!loadingCatalog && !catalogError && groups.map((group) => (
                <div key={group.id} className="filter-studio-ai-group">
                  <h4>{group.title}</h4>
                  <div className="filter-studio-row" role="group" aria-label={group.title}>
                    {(group.filters || []).map((filter) => {
                      const selected = selectedAiFilter?.filter_id === filter.filter_id;
                      return (
                        <button type="button" key={filter.filter_id} onClick={() => selectFilter(filter)} disabled={aiSelectionLocked} className="filter-studio-option" aria-pressed={selected} title={filter.filter_label}>
                          <span className="filter-studio-thumbnail filter-studio-ai-thumbnail"><img src={filter.icon_url} alt="" loading="lazy" />{selected && <span className="filter-studio-check"><Check size={13} aria-hidden="true" /></span>}</span>
                          <span>{filter.filter_label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>}
          </section>
        </div>
      </section>
    </div>
  );
}

export default function AiFilterStudio() {
  const { navigation } = useApp();
  return navigation.isAiFilterOpen ? <OpenFilterStudio /> : null;
}
