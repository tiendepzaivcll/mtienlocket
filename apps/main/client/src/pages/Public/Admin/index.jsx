import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Crown,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import {
  addApprovedUser,
  adminLogin,
  adminLogout,
  deleteApprovedUser,
  getAdminToken,
  listApprovedUsers,
  updateApprovedUser,
} from "@/services/AdminServices";
import {
  SonnerError,
  SonnerSuccess,
  SonnerWarning,
} from "@/components/ui/SonnerToast";
import { useAuthStore } from "@/stores";
import AppCheckSettings from "./AppCheckSettings";
import AiFilterSettings from "./AiFilterSettings";
import CaptionSettings from "./CaptionSettings";

const normalizeUsername = (value = "") =>
  value.trim().replace(/^@+/, "").toLowerCase();

export default function AdminPanel() {
  const currentUser = useAuthStore((state) => state.user);
  const setAccessRole = useAuthStore((state) => state.setAccessRole);
  const setAiFilterEnabled = useAuthStore((state) => state.setAiFilterEnabled);
  const [isAuthed, setIsAuthed] = useState(() => Boolean(getAdminToken()));
  const [password, setPassword] = useState("");
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState("");
  const [note, setNote] = useState("");
  const [role, setRole] = useState("vip");
  const [newUserAiFilterEnabled, setNewUserAiFilterEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const activeCount = useMemo(
    () => users.filter((user) => user.active !== false).length,
    [users],
  );
  const vipCount = useMemo(
    () => users.filter((user) => user.active !== false && user.role !== "celebrity").length,
    [users],
  );
  const celebrityCount = useMemo(
    () => users.filter((user) => user.active !== false && user.role === "celebrity").length,
    [users],
  );
  const aiFilterCount = useMemo(
    () => users.filter((user) => user.active !== false && user.aiFilterEnabled === true).length,
    [users],
  );

  const fetchUsers = async () => {
    if (!getAdminToken()) return;

    try {
      setLoading(true);
      setUsers(await listApprovedUsers());
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        adminLogout();
        setIsAuthed(false);
        SonnerWarning("Phiên admin đã hết hạn.");
      } else {
        SonnerError("Không tải được danh sách username.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthed) {
      fetchUsers();
    }
  }, [isAuthed]);

  const handleLogin = async (event) => {
    event.preventDefault();
    if (!password.trim()) {
      SonnerWarning("Nhập mật khẩu admin.");
      return;
    }

    try {
      setLoading(true);
      await adminLogin(password);
      setPassword("");
      setIsAuthed(true);
      SonnerSuccess("Đăng nhập admin thành công.");
    } catch (error) {
      SonnerError(error.response?.data?.message || "Sai mật khẩu admin.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    adminLogout();
    setIsAuthed(false);
    setUsers([]);
  };

  const handleAdd = async (event) => {
    event.preventDefault();
    const cleanUsername = normalizeUsername(username);

    if (!cleanUsername) {
      SonnerWarning("Nhập username cần phê duyệt.");
      return;
    }

    try {
      setSaving(true);
      const addedUser = await addApprovedUser({
        username: cleanUsername,
        note,
        role,
        aiFilterEnabled: newUserAiFilterEnabled,
      });
      setUsers((current) => [
        ...current.filter((item) => item.username !== cleanUsername),
        addedUser,
      ].sort((a, b) => a.username.localeCompare(b.username)));
      setUsername("");
      setNote("");
      setRole("vip");
      setNewUserAiFilterEnabled(false);
      SonnerSuccess(`Đã phê duyệt @${cleanUsername}.`);
    } catch (error) {
      SonnerError(error.response?.data?.message || "Không thêm được username.");
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (user, nextRole) => {
    try {
      await updateApprovedUser(user.username, { role: nextRole });
      setUsers((current) =>
        current.map((item) =>
          item.username === user.username ? { ...item, role: nextRole } : item,
        ),
      );
      if (
        normalizeUsername(currentUser?.username) === normalizeUsername(user.username)
      ) {
        setAccessRole(nextRole);
      }
      SonnerSuccess(`Đã đổi @${user.username} sang ${nextRole === "vip" ? "VIP" : "Celebrity"}.`);
    } catch {
      SonnerError("Không cập nhật được loại quyền.");
    }
  };

  const handleToggle = async (user) => {
    try {
      const active = user.active === false;
      await updateApprovedUser(user.username, { active });
      setUsers((current) => current.map((item) =>
        item.username === user.username ? { ...item, active } : item
      ));
    } catch {
      SonnerError("Không cập nhật được trạng thái.");
    }
  };

  const handleAiFilterToggle = async (user) => {
    try {
      const aiFilterEnabled = user.aiFilterEnabled !== true;
      await updateApprovedUser(user.username, { aiFilterEnabled });
      setUsers((current) =>
        current.map((item) =>
          item.username === user.username
            ? { ...item, aiFilterEnabled }
            : item,
        ),
      );
      if (
        normalizeUsername(currentUser?.username) === normalizeUsername(user.username)
      ) {
        setAiFilterEnabled(aiFilterEnabled);
      }
      SonnerSuccess(
        aiFilterEnabled ? "Đã bật AI Filter" : "Đã tắt AI Filter",
        `@${user.username}`,
      );
    } catch {
      SonnerError("Không cập nhật được quyền AI Filter.");
    }
  };

  const handleDelete = async (user) => {
    try {
      await deleteApprovedUser(user.username);
      setUsers((current) => current.filter((item) => item.username !== user.username));
      SonnerSuccess(`Đã xoá @${user.username}.`);
    } catch {
      SonnerError("Không xoá được username.");
    }
  };

  if (!isAuthed) {
    return (
      <main className="min-h-[84vh] bg-base-100 px-4 py-10 text-base-content">
        <section className="mx-auto max-w-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-content">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Admin MTIEN</h1>
              <p className="text-sm opacity-70">Quản lý username được phép dùng web.</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <label className="form-control">
              <span className="label-text">Mật khẩu admin</span>
              <input
                className="input input-bordered mt-1 w-full"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Nhập ADMIN_PASSWORD"
              />
            </label>
            <button className="btn btn-primary w-full" disabled={loading}>
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-[84vh] bg-base-100 px-4 py-6 text-base-content">
      <section className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Admin MTIEN</h1>
            <p className="text-sm opacity-70">
              {activeCount} username đang được phép sử dụng web.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="inline-flex items-center gap-1 rounded-md bg-warning/15 px-2 py-1 text-warning">
                <Crown size={13} /> {vipCount} VIP
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-info/15 px-2 py-1 text-info">
                <Star size={13} /> {celebrityCount} Celebrity
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-secondary/15 px-2 py-1 text-secondary">
                <Sparkles size={13} /> {aiFilterCount} AI Filter
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={fetchUsers} disabled={loading}>
              <RefreshCw size={16} />
              Tải lại
            </button>
            <button className="btn btn-outline btn-sm" onClick={handleLogout}>
              <LogOut size={16} />
              Thoát
            </button>
          </div>
        </div>

        <AppCheckSettings />
        <AiFilterSettings />
        <CaptionSettings />
        <form
          onSubmit={handleAdd}
          className="grid gap-3 rounded-lg border border-base-300 bg-base-200/50 p-4 md:grid-cols-2 lg:grid-cols-[1fr_1fr_220px_150px_auto]"
        >
          <label className="form-control">
            <span className="label-text">Username Locket</span>
            <input
              className="input input-bordered mt-1 w-full"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="vd: t97"
            />
          </label>
          <label className="form-control">
            <span className="label-text">Ghi chú</span>
            <input
              className="input input-bordered mt-1 w-full"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Tuỳ chọn"
            />
          </label>
          <fieldset>
            <legend className="label-text">Loại quyền</legend>
            <div className="mt-1 grid h-12 grid-cols-2 rounded-lg border border-base-300 bg-base-100 p-1">
              <button
                type="button"
                onClick={() => setRole("vip")}
                className={`flex items-center justify-center gap-1 rounded-md text-sm font-semibold ${
                  role === "vip" ? "bg-warning text-warning-content" : "hover:bg-base-200"
                }`}
              >
                <Crown size={15} /> VIP
              </button>
              <button
                type="button"
                onClick={() => setRole("celebrity")}
                className={`flex items-center justify-center gap-1 rounded-md text-sm font-semibold ${
                  role === "celebrity" ? "bg-info text-info-content" : "hover:bg-base-200"
                }`}
              >
                <Star size={15} /> Celebrity
              </button>
            </div>
          </fieldset>
          <label className="flex h-12 items-center justify-between gap-3 self-end rounded-lg border border-base-300 bg-base-100 px-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <Sparkles size={16} /> AI Filter
            </span>
            <input
              type="checkbox"
              className="toggle toggle-secondary toggle-sm"
              checked={newUserAiFilterEnabled}
              onChange={(event) => setNewUserAiFilterEnabled(event.target.checked)}
              aria-label="Cấp quyền AI Filter cho tài khoản mới"
            />
          </label>
          <button className="btn btn-primary self-end" disabled={saving}>
            <Plus size={16} />
            Thêm
          </button>
        </form>

        <div className="overflow-hidden rounded-lg border border-base-300">
          <div className="grid grid-cols-[1fr_90px_96px] gap-2 bg-base-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide opacity-80 md:grid-cols-[1fr_1fr_130px_100px_90px_120px]">
            <span>Username</span>
            <span className="hidden md:block">Ghi chú</span>
            <span className="hidden md:block">Loại quyền</span>
            <span className="hidden md:block">AI Filter</span>
            <span>Trạng thái</span>
            <span className="text-right">Thao tác</span>
          </div>

          {loading ? (
            <div className="px-4 py-8 text-center opacity-70">Đang tải...</div>
          ) : users.length === 0 ? (
            <div className="px-4 py-8 text-center opacity-70">
              Chưa có username nào được phê duyệt.
            </div>
          ) : (
            users.map((user) => (
              <div
                key={user.id || user.username}
                className="grid grid-cols-[1fr_90px_96px] items-center gap-2 border-t border-base-300 px-4 py-3 md:grid-cols-[1fr_1fr_130px_100px_90px_120px]"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold">@{user.username}</div>
                  <select
                    className="select select-bordered select-xs mt-1 w-full md:hidden"
                    value={user.role === "celebrity" ? "celebrity" : "vip"}
                    onChange={(event) => handleRoleChange(user, event.target.value)}
                    aria-label={`Loại quyền của @${user.username}`}
                  >
                    <option value="vip">VIP</option>
                    <option value="celebrity">Celebrity</option>
                  </select>
                  <label className="mt-2 flex items-center justify-between gap-2 text-xs md:hidden">
                    <span className="inline-flex items-center gap-1">
                      <Sparkles size={12} /> AI Filter
                    </span>
                    <input
                      type="checkbox"
                      className="toggle toggle-secondary toggle-xs"
                      checked={user.aiFilterEnabled === true}
                      onChange={() => handleAiFilterToggle(user)}
                      aria-label={`Quyền AI Filter của @${user.username}`}
                    />
                  </label>
                </div>
                <div className="hidden truncate text-sm opacity-70 md:block">
                  {user.note || "-"}
                </div>
                <select
                  className="select select-bordered select-sm hidden w-full md:block"
                  value={user.role === "celebrity" ? "celebrity" : "vip"}
                  onChange={(event) => handleRoleChange(user, event.target.value)}
                  aria-label={`Loại quyền của @${user.username}`}
                >
                  <option value="vip">VIP</option>
                  <option value="celebrity">Celebrity</option>
                </select>
                <label className="hidden items-center gap-2 md:flex">
                  <input
                    type="checkbox"
                    className="toggle toggle-secondary toggle-sm"
                    checked={user.aiFilterEnabled === true}
                    onChange={() => handleAiFilterToggle(user)}
                    aria-label={`Quyền AI Filter của @${user.username}`}
                  />
                  <span className="text-xs font-medium">
                    {user.aiFilterEnabled === true ? "Bật" : "Tắt"}
                  </span>
                </label>
                <span
                  className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-1 text-xs ${
                    user.active === false
                      ? "bg-error/15 text-error"
                      : "bg-success/15 text-success"
                  }`}
                >
                  {user.active === false ? <X size={12} /> : <Check size={12} />}
                  {user.active === false ? "Tắt" : "Bật"}
                </span>
                <div className="flex justify-end gap-1">
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => handleToggle(user)}
                    title={user.active === false ? "Bật lại" : "Tắt quyền"}
                  >
                    {user.active === false ? <Check size={15} /> : <X size={15} />}
                  </button>
                  <button
                    className="btn btn-ghost btn-xs text-error"
                    onClick={() => handleDelete(user)}
                    title="Xoá"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
