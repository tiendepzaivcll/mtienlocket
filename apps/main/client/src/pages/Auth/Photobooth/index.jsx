import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Camera, Check, Download, LoaderCircle, RefreshCcw, RotateCcw, Square, Timer } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { capturePhotoboothFrame, composePhotoboothGrid, getPhotoboothGrid } from "@/utils/photobooth";
import { PHOTOBOOTH_FRAMES } from "@/data/photoboothFrames";
import { usePhotoboothCamera } from "./usePhotoboothCamera";
import "./styles.css";

const emptyPhotos = () => Array(4).fill(null);
const defaultLayout = getPhotoboothGrid();
const defaultPhotoRegions = defaultLayout.tiles.map(({ x, y, width, height }) => ({
  x: x / defaultLayout.size, y: y / defaultLayout.size,
  width: width / defaultLayout.size, height: height / defaultLayout.size,
}));
const regionStyle = ({ x, y, width, height }) => ({
  left: `${x * 100}%`, top: `${y * 100}%`,
  width: `${width * 100}%`, height: `${height * 100}%`,
});

export default function Photobooth() {
  const navigate = useNavigate();
  const { post, camera: locketCamera, useloading } = useApp();
  const [photos, setPhotos] = useState(emptyPhotos);
  const photosRef = useRef(photos);
  const [mode, setMode] = useState("manual");
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [flash, setFlash] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [composing, setComposing] = useState(false);
  const [composeVersion, setComposeVersion] = useState(0);
  const [selectedFrameId, setSelectedFrameId] = useState("none");
  const [frameAsset, setFrameAsset] = useState({ id: "none", status: "ready", message: "" });
  const [frameRetryVersion, setFrameRetryVersion] = useState(0);
  const [thumbnailFailures, setThumbnailFailures] = useState({});
  const selectedFrame = PHOTOBOOTH_FRAMES.find((frame) => frame.id === selectedFrameId) || PHOTOBOOTH_FRAMES[0];
  const photoRegions = selectedFrame.photoRegions || defaultPhotoRegions;
  const frameIsReady = !selectedFrame.src || (frameAsset.id === selectedFrame.id && frameAsset.status === "ready");
  const frameIsLoading = Boolean(selectedFrame.src && (frameAsset.id !== selectedFrame.id || frameAsset.status === "loading"));
  const frameError = selectedFrame.src && frameAsset.id === selectedFrame.id && frameAsset.status === "error" ? frameAsset.message : "";
  const mountedRef = useRef(false);
  const runRef = useRef(0);
  const busyRef = useRef(false);
  const timerRef = useRef(null);
  const flashTimerRef = useRef(null);
  const count = photos.filter(Boolean).length;
  const complete = count === 4;
  const nextIndex = photos.findIndex((photo) => !photo);
  const camera = usePhotoboothCamera({ enabled: !complete });
  const canUseResult = Boolean(complete && frameIsReady && !error && !composing &&
    result?.frameId === selectedFrame.id && result?.photos === photos &&
    result?.composeVersion === composeVersion && result?.frameRetryVersion === frameRetryVersion);

  const cancelCapture = useCallback(() => {
    runRef.current += 1;
    if (timerRef.current) {
      clearTimeout(timerRef.current.id);
      timerRef.current.resolve(false);
      timerRef.current = null;
    }
    busyRef.current = false;
    if (mountedRef.current) {
      setRunning(false);
      setBusy(false);
      setCountdown(null);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        cancelCapture();
        setMessage("Đã tạm dừng. Bấm chụp để tiếp tục khi bạn sẵn sàng.");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mountedRef.current = false;
      cancelCapture();
      clearTimeout(flashTimerRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
      photosRef.current.forEach((photo) => photo && URL.revokeObjectURL(photo.url));
    };
  }, [cancelCapture]);

  useEffect(() => {
    if (!selectedFrame.src) {
      setFrameAsset({ id: selectedFrame.id, status: "ready", message: "" });
      return undefined;
    }
    let cancelled = false;
    const image = new Image();
    setFrameAsset({ id: selectedFrame.id, status: "loading", message: "" });
    const fail = () => {
      if (!cancelled) setFrameAsset({ id: selectedFrame.id, status: "error", message: "Không tải được khung này. Hãy thử lại hoặc chọn khung khác." });
    };
    const timeout = setTimeout(fail, 15000);
    image.onload = () => {
      clearTimeout(timeout);
      if (cancelled) return;
      if (!image.naturalWidth || !image.naturalHeight) { fail(); return; }
      setFrameAsset({ id: selectedFrame.id, status: "ready", message: "" });
    };
    image.onerror = () => { clearTimeout(timeout); fail(); };
    image.src = selectedFrame.src;
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
    };
  }, [selectedFrame, frameRetryVersion]);

  useEffect(() => {
    setResult(null);
    setError("");
    if (!photos.every(Boolean) || !frameIsReady) {
      setComposing(false);
      return undefined;
    }
    let cancelled = false;
    let url;
    setComposing(true);
    composePhotoboothGrid(photos.map((photo) => photo.url), { frame: selectedFrame.src ? selectedFrame : null })
      .then((file) => {
        if (cancelled) return;
        url = URL.createObjectURL(file);
        setResult({ file, url, frameId: selectedFrame.id, photos, composeVersion, frameRetryVersion });
      })
      .catch((cause) => {
        if (!cancelled) setError(cause.message || "Không ghép được ảnh. Hãy thử lại.");
      })
      .finally(() => { if (!cancelled) setComposing(false); });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [photos, composeVersion, selectedFrame, frameIsReady, frameRetryVersion]);

  const wait = (milliseconds, id) => new Promise((resolve) => {
    const handle = setTimeout(() => {
      timerRef.current = null;
      resolve(mountedRef.current && id === runRef.current && document.visibilityState !== "hidden");
    }, milliseconds);
    timerRef.current = { id: handle, resolve };
  });

  const takeFrame = async (index, id) => {
    const file = await capturePhotoboothFrame(camera.videoRef.current, {
      mirror: camera.facingMode === "user",
      size: 1024,
      filename: `locket-pro-photobooth-${index + 1}-${Date.now()}.jpg`,
    });
    if (!mountedRef.current || id !== runRef.current || document.visibilityState === "hidden") return false;
    const url = URL.createObjectURL(file);
    const updated = [...photosRef.current];
    if (updated[index]) URL.revokeObjectURL(updated[index].url);
    updated[index] = { file, url };
    photosRef.current = updated;
    setPhotos(updated);
    setFlash(index);
    clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => { if (mountedRef.current) setFlash(null); }, 180);
    return true;
  };

  const captureManual = async () => {
    if (busyRef.current || !camera.isReady || complete) return;
    busyRef.current = true;
    const id = ++runRef.current;
    const index = photosRef.current.findIndex((photo) => !photo);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await takeFrame(index, id);
    } catch (cause) {
      if (mountedRef.current && id === runRef.current) setError(cause.message || "Chưa chụp được ảnh. Hãy thử lại.");
    } finally {
      if (mountedRef.current && id === runRef.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };

  const captureAutomatic = async () => {
    if (busyRef.current || !camera.isReady || complete) return;
    busyRef.current = true;
    const id = ++runRef.current;
    setRunning(true);
    setError("");
    setMessage("");
    try {
      while (photosRef.current.some((photo) => !photo)) {
        const index = photosRef.current.findIndex((photo) => !photo);
        for (let seconds = 3; seconds >= 1; seconds -= 1) {
          setCountdown(seconds);
          if (!await wait(1000, id)) return;
        }
        setCountdown(null);
        if (!await takeFrame(index, id)) return;
      }
    } catch (cause) {
      if (mountedRef.current && id === runRef.current) setError(cause.message || "Lượt chụp đã dừng. Bạn có thể tiếp tục.");
    } finally {
      if (mountedRef.current && id === runRef.current) {
        busyRef.current = false;
        setRunning(false);
        setCountdown(null);
      }
    }
  };

  const retake = (index) => {
    if (busyRef.current) return;
    const updated = [...photosRef.current];
    if (updated[index]) URL.revokeObjectURL(updated[index].url);
    updated[index] = null;
    photosRef.current = updated;
    setPhotos(updated);
    setMessage(`Chụp lại ô ${index + 1}. Các ảnh khác được giữ nguyên.`);
  };

  const reset = () => {
    cancelCapture();
    photosRef.current.forEach((photo) => photo && URL.revokeObjectURL(photo.url));
    const updated = emptyPhotos();
    photosRef.current = updated;
    setPhotos(updated);
    setFlash(null);
    setMessage("");
    setError("");
  };

  const chooseFrame = (id) => {
    if (busyRef.current || running || id === selectedFrameId) return;
    setResult(null);
    setError("");
    setSelectedFrameId(id);
  };

  const retryFrame = () => {
    setResult(null);
    setFrameAsset({ id: selectedFrame.id, status: "loading", message: "" });
    setThumbnailFailures((previous) => ({ ...previous, [selectedFrame.id]: false }));
    setFrameRetryVersion((version) => version + 1);
  };

  const useOnLocket = () => {
    if (!canUseResult || !result?.file) return;
    const file = result.file;
    // The post preview owns a fresh URL; gallery cleanup cannot revoke it.
    const previewUrl = URL.createObjectURL(file);
    post.setImageToCrop(null);
    post.setVideoCrop(null);
    post.setVideoCropArea(null);
    post.setSelectedQueue(null);
    post.setSelectedQueueId(null);
    post.setSelectedAiFilter(null);
    post.setSelectedFile(file);
    post.setPreview({ type: "image", data: previewUrl });
    post.setSizeMedia((file.size / (1024 * 1024)).toFixed(2));
    useloading.setIsCaptionLoading(true);
    locketCamera.setCameraActive(false);
    navigate("/locket-beta");
  };

  return (
    <div className="photobooth-page">
      <div className="photobooth-container">
        <Link to="/locket-beta" className="photobooth-back"><ArrowLeft size={16} />Về Locket</Link>
        <div className="photobooth-heading"><div><p>LOCKET-PRO / ADMIN MTIEN</p><h1>Photobooth <span>4 ô.</span></h1></div><p>Bốn khoảnh khắc.<br />Một khung hình của bạn.</p></div>

        <div className="photobooth-layout">
          <section className="photobooth-stage" aria-label="Khung Photobooth chia bốn ô">
            <div className={`photobooth-grid${selectedFrame.src ? " has-frame" : ""}`} data-testid="photobooth-grid" data-frame={selectedFrame.id} aria-label={`Khung ${selectedFrame.name}`} aria-busy={frameIsLoading}>
              {photos.map((photo, index) => (
                <div key={index} className={`photobooth-cell ${index === nextIndex ? "is-current" : ""}`} style={regionStyle(photoRegions[index])} data-testid={`photobooth-cell-${index + 1}`}>
                  {photo ? <img src={photo.url} alt={`Ảnh Photobooth ô ${index + 1}`} /> : index === nextIndex ? (
                    <><video ref={camera.attachVideoRef} autoPlay playsInline muted className={camera.facingMode === "user" ? "is-mirrored" : ""} aria-label={`Camera đang chụp ô ${index + 1}`} />{!camera.isReady && <div className="photobooth-placeholder"><Camera size={25} /><span>{camera.isStarting ? "Đang mở camera…" : "Chờ camera"}</span></div>}</>
                  ) : <div className="photobooth-placeholder"><Camera size={22} /><span>Chờ chụp</span></div>}
                  <span className="photobooth-cell-number">0{index + 1}</span>
                  {photo && <button type="button" className="photobooth-retake" disabled={running || busy} onClick={() => retake(index)} aria-label={`Chụp lại ô ${index + 1}`}><RotateCcw size={16} /></button>}
                  {index === nextIndex && countdown !== null && <div className="photobooth-countdown" aria-live="assertive">{countdown}</div>}
                  {flash === index && <div className="photobooth-flash" aria-hidden="true" />}
                </div>
              ))}
              {selectedFrame.src && <img key={`${selectedFrame.id}-${frameRetryVersion}`} className={`photobooth-frame-overlay${frameIsReady ? " is-ready" : ""}`} src={selectedFrame.src} alt="" aria-hidden="true" draggable="false" onError={() => setFrameAsset({ id: selectedFrame.id, status: "error", message: "Không tải được khung này. Hãy thử lại hoặc chọn khung khác." })} />}
            </div>
            <div className="photobooth-stage-meta"><span><span className={complete ? "photobooth-dot is-complete" : "photobooth-dot"} />{complete ? "Đủ bốn khoảnh khắc" : `Đang ở ô ${nextIndex + 1}`}</span><span aria-live="polite">{count}/4 ảnh</span></div>
            <div className="photobooth-stage-controls">
            {complete ? <div className="photobooth-result-actions"><div className="photobooth-complete"><Check size={18} /><span>{frameIsLoading ? "Đang tải khung ảnh…" : composing ? "Đang ghép bốn ảnh…" : canUseResult ? "Khung hình của bạn đã sẵn sàng." : "Chưa thể tạo ảnh ghép."}</span></div><button type="button" className="photobooth-primary" disabled={!canUseResult} onClick={useOnLocket}>Dùng ảnh này trên Locket<ArrowRight size={18} /></button>{canUseResult && <a className="photobooth-secondary" href={result.url} download={result.file.name}><Download size={17} />Lưu ảnh ghép</a>}<p className="photobooth-hint">Thêm caption và chọn bạn bè ở bước đăng Locket.</p></div> : <>
              <button type="button" className="photobooth-primary" disabled={!running && (!camera.isReady || busy)} onClick={running ? () => { cancelCapture(); setMessage("Đã dừng. Bạn có thể tiếp tục các ô còn lại."); } : mode === "automatic" ? captureAutomatic : captureManual}>{running ? <><Square size={17} />Dừng chụp</> : busy || camera.isStarting ? <><LoaderCircle size={18} className="photobooth-spinner" />Đang chuẩn bị…</> : <><Camera size={19} />{mode === "automatic" ? `Bắt đầu chụp ${4 - count} ảnh` : `Chụp ô ${nextIndex + 1}`}</>}</button>
              <button type="button" className="photobooth-secondary" disabled={running || busy || camera.isStarting} onClick={camera.flipCamera}><RefreshCcw size={17} />Đổi camera</button>
            </>}
            {count > 0 && <button type="button" className="photobooth-reset" disabled={running || busy} onClick={reset}><RotateCcw size={15} />Chụp lại từ đầu</button>}
            <p className="photobooth-message" aria-live="polite">{message}</p>
            <div className="photobooth-footer-note">Chụp xong có thể bấm vào biểu tượng chụp lại ở từng ô để đổi riêng tấm đó.</div>
            </div>
          </section>

          <section className="photobooth-panel" aria-label="Điều khiển Photobooth">
            <div className="photobooth-panel-title"><span>CHỌN CÁCH CHỤP</span><h2>Theo nhịp của bạn.</h2></div>
            <div className="photobooth-modes" role="group" aria-label="Chế độ chụp">
              <button type="button" aria-pressed={mode === "manual"} disabled={running || busy} onClick={() => setMode("manual")}><Camera size={19} /><strong>Bấm chụp</strong><span>Chủ động từng tấm</span></button>
              <button type="button" aria-pressed={mode === "automatic"} disabled={running || busy} onClick={() => setMode("automatic")}><Timer size={19} /><strong>Đếm ngược</strong><span>3 giây cho mỗi ô</span></button>
            </div>
            <p className="photobooth-mode-description">{mode === "manual" ? "Tạo dáng rồi bấm chụp cho từng ô. Chụp đủ bốn tấm để hoàn thành khung hình." : "Bấm bắt đầu một lần. Máy sẽ đếm ngược 3 giây trước mỗi tấm và lần lượt chụp đủ bốn ô."}</p>

            <section className="photobooth-frames" aria-labelledby="photobooth-frames-title">
              <div className="photobooth-frames-heading"><h3 id="photobooth-frames-title">CHỌN KHUNG ẢNH</h3><span>{selectedFrame.name}</span></div>
              <div className="photobooth-frame-options" role="group" aria-label="Khung ảnh Photobooth">
                {PHOTOBOOTH_FRAMES.map((frame) => (
                  <button type="button" className="photobooth-frame-option" key={frame.id} aria-pressed={selectedFrame.id === frame.id} disabled={running || busy} onClick={() => chooseFrame(frame.id)}>
                    <span className="photobooth-frame-thumbnail" aria-hidden="true">
                      {(frame.photoRegions || defaultPhotoRegions).map((region, index) => <span className="photobooth-frame-mini-photo" key={index} style={regionStyle(region)} />)}
                      {frame.src && !thumbnailFailures[frame.id] && <img src={frame.src} alt="" loading="lazy" onError={() => setThumbnailFailures((previous) => ({ ...previous, [frame.id]: true }))} />}
                      {thumbnailFailures[frame.id] && <span className="photobooth-frame-thumbnail-error">Chưa tải được</span>}
                      {selectedFrame.id === frame.id && <span className="photobooth-frame-selected"><Check size={12} /></span>}
                    </span>
                    <span className="photobooth-frame-name">{frame.name}</span>
                  </button>
                ))}
              </div>
              <p className="photobooth-frame-help">Đổi khung bất cứ lúc nào, không cần chụp lại ảnh.</p>
              {frameIsLoading && <p className="photobooth-frame-loading" role="status"><LoaderCircle size={13} className="photobooth-spinner" />Đang tải khung ảnh…</p>}
            </section>

            {(camera.error || error || frameError) && <div className="photobooth-error" role="alert"><p>{frameError || error || camera.error}</p>{camera.error && <button type="button" onClick={camera.startCamera} disabled={camera.isStarting}>Thử mở camera</button>}{frameError && <button type="button" onClick={retryFrame}>Thử tải lại khung</button>}{complete && error && !frameError && <button type="button" onClick={() => setComposeVersion((value) => value + 1)}>Ghép lại ảnh</button>}</div>}

          </section>
        </div>
      </div>
    </div>
  );
}
