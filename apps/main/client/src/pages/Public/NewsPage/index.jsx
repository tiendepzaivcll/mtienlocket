import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Calendar, Megaphone, Gift, Lightbulb, Filter, ExternalLink, ChevronLeft, ChevronRight, Eye, Heart, Pin, RefreshCw, LoaderCircle } from "lucide-react";
import { RiShareForwardLine } from "react-icons/ri";
import { getListNewFeeds } from "@/services";
import { CONFIG } from "@/config";

const iconMap = { update: Sparkles, event: Gift, announcement: Megaphone, tip: Lightbulb };
const isNotice = (article) => article.source === "admin-notification" || String(article.slug || "").startsWith("notification-");
const dateValue = (value) => {
  if (value && typeof value === "object") return (value.seconds ?? value._seconds ?? 0) * 1000;
  const date = typeof value === "number" ? value : Date.parse(value || "");
  return Number.isFinite(date) ? date : 0;
};
const formatDate = (value) => dateValue(value) ? new Date(dateValue(value)).toLocaleDateString("vi-VN") : "";
const cancelled = (error, signal) => signal.aborted || ["AbortError", "CanceledError"].includes(error?.name) || error?.code === "ERR_CANCELED";
const visible = () => document.visibilityState !== "hidden";

export default function NewsPage() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollRef = useRef(null);
  const mountedRef = useRef(false);
  const loadedRef = useRef(false);
  const inFlightRef = useRef(false);
  const requestRef = useRef(0);
  const abortRef = useRef(null);

  const load = useCallback(async ({ force = false } = {}) => {
    if (!mountedRef.current || (inFlightRef.current && !force)) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const request = ++requestRef.current;
    inFlightRef.current = true;
    setLoading(!loadedRef.current);
    setRefreshing(loadedRef.current);
    setError("");
    try {
      const articles = await getListNewFeeds(undefined, { signal: controller.signal });
      if (!Array.isArray(articles)) throw new Error("Không đọc được danh sách bảng tin.");
      if (mountedRef.current && request === requestRef.current && !controller.signal.aborted) {
        loadedRef.current = true;
        setNews(articles);
      }
    } catch (cause) {
      if (mountedRef.current && request === requestRef.current && !cancelled(cause, controller.signal)) {
        setError(loadedRef.current ? "Không cập nhật được bảng tin. Nội dung đã tải vẫn được giữ lại; bạn có thể thử tải lại." : "Không tải được bảng tin. Hãy kiểm tra kết nối và thử lại.");
      }
    } finally {
      if (mountedRef.current && request === requestRef.current) {
        inFlightRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load({ force: true });
    const refreshVisible = () => { if (visible()) load({ force: true }); };
    const pollVisible = () => { if (visible()) load(); };
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

  const orderedNews = useMemo(() => [...news].sort((a, b) =>
    Number(b.pinned === true) - Number(a.pinned === true) ||
    dateValue(b.published_at || b.start_at) - dateValue(a.published_at || a.start_at)
  ), [news]);
  const counts = news.reduce((result, article) => {
    const category = article.category || (isNotice(article) ? "announcement" : "unknown");
    result[category] = (result[category] || 0) + 1;
    return result;
  }, {});
  const definitions = CONFIG.ui.categories.some((category) => category.id === "announcement")
    ? CONFIG.ui.categories : [...CONFIG.ui.categories, { id: "announcement", label: "Thông báo" }];
  const categories = [
    { id: "all", label: "Tất cả", icon: Filter, length: news.length },
    ...definitions.map((category) => ({ ...category, label: category.id === "announcement" ? "Thông báo" : category.label, icon: iconMap[category.id] || Sparkles, length: counts[category.id] || 0 })),
  ];
  const filteredNews = selectedCategory === "all" ? orderedNews : orderedNews.filter((article) => (article.category || (isNotice(article) ? "announcement" : "unknown")) === selectedCategory);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;
    const checkScroll = () => {
      setCanScrollLeft(element.scrollLeft > 1);
      setCanScrollRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 1);
    };
    checkScroll();
    element.addEventListener("scroll", checkScroll);
    window.addEventListener("resize", checkScroll);
    return () => { element.removeEventListener("scroll", checkScroll); window.removeEventListener("resize", checkScroll); };
  }, [news]);
  const scrollBy = (offset) => scrollRef.current?.scrollBy({ left: offset, behavior: "smooth" });

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto py-7 px-5 sm:px-6 relative">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div><h1 className="text-4xl font-semibold tracking-tight text-base-content">Bảng tin</h1><p className="text-base-content/70 mt-3 max-w-xl text-sm leading-relaxed">Cập nhật về LOCKET-PRO và những thông báo mới nhất từ admin MTIEN.</p></div>
          <button type="button" className="btn btn-outline btn-sm" disabled={loading || refreshing} onClick={() => load({ force: true })}><RefreshCw size={15} aria-hidden="true" />{refreshing ? "Đang cập nhật…" : "Tải lại bảng tin"}</button>
        </div>
        <div className="relative mb-5">
          <div className="flex items-center gap-2 mb-2 text-base-content/60 text-xs font-medium"><Filter size={14} aria-hidden="true" />Danh mục</div>
          {canScrollLeft && <button type="button" aria-label="Danh mục trước" onClick={() => scrollBy(-200)} className="absolute left-0 top-8 z-10 p-2 bg-base-100 rounded-full border border-base-300"><ChevronLeft size={18} /></button>}
          {canScrollRight && <button type="button" aria-label="Danh mục tiếp theo" onClick={() => scrollBy(200)} className="absolute right-0 top-8 z-10 p-2 bg-base-100 rounded-full border border-base-300"><ChevronRight size={18} /></button>}
          <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-2 scroll-smooth" role="group" aria-label="Lọc danh mục bảng tin">
            {categories.map(({ id, label, icon: Icon, length }) => <button type="button" key={id} aria-pressed={selectedCategory === id} onClick={() => setSelectedCategory(id)} className={`flex shrink-0 items-center gap-2 px-3 py-2.5 rounded-xl whitespace-nowrap text-xs font-medium transition-colors ${selectedCategory === id ? "bg-primary text-primary-content" : "bg-base-100 text-base-content/70 hover:bg-base-200"}`}><Icon size={15} aria-hidden="true" />{label} ({length})</button>)}
          </div>
        </div>
        {error && <div className="rounded-xl border border-error/30 bg-error/10 p-4 mb-5 text-sm" role="alert"><p>{error}</p><button type="button" className="btn btn-outline btn-sm mt-3" disabled={refreshing} onClick={() => load({ force: true })}>Thử tải lại bảng tin</button></div>}
        {loading ? <div className="flex items-center justify-center gap-3 py-20 text-base-content/70 text-sm" role="status"><LoaderCircle size={20} className="animate-spin" aria-hidden="true" />Đang tải bảng tin…</div> : filteredNews.length ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5" aria-label="Danh sách bài viết" aria-busy={refreshing}>
            {filteredNews.map((article) => {
              const notice = isNotice(article);
              const published = formatDate(article.published_at || article.start_at);
              return <article key={`${article.source || "article"}:${article.id || article.slug}`} className="group bg-base-100 rounded-2xl overflow-hidden border border-base-300 flex flex-col min-w-0">
                {!notice && <div className="relative h-60 bg-base-200 overflow-hidden">{article.thumbnail ? <img src={article.thumbnail} alt={article.title} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center"><Sparkles className="w-10 h-10 text-primary/50" /></div>}</div>}
                <div className="p-5 flex flex-col flex-1">
                  {notice && <div className="flex items-center justify-between gap-3 mb-4"><span className="inline-flex items-center gap-2 text-xs text-primary"><Megaphone size={17} aria-hidden="true" />Admin MTIEN</span>{article.pinned === true && <span className="inline-flex items-center gap-1 text-xs text-primary"><Pin size={13} aria-hidden="true" />Đã ghim</span>}</div>}
                  {published && <div className="flex items-center gap-1.5 text-xs text-base-content/55 mb-2"><Calendar size={13} aria-hidden="true" /><time>{published}</time></div>}
                  <h2 className="text-lg font-semibold text-base-content mb-3 break-words">{article.title}</h2>
                  {Array.isArray(article.tags) && article.tags.length > 0 && <div className="flex flex-wrap gap-1.5 mb-3">{article.tags.slice(0, 3).map((tag) => <span key={tag} className="bg-base-200 text-base-content/70 text-xs px-2 py-1 rounded-lg">#{tag}</span>)}</div>}
                  <p className="text-sm text-base-content/70 whitespace-pre-wrap break-words [overflow-wrap:anywhere] line-clamp-4 mb-5 flex-1">{article.description || article.message}</p>
                  <div className="flex items-center justify-between gap-3 pt-4 border-t border-base-300">
                    {!notice ? <div className="flex items-center gap-3 text-xs text-base-content/55"><span className="flex items-center gap-1"><Eye size={13} />{article.interactions?.views ?? 0}</span><span className="flex items-center gap-1"><Heart size={13} />{article.interactions?.likes ?? 0}</span><span className="flex items-center gap-1"><RiShareForwardLine size={14} />{article.interactions?.shares ?? 0}</span></div> : <span className="text-xs text-base-content/55">Thông báo</span>}
                    <Link to={`/newsfeed/${encodeURIComponent(article.slug)}`} state={{ fromList: true }} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary whitespace-nowrap">{notice ? "Đọc thông báo" : "Đọc thêm"}<ExternalLink size={13} aria-hidden="true" /></Link>
                  </div>
                </div>
              </article>;
            })}
          </div>
        ) : !error && <div className="text-center py-16 bg-base-100 rounded-2xl border border-base-300"><Megaphone size={28} className="mx-auto text-primary mb-4" aria-hidden="true" /><p className="text-base-content/75 text-sm">{selectedCategory === "announcement" ? "Chưa có thông báo nào." : selectedCategory === "all" ? "Chưa có bài viết nào trong bảng tin." : "Chưa có bài viết trong danh mục này."}</p></div>}
      </div>
    </div>
  );
}
