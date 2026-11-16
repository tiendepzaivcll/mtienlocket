import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Edit2, Pin, PinOff, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import {
  createAdminNotification,
  deleteAdminNotification,
  listAdminNotifications,
  updateAdminNotification,
} from "@/services/AdminServices";

const timestamp = (value) => {
  if (value && typeof value === "object") {
    const seconds = value.seconds ?? value._seconds;
    return Number.isFinite(seconds) ? seconds * 1000 : 0;
  }
  const parsed = typeof value === "number" ? value : Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function NotificationSettings({ onAuthExpired }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [authExpired, setAuthExpired] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const mountedRef = useRef(false);
  const loadVersionRef = useRef(0);
  const loadingRef = useRef(true);
  const writeLockRef = useRef(false);
  const authExpiredHandlerRef = useRef(onAuthExpired);
  authExpiredHandlerRef.current = onAuthExpired;
  const disabled = saving || loading || authExpired;

  const orderedItems = useMemo(() => [...items].sort((a, b) =>
    Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
    timestamp(b.created_at) - timestamp(a.created_at)
  ), [items]);

  const handleError = useCallback((cause, fallback) => {
    if (!mountedRef.current) return;
    if ([401, 403].includes(cause.response?.status)) {
      setAuthExpired(true);
      setError("Phiên admin đã hết hạn hoặc không còn quyền truy cập. Vui lòng đăng nhập admin lại.");
      authExpiredHandlerRef.current?.();
      return;
    }
    setError(cause.response?.data?.message || cause.message || fallback);
  }, []);

  const load = useCallback(async () => {
    if (writeLockRef.current) return;
    const version = ++loadVersionRef.current;
    loadingRef.current = true;
    setLoading(true);
    setError("");
    try {
      const data = await listAdminNotifications();
      if (mountedRef.current && version === loadVersionRef.current) setItems(data);
    } catch (cause) {
      if (version === loadVersionRef.current) handleError(cause, "Không tải được thông báo. Hãy thử lại.");
    } finally {
      if (mountedRef.current && version === loadVersionRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [handleError]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
      loadVersionRef.current += 1;
    };
  }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setPinned(false);
  };

  const write = async (action, updateItems, successMessage) => {
    if (writeLockRef.current || loadingRef.current || authExpired) return false;
    writeLockRef.current = true;
    loadVersionRef.current += 1;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const data = await action();
      window.dispatchEvent(new CustomEvent("mtien-notifications-updated"));
      if (mountedRef.current) {
        setItems((current) => updateItems(current, data));
        setMessage(successMessage);
      }
      return true;
    } catch (cause) {
      handleError(cause, "Không lưu được thông báo. Nội dung đang nhập vẫn được giữ lại.");
      return false;
    } finally {
      writeLockRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    if (disabled || writeLockRef.current) return;
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (!cleanTitle || !cleanBody) {
      setError("Vui lòng nhập tiêu đề và nội dung thông báo.");
      return;
    }
    if (cleanTitle.length > 160 || cleanBody.length > 5000) {
      setError("Tiêu đề tối đa 160 ký tự, nội dung tối đa 5.000 ký tự.");
      return;
    }
    const data = { title: cleanTitle, message: cleanBody, pinned };
    const saved = await write(
      () => editingId ? updateAdminNotification(editingId, data) : createAdminNotification(data),
      (current, item) => [item, ...current.filter((entry) => entry.id !== item.id)],
      editingId ? "Đã cập nhật thông báo trong chuông." : "Đã đăng thông báo. Người dùng có thể xem tại biểu tượng chuông trên web.",
    );
    if (saved && mountedRef.current) resetForm();
  };

  const edit = (item) => {
    if (disabled || writeLockRef.current) return;
    setEditingId(item.id);
    setTitle(item.title || "");
    setBody(item.message || "");
    setPinned(Boolean(item.pinned));
    setDeleteCandidate(null);
    setError("");
    setMessage("");
  };

  const togglePin = async (item) => {
    const nextPinned = !item.pinned;
    const saved = await write(
      () => updateAdminNotification(item.id, { pinned: nextPinned }),
      (current, updated) => current.map((entry) => entry.id === item.id ? updated : entry),
      nextPinned ? "Đã ghim thông báo lên đầu chuông." : "Đã bỏ ghim thông báo.",
    );
    if (saved && mountedRef.current && editingId === item.id) setPinned(nextPinned);
  };

  const remove = async (item) => {
    const saved = await write(
      () => deleteAdminNotification(item.id),
      (current) => current.filter((entry) => entry.id !== item.id),
      "Đã xóa thông báo khỏi chuông.",
    );
    if (saved && mountedRef.current) {
      setDeleteCandidate(null);
      if (editingId === item.id) resetForm();
    }
  };

  return (
    <section className="rounded-lg border border-base-300 bg-base-200/50 p-4 space-y-4 scroll-mt-24" aria-labelledby="notifications">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2" id="notifications"><Bell size={19} aria-hidden="true" />Quản lý thông báo</h2>
          <p className="mt-1 text-sm opacity-70">Thông báo của admin MTIEN hiển thị tại biểu tượng chuông trên website.</p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" disabled={disabled} onClick={load}><RefreshCw size={15} aria-hidden="true" />{loading ? "Đang tải…" : "Tải lại thông báo"}</button>
      </div>

      <form className="rounded-lg border border-base-300 bg-base-100 p-4 space-y-3" onSubmit={save} aria-label={editingId ? "Sửa thông báo" : "Đăng thông báo mới"}>
        <h3 className="font-semibold text-sm">{editingId ? "Sửa thông báo" : "Đăng thông báo mới"}</h3>
        <label className="block text-sm" htmlFor="admin-notification-title">Tiêu đề
          <input id="admin-notification-title" className="input input-bordered w-full mt-1" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={160} disabled={saving || authExpired} placeholder="Ví dụ: Cập nhật tính năng mới" />
        </label>
        <label className="block text-sm" htmlFor="admin-notification-message">Nội dung
          <textarea id="admin-notification-message" className="textarea textarea-bordered w-full mt-1 min-h-32" value={body} onChange={(event) => setBody(event.target.value)} required maxLength={5000} disabled={saving || authExpired} placeholder="Nhập nội dung muốn gửi đến người dùng…" />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-base-content/70">
          <label className="inline-flex items-center gap-2 cursor-pointer"><input type="checkbox" className="checkbox checkbox-sm checkbox-primary" checked={pinned} onChange={(event) => setPinned(event.target.checked)} disabled={saving || authExpired} />Ghim lên đầu chuông</label>
          <span className="tabular-nums">{title.length}/160 · {body.length}/5.000 ký tự</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary btn-sm" disabled={disabled || !title.trim() || !body.trim()}>{editingId ? <Save size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}{saving ? "Đang lưu…" : editingId ? "Lưu thay đổi" : "Đăng thông báo"}</button>
          {editingId && <button type="button" className="btn btn-ghost btn-sm" disabled={saving} onClick={() => { resetForm(); setError(""); }}><X size={15} aria-hidden="true" />Hủy sửa</button>}
        </div>
      </form>

      {message && <p role="status" className="text-sm text-success">{message}</p>}
      {error && <div role="alert" className="rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error"><p>{error}</p>{!authExpired && <button type="button" className="underline mt-2" disabled={saving || loading} onClick={load}>Thử tải lại danh sách</button>}</div>}
      <div className="space-y-3" aria-busy={loading} aria-label="Danh sách thông báo đã đăng">
        {loading && <p className="text-sm opacity-70" role="status">Đang tải danh sách thông báo…</p>}
        {!loading && !items.length && !error && <p className="text-sm opacity-70">Chưa có thông báo nào. Bạn có thể đăng thông báo đầu tiên ở trên.</p>}
        {orderedItems.map((item) => {
          const created = timestamp(item.created_at);
          return <article key={item.id} className="rounded-lg border border-base-300 bg-base-100 p-4 space-y-3" aria-labelledby={`admin-notification-${item.id}`}>
            <div className="flex flex-wrap justify-between items-start gap-3">
              <div className="min-w-0 flex-1">
                <h3 id={`admin-notification-${item.id}`} className="font-semibold break-words">{item.title}</h3>
                <p className="mt-1 text-xs opacity-65">Admin {item.author || "MTIEN"}{created ? ` · ${new Date(created).toLocaleString("vi-VN")}` : ""}</p>
              </div>
              {item.pinned && <span className="inline-flex items-center gap-1 text-xs text-primary"><Pin size={12} aria-hidden="true" />Đã ghim</span>}
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{item.message}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-outline btn-xs" disabled={disabled} onClick={() => edit(item)} aria-label={`Sửa thông báo ${item.title}`}><Edit2 size={13} aria-hidden="true" />Sửa</button>
              <button type="button" className="btn btn-outline btn-xs" disabled={disabled} onClick={() => togglePin(item)} aria-label={`${item.pinned ? "Bỏ ghim" : "Ghim"} thông báo ${item.title}`} aria-pressed={Boolean(item.pinned)}>{item.pinned ? <PinOff size={13} aria-hidden="true" /> : <Pin size={13} aria-hidden="true" />}{item.pinned ? "Bỏ ghim" : "Ghim"}</button>
              <button type="button" className="btn btn-outline btn-xs text-error" disabled={disabled} onClick={() => setDeleteCandidate(item.id)} aria-label={`Xóa thông báo ${item.title}`}><Trash2 size={13} aria-hidden="true" />Xóa</button>
            </div>
            {deleteCandidate === item.id && <div className="rounded-lg border border-error/30 bg-error/10 p-3 text-sm space-y-3" role="group" aria-label="Xác nhận xóa thông báo"><p>Xóa thông báo này khỏi chuông của người dùng?</p><div className="flex flex-wrap gap-2"><button type="button" className="btn btn-error btn-sm" disabled={disabled} onClick={() => remove(item)}>Xóa thông báo</button><button type="button" className="btn btn-ghost btn-sm" disabled={saving} onClick={() => setDeleteCandidate(null)}>Giữ lại</button></div></div>}
          </article>;
        })}
      </div>
    </section>
  );
}
