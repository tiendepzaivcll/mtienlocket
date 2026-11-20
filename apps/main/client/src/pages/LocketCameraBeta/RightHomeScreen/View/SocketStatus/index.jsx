import React, { useState } from "react";
import { Activity, X } from "lucide-react";
import { instanceAuth } from "@/libs/instanceAuth";

const SocketStatus = ({ isConnected, connectionInfo, reconnect }) => {
  const statusClass = isConnected ? "status-success" : "status-error";
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);

  const openHealth = async () => {
    setOpen(true);
    setLoading(true);
    try {
      const response = await instanceAuth.get("/health", { timeout: 10_000 });
      setHealth(response.data);
    } catch {
      setHealth({ status: "unreachable" });
    } finally {
      setLoading(false);
    }
  };

  const telemetry = health?.telemetry || {};
  const deployment = health?.checks?.deployment || {};

  return (
    <>
      <button type="button" onClick={openHealth} className="flex items-center gap-2 cursor-pointer hover:opacity-85 transition">
        <div className="inline-grid *:[grid-area:1/1]">
          <div className={`status ${statusClass} animate-ping`}></div>
          <div className={`status ${statusClass}`}></div>
        </div>
        <span className={isConnected ? "text-emerald-500 font-medium text-sm" : "text-error font-medium text-sm"}>
          {isConnected ? "Connected to MTIEN Service" : "Disconnected"}
        </span>
        <Activity className="h-4 w-4 opacity-70 text-[var(--text-secondary)]" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div
            style={{ background: "var(--surface-dock)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
            className="w-full max-w-sm rounded-3xl border border-[var(--border-subtle)] text-[var(--text-primary)] p-5 text-left shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Tình trạng hệ thống</h2>
              <button type="button" className="btn btn-circle btn-sm bg-[var(--surface-pill)] border border-[var(--border-subtle)] text-[var(--text-primary)]" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            {loading ? (
              <p className="py-8 text-center text-sm opacity-60">Đang kiểm tra…</p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-3">API<br /><b>{health?.status || "unknown"}</b></div>
                <div className="rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-3">Socket<br /><b>{isConnected ? "connected" : "disconnected"}</b></div>
                <div className="rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-3">R2<br /><b>{health?.checks?.storage?.mode || "unknown"}</b></div>
                <div className="rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-3">App Check<br /><b>{health?.checks?.appCheck?.mode || "unknown"}</b></div>
                <div className="rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-3">Requests<br /><b>{telemetry.requests ?? 0}</b></div>
                <div className="rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-3">Lỗi 5xx<br /><b>{telemetry.errors5xx ?? 0}</b></div>
                <div className="rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-3">Độ trễ TB<br /><b>{telemetry.averageDurationMs ?? 0} ms</b></div>
                <div className="rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-3">Deploy<br /><b>{deployment.ready ? "ready" : "thiếu cấu hình"}</b></div>
              </div>
            )}
            {!isConnected && (
              <div className="mt-3 rounded-xl bg-error/10 p-3 text-xs">
                <p>
                  Trạng thái: <b>{connectionInfo?.phase || "disconnected"}</b>
                  {connectionInfo?.attempt
                    ? ` · lần ${connectionInfo.attempt}`
                    : ""}
                </p>
                {connectionInfo?.reason && (
                  <p className="mt-1 break-words opacity-70">
                    Lý do: {connectionInfo.reason}
                  </p>
                )}
                <button
                  type="button"
                  className="btn btn-sm mt-3 w-full"
                  onClick={reconnect}
                >
                  Kết nối lại
                </button>
              </div>
            )}
            {!loading && deployment.missingKeys?.length > 0 && (
              <p className="mt-3 rounded-xl bg-warning/15 p-3 text-xs text-warning-content">
                Thiếu: {deployment.missingKeys.join(", ")}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default SocketStatus;
