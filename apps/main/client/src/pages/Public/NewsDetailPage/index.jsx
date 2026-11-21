import { useLocation, useParams, Link } from "react-router-dom";
import { ArrowLeft, Calendar, Sparkles, Heart, Eye, Megaphone, Pin, RefreshCw, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getListNewFeeds } from "@/services";
import { CONFIG } from "@/config";
import { RiShareForwardLine } from "react-icons/ri";
import NewsContentBlocks from "./NewsContentBlocks";

const isNotice = (article) => article?.source === "admin-notification" || String(article?.slug || "").startsWith("notification-");
const dateValue = (value) => {
  if (value && typeof value === "object") return (value.seconds ?? value._seconds ?? 0) * 1000;
  const date = typeof value === "number" ? value : Date.parse(value || "");
  return Number.isFinite(date) ? date : 0;
};
const formatDate = (value) => dateValue(value) ? new Date(dateValue(value)).toLocaleString("vi-VN") : "";
const cancelled = (error, signal) => signal.aborted || ["AbortError", "CanceledError"].includes(error?.name) || error?.code === "ERR_CANCELED";

function NoticeText({ text }) {
  return <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm sm:text-base leading-relaxed text-base-content/90">{String(text || "").split(/(https:\/\/[^\s<>"']+)/g).map((part, index) => {
    if (!part.startsWith("https://")) return part;
    try {
      const url = new URL(part);
      if (url.protocol === "https:") return <a key={index} href={url.href} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">{part}</a>;
    } catch { /* Invalid URLs remain plain text. */ }
    return part;
  })}</div>;
}

export default function NewsDetailPage() {
  const { slug } = useParams();
  const location = useLocation();
  const [page, setPage] = useState({ slug: null, article: null, loading: true, refreshing: false, error: "", notFound: false });
  const mountedRef = useRef(false);
  const loadedRef = useRef(false);
  const inFlightRef = useRef(false);
  const requestRef = useRef(0);
  const abortRef = useRef(null);
  const currentPage = page.slug === slug ? page : { article: null, loading: true, refreshing: false, error: "", notFound: false };
  const news = currentPage.article;
  const notice = isNotice(news);

  const load = useCallback(async ({ force = false } = {}) => {
    if (!mountedRef.current || (inFlightRef.current && !force)) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const request = ++requestRef.current;
    inFlightRef.current = true;
    setPage((previous) => ({ ...(previous.slug === slug ? previous : { slug, article: null }), loading: !loadedRef.current || !(previous.slug === slug && previous.article), refreshing: loadedRef.current, error: "", notFound: false }));
    try {
      const article = slug ? await getListNewFeeds(slug, { signal: controller.signal }) : null;
      if (mountedRef.current && request === requestRef.current && !controller.signal.aborted) {
        loadedRef.current = true;
        setPage({ slug, article, notFound: !article, error: "", loading: false, refreshing: false });
      }
    } catch (cause) {
      if (mountedRef.current && request === requestRef.current && !cancelled(cause, controller.signal)) {
        setPage((previous) => ({ slug, article: previous.slug === slug ? previous.article : null, notFound: false, error: "Không tải được bài viết. Hãy kiểm tra kết nối và thử lại.", loading: false, refreshing: false }));
      }
    } finally {
      if (mountedRef.current && request === requestRef.current) inFlightRef.current = false;
    }
  }, [slug]);

  useEffect(() => {
    mountedRef.current = true;
    loadedRef.current = false;
    load({ force: true });
    const refreshVisible = () => { if (document.visibilityState !== "hidden") load({ force: true }); };
    const pollVisible = () => { if (document.visibilityState !== "hidden") load(); };
    document.addEventListener("visibilitychange", refreshVisible);
    window.addEventListener("focus", refreshVisible);
    window.addEventListener("mtien-notifications-updated", refreshVisible);
    const interval = setInterval(pollVisible, 60000);
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
      inFlightRef.current = false;
      abortRef.current?.abort();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshVisible);
      window.removeEventListener("focus", refreshVisible);
      window.removeEventListener("mtien-notifications-updated", refreshVisible);
    };
  }, [load]);

  useEffect(() => {
    document.title = `${news?.title || (currentPage.notFound ? "Không tìm thấy bài viết" : "Bảng tin")} | ${CONFIG.app.fullName}`;
    const url = window.location.origin + location.pathname;
    const canonical = document.querySelector("link[rel='canonical']") || document.head.appendChild(Object.assign(document.createElement("link"), { rel: "canonical" }));
    canonical.href = url;
    for (const [selector, content] of [["meta[property='og:title']", document.title], ["meta[property='og:url']", url], ["meta[name='twitter:title']", document.title]]) {
      document.querySelector(selector)?.setAttribute("content", content);
    }
  }, [location.pathname, news, currentPage.notFound]);

  const published = news && formatDate(news.published_at || news.start_at);
  const updated = news && formatDate(news.updated_at);
  const noticeBody = news && (news.message ?? news.description ?? (news.content?.blocks || []).filter((block) => block.type === "text" && typeof block.data === "string").map((block) => block.data).join("\n\n"));

  return (
    <div className="max-w-4xl mx-auto py-6 px-5 sm:px-6 min-h-[65vh]">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-7">
        <Link to="/newsfeed" className="inline-flex items-center gap-2 text-sm text-primary font-medium"><ArrowLeft size={16} aria-hidden="true" />Quay lại bảng tin</Link>
        <button type="button" className="btn btn-outline btn-sm" disabled={currentPage.loading || currentPage.refreshing} onClick={() => load({ force: true })}><RefreshCw size={15} aria-hidden="true" />{currentPage.refreshing ? "Đang cập nhật…" : "Tải lại bài viết"}</button>
      </div>
      {currentPage.error && <div role="alert" className="rounded-xl border border-error/30 bg-error/10 p-4 text-sm mb-6"><p>{currentPage.error}{news ? " Nội dung đã tải vẫn được giữ lại." : ""}</p><button type="button" className="btn btn-outline btn-sm mt-3" disabled={currentPage.refreshing} onClick={() => load({ force: true })}>Thử tải lại bài viết</button></div>}
      {currentPage.loading ? <div className="flex items-center justify-center gap-3 py-20 text-sm text-base-content/70" role="status"><LoaderCircle size={20} className="animate-spin" aria-hidden="true" />Đang tải bài viết…</div> : currentPage.notFound ? <div className="rounded-2xl border border-base-300 bg-base-100 p-8 text-center"><Sparkles size={28} className="mx-auto text-primary mb-4" aria-hidden="true" /><h1 className="text-xl font-semibold">Không tìm thấy bài viết này</h1><p className="text-sm text-base-content/65 mt-3 leading-relaxed">Bài viết có thể đã bị xóa hoặc đường dẫn không còn đúng. Bạn có thể quay lại bảng tin để xem các thông báo khác.</p></div> : news ? <article className="min-w-0" aria-busy={currentPage.refreshing}>
        {notice && <div className="flex flex-wrap items-center gap-3 mb-4 text-xs text-primary"><span className="inline-flex items-center gap-2"><Megaphone size={16} aria-hidden="true" />Ban quản trị</span>{news.pinned === true && <span className="inline-flex items-center gap-1"><Pin size={13} aria-hidden="true" />Đã ghim</span>}</div>}
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4 break-words">{news.title}</h1>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-base-content/55 mb-6">
          <div className="space-y-1">{published && <div className="flex items-center gap-2"><Calendar size={14} aria-hidden="true" /><span>{published}</span></div>}{updated && news.updated_at !== news.published_at && <p>Cập nhật: {updated}</p>}</div>
          {!notice && <div className="flex items-center gap-4"><span className="flex items-center gap-1"><Eye size={14} />{news.interactions?.views ?? 0}</span><span className="flex items-center gap-1"><Heart size={14} />{news.interactions?.likes ?? 0}</span><span className="flex items-center gap-1"><RiShareForwardLine size={15} />{news.interactions?.shares ?? 0}</span></div>}
        </div>
        {!notice && news.thumbnail && <img src={news.thumbnail} alt={news.title} className="rounded-2xl max-h-96 max-w-full mb-5 object-cover" />}
        {Array.isArray(news.tags) && news.tags.length > 0 && <div className="flex flex-wrap gap-2 mb-5">{news.tags.map((tag) => <span key={tag} className="bg-base-200 text-base-content/70 text-xs px-2 py-1 rounded-lg">#{tag}</span>)}</div>}
        <div className="h-px bg-base-300 mb-6" />
        {notice ? <NoticeText text={noticeBody} /> : <NewsContentBlocks blocks={news.content?.blocks} title={news.title} />}
      </article> : currentPage.error ? <h1 className="text-xl font-semibold">Không tải được bài viết</h1> : null}
    </div>
  );
}
