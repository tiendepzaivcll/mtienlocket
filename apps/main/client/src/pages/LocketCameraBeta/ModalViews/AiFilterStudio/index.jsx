import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, RefreshCw, Sparkles, X } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { fetchAiFilters } from "@/services";
import { SonnerError } from "@/components/ui/SonnerToast";

const errorMessage = (error) =>
  error?.response?.data?.message ||
  error?.response?.data?.error?.message ||
  error?.message ||
  "Không thể tạo ảnh AI.";

export default function AiFilterStudio() {
  const { navigation, post } = useApp();
  const { isAiFilterOpen, setIsAiFilterOpen } = navigation;
  const { selectedAiFilter, setSelectedAiFilter } = post;
  const [groups, setGroups] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [catalogAttempt, setCatalogAttempt] = useState(0);

  useEffect(() => {
    if (!isAiFilterOpen || catalogLoaded) return;
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
    return () => {
      active = false;
    };
  }, [catalogAttempt, catalogLoaded, isAiFilterOpen]);

  useEffect(() => {
    if (!isAiFilterOpen) return undefined;
    document.body.classList.add("overflow-hidden");
    return () => document.body.classList.remove("overflow-hidden");
  }, [isAiFilterOpen]);

  const close = useCallback(() => {
    setIsAiFilterOpen(false);
  }, [setIsAiFilterOpen]);

  const selectFilter = useCallback(
    (filter) => {
      setSelectedAiFilter(filter);
      setIsAiFilterOpen(false);
    },
    [setIsAiFilterOpen, setSelectedAiFilter],
  );

  return (
    <div
      className={`fixed inset-0 z-[110] flex items-end justify-center bg-black/30 backdrop-blur-[2px] transition-opacity duration-300 ${
        isAiFilterOpen
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0"
      }`}
      aria-hidden={!isAiFilterOpen}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Filter Studio"
        data-testid="ai-filter-studio"
        className={`relative flex h-[66dvh] max-h-[66dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-base-100 shadow-2xl transition-transform duration-300 ease-out ${
          isAiFilterOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <header className="flex h-16 shrink-0 items-center gap-2 px-4">
          <Sparkles className="h-6 w-6 text-amber-400" strokeWidth={2.5} />
          <h2 className="text-xl font-black uppercase tracking-tight text-amber-400">
            Filter Studio
          </h2>
          <span className="ml-2 rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold text-black shadow-md">
            Premium
          </span>
          <span className="flex-1" />
          <button
            type="button"
            aria-label="Đóng Filter Studio"
            onClick={close}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-base-200/80 text-amber-400 shadow-sm transition hover:bg-base-200 active:scale-95"
          >
            <X className="h-6 w-6" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-1">
          {loadingCatalog && (
            <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-base-content/60">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              Đang tải filter…
            </div>
          )}

          {!loadingCatalog && catalogError && (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center text-sm text-base-content/60">
              <p>Không tải được danh sách filter.</p>
              <button
                type="button"
                onClick={() => setCatalogAttempt((value) => value + 1)}
                className="inline-flex items-center gap-2 rounded-full bg-base-200 px-4 py-2 font-semibold text-base-content transition active:scale-95"
              >
                <RefreshCw className="h-4 w-4" />
                Thử lại
              </button>
            </div>
          )}

          {!loadingCatalog && !catalogError &&
            groups.map((group) => (
              <div key={group.id} className="pb-5 pt-2">
                <h3 className="mb-4 text-lg font-bold text-base-content">
                  {group.title}
                </h3>
                <div className="grid grid-cols-4 gap-x-4 gap-y-5">
                  {(group.filters || []).map((filter) => {
                    const selected =
                      selectedAiFilter?.filter_id === filter.filter_id;
                    return (
                      <button
                        type="button"
                        key={filter.filter_id}
                        onClick={() => selectFilter(filter)}
                        className="group flex min-w-0 flex-col items-center text-center active:scale-95"
                        aria-pressed={selected}
                        title={filter.filter_label}
                      >
                        <span
                          className={`relative aspect-square w-full max-w-[64px] overflow-hidden rounded-[17px] bg-base-200 shadow-sm ring-offset-2 ring-offset-base-100 transition ${
                            selected
                              ? "ring-3 ring-amber-400"
                              : "ring-0 group-hover:ring-2 group-hover:ring-base-300"
                          }`}
                        >
                          <img
                            src={filter.icon_url}
                            alt={filter.filter_label}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                          {selected && (
                            <span className="absolute inset-0 grid place-items-center bg-amber-400/15">
                              <Sparkles className="h-5 w-5 text-white drop-shadow" />
                            </span>
                          )}
                        </span>
                        <span className="mt-2 w-full truncate text-[11px] leading-4 text-base-content/80">
                          {filter.filter_label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
