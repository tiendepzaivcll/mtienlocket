// ================= Skeleton for conversation =================
export const ConversationSkeleton = () => {
  return (
    <div className="relative w-full flex items-center gap-3.5 p-3.5 rounded-3xl shadow-sm border border-[var(--border-subtle)] bg-[var(--surface-card)]">
      {/* Avatar */}
      <div className="w-14 h-14 rounded-full bg-[var(--border-subtle)] animate-pulse shrink-0" />

      {/* Nội dung */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-4 w-1/2 bg-[var(--border-subtle)] rounded animate-pulse" />
        <div className="h-3 w-3/4 bg-[var(--border-subtle)] opacity-70 rounded animate-pulse" />
      </div>
    </div>
  );
};
