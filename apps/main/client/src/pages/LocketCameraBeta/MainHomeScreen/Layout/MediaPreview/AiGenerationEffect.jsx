import "./ai-generation-effect.css";

const AiGenerationEffect = ({ filterName }) => (
  <div
    role="status"
    aria-live="polite"
    aria-label={
      filterName
        ? `Đang tạo ảnh với filter ${filterName}`
        : "Đang tạo ảnh AI"
    }
    className="pointer-events-none absolute inset-0 z-40 overflow-hidden rounded-[65px] opacity-100 transition-opacity duration-500"
  >
    <span className="sr-only">Đang tạo ảnh AI…</span>
    <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
    <div className="t97-ai-scan-sweep absolute inset-0">
      <div className="h-32 w-full bg-gradient-to-b from-transparent via-white/10 to-white/40" />
      <div className="h-[3px] w-full bg-white shadow-[0_0_12px_#ffffff,0_0_24px_#ffffff,0_0_36px_rgba(255,255,255,0.9)]" />
    </div>
  </div>
);

export default AiGenerationEffect;
