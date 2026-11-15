import { useEffect, useState } from "react";
import { getAppCheckSettings, saveAppCheckSettings, checkAppCheckSettings } from "@/services/AdminServices";

export default function AppCheckSettings() {
  const [status, setStatus] = useState(null);
  const [mode, setMode] = useState("device-check");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    getAppCheckSettings().then((data) => {
      if (!active) return;
      setStatus(data);
      if (["static", "device-check"].includes(data.mode)) setMode(data.mode);
    }).catch(() => { if (active) setError("Không tải được trạng thái App Check."); });
    return () => { active = false; };
  }, []);
  const run = async (action) => {
    setBusy(true); setError(""); setMessage("");
    try { await action(); }
    catch (err) { setError(err.response?.data?.message || "Không kết nối được máy chủ."); }
    finally { setBusy(false); }
  };
  const save = (event) => {
    event.preventDefault();
    if (busy) return;
    run(async () => {
      setStatus(await saveAppCheckSettings({ mode, token }));
      setToken("");
      setMessage("Đã lưu và áp dụng ngay. Các máy chủ khác cập nhật trong tối đa 30 giây.");
    });
  };
  return (
    <section className="rounded-lg border border-base-300 bg-base-200/50 p-4 space-y-3">
      <h2 className="text-lg font-semibold">Firebase App Check</h2>
      <p className="text-sm opacity-70">Nhập token ở đây để thay cấu hình env. Token được lưu mã hóa phía server; giá trị đã lưu không được gửi lại trình duyệt.</p>
      {status && <p className="text-sm">
        Nguồn: {status.source === "admin" ? "Admin" : "env (cấu hình cũ)"} · {status.configured ? "Đã cấu hình" : "Chưa có token sử dụng được"}
        {status.expiresAt && <> · Hết hạn: {new Date(status.expiresAt).toLocaleString("vi-VN")}</>}
        {!status.storageAvailable && <span className="text-error"> · Không đọc được cấu hình lưu trên server</span>}
      </p>}
      <form onSubmit={save} className="space-y-3">
        <label className="block text-sm">Loại token
          <select className="select select-bordered mt-1 w-full" value={mode} disabled={busy} onChange={(e) => { setMode(e.target.value); setToken(""); }}>
            <option value="device-check">DeviceCheck — đổi lấy App Check khi cần</option>
            <option value="static">App Check JWT — nhập lại khi hết hạn</option>
          </select>
        </label>
        <label className="block text-sm">{mode === "static" ? "App Check JWT mới" : "DeviceCheck token mới"}
          <input type="password" autoComplete="off" spellCheck={false} className="input input-bordered mt-1 w-full font-mono" value={token} onChange={(e) => setToken(e.target.value)} disabled={busy} required maxLength={16000} placeholder={mode === "static" ? "eyJ…" : "AgAAA… hoặc JSON chứa device_token"} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary btn-sm" disabled={busy || !token.trim()}>{busy ? "Đang xử lý…" : "Lưu và áp dụng"}</button>
          <button type="button" className="btn btn-outline btn-sm" disabled={busy || !status?.configured} onClick={() => run(async () => {
            const result = await checkAppCheckSettings(); setStatus(result.data); setMessage(result.message);
          })}>Kiểm tra token đã lưu</button>
        </div>
      </form>
      {message && <p role="status" className="text-sm text-success">{message}</p>}
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
    </section>
  );
}
