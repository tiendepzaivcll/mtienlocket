import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Crown,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Search,
  Trash2,
  X,
  AlertTriangle,
  Gift,
  ArrowUpDown,
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
import NotificationSettings from "./NotificationSettings";
import PaymentManagement from "./PaymentManagement";

const normalizeUsername = (value = "") =>
  value.trim().replace(/^@+/, "").toLowerCase();

const VIP_PLAN_OPTIONS = [
  { value: "", label: "— Free —" },
  { value: "vip_lifetime", label: "👑 VIP Vĩnh viễn" },
  { value: "vip_trial", label: "VIP Dùng thử (1 ngày)" },
  { value: "vip_1month", label: "VIP 1 Tháng (30 ngày)" },
  { value: "vip_6months", label: "VIP 6 Tháng (180 ngày)" },
  { value: "vip_1year", label: "VIP 1 Năm (365 ngày)" },
];

const formatDate = (val) => {
  if (!val) return "—";
  const d = typeof val === "number" ? new Date(val) : new Date(val);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const isExpired = (expireAt) => {
  if (!expireAt) return false;
  const ts = typeof expireAt === "number" ? expireAt : new Date(expireAt).getTime();
  return ts <= Date.now();
};

const remainingDays = (expireAt) => {
  if (!expireAt) return null;
  const ts = typeof expireAt === "number" ? expireAt : new Date(expireAt).getTime();
  return Math.max(0, Math.ceil((ts - Date.now()) / (24 * 60 * 60 * 1000)));
};

const VipPlanBadge = ({ user }) => {
  if (user.role !== "vip" || !user.vipPlanName) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-500/15 text-gray-400 border border-gray-500/30 px-2 py-0.5 text-xs font-semibold">
        Free
      </span>
    );
  }
  if (user.vipPlanId === "vip_lifetime" || !user.vipExpireAt) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 text-xs font-bold">
        <Crown size={12} /> VIP Vĩnh viễn
      </span>
    );
  }
  const expired = isExpired(user.vipExpireAt);
  if (expired) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-error/15 text-error border border-error/30 px-2 py-0.5 text-xs font-semibold">
        <AlertTriangle size={12} /> Hết hạn
      </span>
    );
  }
  if (user.vipPlanId === "vip_trial") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-xs font-semibold">
        <Gift size={12} /> Dùng thử 1N
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 text-warning border border-warning/30 px-2 py-0.5 text-xs font-semibold">
      <Crown size={12} /> {user.vipPlanName}
    </span>
  );
};

export default function AdminPanel() {
  const currentUser = useAuthStore((state) => state.user);
  const setAccessRole = useAuthStore((state) => state.setAccessRole);
  const [isAuthed, setIsAuthed] = useState(() => Boolean(getAdminToken()));
  const [password, setPassword] = useState("");
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState("");
  const [note, setNote] = useState("");
  const [role, setRole] = useState("vip");
  const [vipPlanId, setVipPlanId] = useState("vip_1month");
  const [aiCredits, setAiCredits] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Tìm kiếm, phân chia gói & sắp xếp
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState("all");
  const [sortOrder, setSortOrder] = useState("abc"); // "abc" | "zyx" | "newest"

  const activeCount = useMemo(
    () => users.filter((user) => user.active !== false).length,
    [users],
  );
  const vipCount = useMemo(
    () => users.filter((user) => user.active !== false && user.role === "vip" && (!user.vipExpireAt || !isExpired(user.vipExpireAt))).length,
    [users],
  );
  const lifetimeCount = useMemo(
    () => users.filter((user) => user.active !== false && user.role === "vip" && (user.vipPlanId === "vip_lifetime" || !user.vipExpireAt)).length,
    [users],
  );
  const trialCount = useMemo(
    () => users.filter((user) => user.hasUsedTrial || user.vipPlanId === "vip_trial" || user.vipPlanName?.includes("Dùng thử")).length,
    [users],
  );
  const aiUsersCount = useMemo(
    () => users.filter((user) => (user.aiCredits || 0) > 0).length,
    [users],
  );
  const expiredVipCount = useMemo(
    () => users.filter((user) => user.active === false || user.lastExpiredVipPlan || (user.vipExpireAt && isExpired(user.vipExpireAt))).length,
    [users],
  );

  const tabCounts = useMemo(() => ({
    all: users.length,
    vip_1month: users.filter((u) => u.role === "vip" && (u.vipPlanId === "vip_1month" || u.vipPlanDays === 30 || u.vipPlanName?.includes("1 Tháng"))).length,
    vip_6months: users.filter((u) => u.role === "vip" && (u.vipPlanId === "vip_6months" || u.vipPlanDays === 180 || u.vipPlanName?.includes("6 Tháng"))).length,
    vip_1year: users.filter((u) => u.role === "vip" && (u.vipPlanId === "vip_1year" || u.vipPlanDays === 365 || u.vipPlanName?.includes("1 Năm"))).length,
    vip_lifetime: users.filter((u) => u.role === "vip" && (u.vipPlanId === "vip_lifetime" || (!u.vipExpireAt && !u.vipPlanDays))).length,
    trial: users.filter((u) => u.hasUsedTrial || u.vipPlanId === "vip_trial" || u.vipPlanName?.includes("Dùng thử")).length,
    ai: users.filter((u) => (u.aiCredits || 0) > 0 || u.aiFilterEnabled).length,
    expired: users.filter((u) => u.active === false || (u.role === "vip" && u.vipExpireAt && isExpired(u.vipExpireAt)) || u.lastExpiredVipPlan).length,
  }), [users]);

  const filteredUsers = useMemo(() => {
    let list = [...users];

    // 1. Phân loại theo gói / tab
    if (filterTab === "vip_1month") {
      list = list.filter((u) => u.role === "vip" && (u.vipPlanId === "vip_1month" || u.vipPlanDays === 30 || u.vipPlanName?.includes("1 Tháng")));
    } else if (filterTab === "vip_6months") {
      list = list.filter((u) => u.role === "vip" && (u.vipPlanId === "vip_6months" || u.vipPlanDays === 180 || u.vipPlanName?.includes("6 Tháng")));
    } else if (filterTab === "vip_1year") {
      list = list.filter((u) => u.role === "vip" && (u.vipPlanId === "vip_1year" || u.vipPlanDays === 365 || u.vipPlanName?.includes("1 Năm")));
    } else if (filterTab === "vip_lifetime") {
      list = list.filter((u) => u.role === "vip" && (u.vipPlanId === "vip_lifetime" || (!u.vipExpireAt && !u.vipPlanDays)));
    } else if (filterTab === "trial") {
      list = list.filter((u) => u.hasUsedTrial || u.vipPlanId === "vip_trial" || u.vipPlanName?.includes("Dùng thử"));
    } else if (filterTab === "ai") {
      list = list.filter((u) => (u.aiCredits || 0) > 0 || u.aiFilterEnabled);
    } else if (filterTab === "expired") {
      list = list.filter((u) => u.active === false || (u.role === "vip" && u.vipExpireAt && isExpired(u.vipExpireAt)) || u.lastExpiredVipPlan);
    }

    // 2. Tìm kiếm theo username hoặc ghi chú
    const q = searchQuery.trim().toLowerCase().replace(/^@+/, "");
    if (q) {
      list = list.filter((u) => {
        const uname = String(u.username || "").toLowerCase();
        const unote = String(u.note || "").toLowerCase();
        return uname.includes(q) || unote.includes(q);
      });
    }

    // 3. Sắp xếp theo bảng chữ cái A-Z (mặc định), Z-A, hoặc Mới nhất
    list.sort((a, b) => {
      if (sortOrder === "zyx") {
        return (b.username || "").localeCompare(a.username || "", "vi", { sensitivity: "base" });
      }
      if (sortOrder === "newest") {
        const timeA = new Date(a.createdAt || a.updatedAt || 0).getTime();
        const timeB = new Date(b.createdAt || b.updatedAt || 0).getTime();
        return timeB - timeA;
      }
      // Mặc định: bảng chữ cái ABC
      return (a.username || "").localeCompare(b.username || "", "vi", { sensitivity: "base" });
    });

    return list;
  }, [users, filterTab, searchQuery, sortOrder]);

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
        vipPlanId: role === "vip" ? vipPlanId : undefined,
        planDays: undefined,
        aiFilterEnabled: Number(aiCredits) > 0,
        aiCredits: Number(aiCredits) || 0,
      });
      setUsers((current) => [
        ...current.filter((item) => item.username !== cleanUsername),
        addedUser,
      ].sort((a, b) => a.username.localeCompare(b.username)));
      setUsername("");
      setNote("");
      setRole("vip");
      setVipPlanId("vip_1month");
      setAiCredits(0);
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
      SonnerSuccess(`Đã đổi @${user.username} sang ${nextRole === "vip" ? "VIP" : "Free"}.`);
    } catch {
      SonnerError("Không cập nhật được loại quyền.");
    }
  };

  const handleVipPlanChange = async (user, planId) => {
    try {
      if (!planId) {
        await updateApprovedUser(user.username, { role: "free" });
        setUsers((current) =>
          current.map((item) =>
            item.username === user.username
              ? { ...item, role: "free", vipPlanId: null, vipPlanName: null, vipPlanDays: null, vipExpireAt: null }
              : item,
          ),
        );
        SonnerSuccess(`Đã hạ @${user.username} về Free.`);
      } else {
        await updateApprovedUser(user.username, { vipPlanId: planId });
        fetchUsers();
        SonnerSuccess(`Đã cập nhật gói VIP cho @${user.username}.`);
      }
    } catch {
      SonnerError("Không cập nhật được gói VIP.");
    }
  };

  const handleAddCredits = async (user, delta) => {
    try {
      const current = Number(user.aiCredits || 0);
      const nextCredits = Math.max(0, current + delta);
      await updateApprovedUser(user.username, { aiCredits: nextCredits });
      setUsers((currentList) =>
        currentList.map((item) =>
          item.username === user.username
            ? { ...item, aiCredits: nextCredits, aiFilterEnabled: nextCredits > 0 }
            : item,
        ),
      );
      SonnerSuccess(`Đã chỉnh số lượt AI của @${user.username} thành ${nextCredits}`);
    } catch {
      SonnerError("Không cập nhật được số lượt AI.");
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
      <section className="mx-auto max-w-6xl space-y-6">
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
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-1 text-amber-300">
                👑 {lifetimeCount} Vĩnh viễn
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-1 text-emerald-400">
                <Gift size={13} /> {trialCount} Đã dùng thử
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-secondary/15 px-2 py-1 text-secondary">
                <Sparkles size={13} /> {aiUsersCount} Có lượt AI
              </span>
              {expiredVipCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-error/15 px-2 py-1 text-error">
                  <AlertTriangle size={13} /> {expiredVipCount} Hết hạn / Khóa
                </span>
              )}
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

        <PaymentManagement onAuthExpired={() => {
          handleLogout();
          SonnerWarning("Phiên admin đã hết hạn. Vui lòng đăng nhập lại.");
        }} />
        <NotificationSettings onAuthExpired={() => {
          handleLogout();
          SonnerWarning("Phiên admin đã hết hạn. Vui lòng đăng nhập lại.");
        }} />
        <AppCheckSettings />
        <AiFilterSettings />
        <CaptionSettings />

        {/* Add User Form */}
        <form
          onSubmit={handleAdd}
          className="rounded-lg border border-base-300 bg-base-200/50 p-4 space-y-3"
        >
          <h3 className="text-sm font-bold opacity-80">Thêm username mới</h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="form-control">
              <span className="label-text">Username Locket</span>
              <input
                className="input input-bordered mt-1 w-full"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Nhập username"
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
            <label className="form-control">
              <span className="label-text">Gói VIP</span>
              <select
                className="select select-bordered mt-1 w-full"
                value={vipPlanId}
                onChange={(e) => {
                  setRole("vip");
                  setVipPlanId(e.target.value);
                }}
              >
                {VIP_PLAN_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label className="form-control">
              <span className="label-text">Lượt AI Filter</span>
              <input
                type="number"
                min="0"
                className="input input-bordered mt-1 w-full"
                value={aiCredits}
                onChange={(e) => setAiCredits(Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="Số lượt ảnh (vd: 10, 25)"
              />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <fieldset>
              <legend className="label-text mb-1">Loại quyền</legend>
              <div className="grid h-10 grid-cols-2 rounded-lg border border-base-300 bg-base-100 p-1 w-fit">
                <button
                  type="button"
                  onClick={() => setRole("vip")}
                  className={`flex items-center justify-center gap-1 rounded-md px-3 text-xs font-semibold ${
                    role === "vip" ? "bg-warning text-warning-content" : "hover:bg-base-200"
                  }`}
                >
                  <Crown size={13} /> VIP
                </button>
                <button
                  type="button"
                  onClick={() => setRole("free")}
                  className={`flex items-center justify-center gap-1 rounded-md px-3 text-xs font-semibold ${
                    role === "free" ? "bg-neutral text-neutral-content" : "hover:bg-base-200"
                  }`}
                >
                  Free
                </button>
              </div>
            </fieldset>
            <button className="btn btn-primary self-end" disabled={saving}>
              <Plus size={16} />
              Thêm
            </button>
          </div>
        </form>

        {/* Search Bar, Filter Tabs & Sort Toolbar */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input for Username / Note */}
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" />
              <input
                type="text"
                className="input input-bordered input-sm w-full pl-9 pr-8 text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm username hoặc ghi chú..."
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs opacity-60 hover:opacity-100"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sort Order Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs opacity-60 flex items-center gap-1 shrink-0">
                <ArrowUpDown size={13} /> Sắp xếp:
              </span>
              <select
                className="select select-bordered select-sm text-xs font-medium"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="abc">A → Z (Bảng chữ cái)</option>
                <option value="zyx">Z → A</option>
                <option value="newest">Mới nhất</option>
              </select>
            </div>
          </div>

          {/* Filter Pills / Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {[
              { id: "all", label: "Tất cả", count: tabCounts.all },
              { id: "vip_1month", label: "1 Tháng", count: tabCounts.vip_1month },
              { id: "vip_6months", label: "6 Tháng", count: tabCounts.vip_6months },
              { id: "vip_1year", label: "1 Năm", count: tabCounts.vip_1year },
              { id: "vip_lifetime", label: "👑 Vĩnh viễn", count: tabCounts.vip_lifetime },
              { id: "trial", label: "🎁 Dùng thử", count: tabCounts.trial },
              { id: "ai", label: "✨ Filter AI", count: tabCounts.ai },
              { id: "expired", label: "⚠️ Hết hạn / Khóa", count: tabCounts.expired },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition shrink-0 ${
                  filterTab === tab.id
                    ? "bg-primary text-primary-content shadow-sm"
                    : "bg-base-200/80 hover:bg-base-200 text-base-content/80 border border-base-300"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  filterTab === tab.id ? "bg-black/20 text-white" : "bg-base-300 text-base-content/70"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="text-[11px] opacity-60">
            Đang hiển thị <strong>{filteredUsers.length}</strong> / <strong>{users.length}</strong> username
          </div>
        </div>

        {/* User Table */}
        <div className="overflow-x-auto rounded-lg border border-base-300">
          <table className="table table-sm w-full">
            <thead className="bg-base-200">
              <tr>
                <th className="text-xs">Username</th>
                <th className="text-xs hidden md:table-cell">Ghi chú</th>
                <th className="text-xs">Gói VIP</th>
                <th className="text-xs hidden lg:table-cell">VIP Hết hạn</th>
                <th className="text-xs">Số lượt AI</th>
                <th className="text-xs">Trạng thái</th>
                <th className="text-xs text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 opacity-70">Đang tải...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 opacity-70">
                    Chưa có username nào được phê duyệt.
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 opacity-70">
                    Không tìm thấy username nào phù hợp với bộ lọc hoặc tìm kiếm.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id || user.username} className="hover:bg-base-200/30">
                    {/* Username */}
                    <td>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-white">@{user.username}</span>
                        {user.hasUsedTrial && (
                          user.vipPlanId === "vip_trial" && !isExpired(user.vipExpireAt) ? (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              title="Tài khoản đang trong 24h dùng thử miễn phí"
                            >
                              <Gift size={10} /> Đang dùng thử (1N)
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/25"
                              title="Tài khoản đã sử dụng gói dùng thử"
                            >
                              <Check size={10} /> Đã dùng thử
                            </span>
                          )
                        )}
                      </div>
                      {user.lastExpiredVipPlan && (
                        <div className="text-[10px] text-error/70 mt-0.5">
                          Gói cũ: {user.lastExpiredVipPlan}
                        </div>
                      )}
                    </td>

                    {/* Ghi chú */}
                    <td className="hidden md:table-cell">
                      <span className="text-sm opacity-70 truncate max-w-[120px] inline-block">
                        {user.note || "—"}
                      </span>
                    </td>

                    {/* Gói VIP */}
                    <td>
                      <VipPlanBadge user={user} />
                      <div className="mt-1">
                        <select
                          className="select select-bordered select-xs w-full max-w-[150px]"
                          value={user.role === "free" ? "" : (user.vipPlanId || (user.vipExpireAt ? "vip_1month" : "vip_lifetime"))}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "") {
                              handleVipPlanChange(user, "");
                            } else {
                              handleVipPlanChange(user, val);
                            }
                          }}
                        >
                          <option value="">Free</option>
                          {VIP_PLAN_OPTIONS.filter((o) => o.value).map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </td>

                    {/* VIP Hết hạn */}
                    <td className="hidden lg:table-cell">
                      {user.role === "vip" && (user.vipPlanId === "vip_lifetime" || !user.vipExpireAt) ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-md">
                          <Crown size={12} /> Vĩnh viễn
                        </span>
                      ) : user.vipExpireAt ? (
                        <div className="text-xs">
                          <div className="opacity-70">{formatDate(user.vipExpireAt)}</div>
                          <div className={`font-semibold ${isExpired(user.vipExpireAt) ? "text-error" : "text-success"}`}>
                            {isExpired(user.vipExpireAt) ? "Hết hạn" : `Còn ${remainingDays(user.vipExpireAt)} ngày`}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs opacity-40">—</span>
                      )}
                    </td>

                    {/* Số lượt AI */}
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-violet-400 text-sm">
                          {user.aiCredits || 0}
                        </span>
                        <span className="text-[11px] opacity-60">lượt</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleAddCredits(user, 10)}
                          className="btn btn-ghost btn-xs px-1.5 text-[10px] text-cyan-400 border border-cyan-400/30"
                          title="Cộng 10 lượt"
                        >
                          +10
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddCredits(user, 25)}
                          className="btn btn-ghost btn-xs px-1.5 text-[10px] text-violet-400 border border-violet-400/30"
                          title="Cộng 25 lượt"
                        >
                          +25
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddCredits(user, 65)}
                          className="btn btn-ghost btn-xs px-1.5 text-[10px] text-amber-400 border border-amber-400/30"
                          title="Cộng 65 lượt"
                        >
                          +65
                        </button>
                      </div>
                    </td>

                    {/* Trạng thái */}
                    <td>
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
                    </td>

                    {/* Thao tác */}
                    <td>
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
