import { useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  Crown,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Search,
  Calendar,
  DollarSign,
  Sparkles,
} from "lucide-react";
import {
  listPaymentOrders,
  listAdminSubscriptions,
} from "@/services/AdminServices";
import { SonnerError } from "@/components/ui/SonnerToast";

const formatDate = (val) => {
  if (!val) return "—";
  const d = typeof val === "number" ? new Date(val) : new Date(val);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatCurrency = (val) => {
  if (!val) return "—";
  return Number(val).toLocaleString("vi-VN") + "đ";
};

const CategoryBadge = ({ category }) => {
  if (category === "ai_filter") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/30 px-2 py-0.5 text-xs font-semibold">
        <Sparkles size={11} /> AI Filter
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 text-xs font-semibold">
      <Crown size={11} /> VIP
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const map = {
    PAID: {
      color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      icon: <CheckCircle2 size={13} />,
      label: "Đã thanh toán",
    },
    PENDING: {
      color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      icon: <Clock size={13} />,
      label: "Chờ thanh toán",
    },
    CANCELLED: {
      color: "bg-red-500/15 text-red-400 border-red-500/30",
      icon: <XCircle size={13} />,
      label: "Đã hủy",
    },
  };
  const s = map[status] || map.PENDING;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${s.color}`}
    >
      {s.icon}
      {s.label}
    </span>
  );
};

const VipBadge = ({ isExpired, expireAt }) => {
  if (!expireAt) return <span className="text-xs text-gray-500">—</span>;

  const now = Date.now();
  const remaining = Math.max(0, Math.ceil((expireAt - now) / (1000 * 60 * 60 * 24)));

  if (isExpired) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 text-xs font-semibold">
        <XCircle size={12} />
        Hết hạn
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-xs font-semibold">
      <CheckCircle2 size={12} />
      Còn {remaining} ngày
    </span>
  );
};

export default function PaymentManagement({ onAuthExpired }) {
  const [activeTab, setActiveTab] = useState("orders");
  const [orders, setOrders] = useState([]);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isOpen, setIsOpen] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ordersData, subsData] = await Promise.all([
        listPaymentOrders(),
        listAdminSubscriptions(),
      ]);
      setOrders(ordersData);
      setSubs(subsData);
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        onAuthExpired?.();
      } else {
        SonnerError("Không tải được dữ liệu thanh toán.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (o) =>
          (o.username || "").toLowerCase().includes(q) ||
          String(o.orderCode || "").includes(q),
      );
    }
    if (statusFilter !== "ALL") {
      result = result.filter((o) => o.status === statusFilter);
    }
    return result;
  }, [orders, search, statusFilter]);

  const filteredSubs = useMemo(() => {
    if (!search.trim()) return subs;
    const q = search.trim().toLowerCase();
    return subs.filter(
      (s) =>
        (s.username || "").toLowerCase().includes(q) ||
        (s.email || "").toLowerCase().includes(q),
    );
  }, [subs, search]);

  const stats = useMemo(() => {
    const paid = orders.filter((o) => o.status === "PAID");
    const totalRevenue = paid.reduce((sum, o) => sum + (o.price || 0), 0);
    const activeSubs = subs.filter((s) => !s.isExpired);
    return { totalOrders: orders.length, paidOrders: paid.length, totalRevenue, activeSubs: activeSubs.length };
  }, [orders, subs]);

  return (
    <div className="rounded-lg border border-base-300 bg-base-200/30 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-base-200/50 transition"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-400">
            <CreditCard size={18} />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-bold">Quản lý thanh toán</h3>
            <p className="text-xs opacity-60">
              {stats.paidOrders} đã thanh toán • {stats.activeSubs} đang hoạt động •{" "}
              {formatCurrency(stats.totalRevenue)} doanh thu
            </p>
          </div>
        </div>
        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {!isOpen ? null : (
        <div className="border-t border-base-300 p-4 space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl bg-base-100/50 border border-base-300 p-3 text-center">
              <p className="text-2xl font-bold text-primary">{stats.totalOrders}</p>
              <p className="text-xs opacity-60">Tổng đơn</p>
            </div>
            <div className="rounded-xl bg-base-100/50 border border-base-300 p-3 text-center">
              <p className="text-2xl font-bold text-success">{stats.paidOrders}</p>
              <p className="text-xs opacity-60">Đã thanh toán</p>
            </div>
            <div className="rounded-xl bg-base-100/50 border border-base-300 p-3 text-center">
              <p className="text-2xl font-bold text-warning">{stats.activeSubs}</p>
              <p className="text-xs opacity-60">VIP đang hoạt động</p>
            </div>
            <div className="rounded-xl bg-base-100/50 border border-base-300 p-3 text-center">
              <p className="text-2xl font-bold text-info">{formatCurrency(stats.totalRevenue)}</p>
              <p className="text-xs opacity-60">Doanh thu</p>
            </div>
          </div>

          {/* Tabs + Search */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex gap-1 rounded-lg bg-base-100 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("orders")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                  activeTab === "orders" ? "bg-primary text-primary-content" : "hover:bg-base-200"
                }`}
              >
                <DollarSign size={14} />
                Đơn hàng ({orders.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("subs")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                  activeTab === "subs" ? "bg-primary text-primary-content" : "hover:bg-base-200"
                }`}
              >
                <Crown size={14} />
                VIP / AI ({subs.length})
              </button>
            </div>

            <div className="flex gap-2 items-center w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm username..."
                  className="input input-bordered input-sm w-full sm:w-48 pl-8"
                />
              </div>
              {activeTab === "orders" && (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="select select-bordered select-sm"
                >
                  <option value="ALL">Tất cả</option>
                  <option value="PAID">Đã thanh toán</option>
                  <option value="PENDING">Chờ TT</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              )}
              <button
                type="button"
                onClick={fetchData}
                disabled={loading}
                className="btn btn-ghost btn-sm"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="py-8 text-center opacity-60">Đang tải...</div>
          ) : activeTab === "orders" ? (
            <div className="overflow-x-auto rounded-lg border border-base-300">
              <table className="table table-sm w-full">
                <thead className="bg-base-200">
                  <tr>
                    <th className="text-xs">Mã đơn</th>
                    <th className="text-xs">Username</th>
                    <th className="text-xs">Loại</th>
                    <th className="text-xs">Gói</th>
                    <th className="text-xs">Số tiền</th>
                    <th className="text-xs">Trạng thái</th>
                    <th className="text-xs">Ngày tạo</th>
                    <th className="text-xs">Thanh toán</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-6 opacity-50">
                        Không có đơn hàng nào
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-base-200/30">
                        <td className="font-mono text-xs">#{order.orderCode}</td>
                        <td className="font-semibold">@{order.username || "—"}</td>
                        <td><CategoryBadge category={order.planCategory} /></td>
                        <td className="text-xs">{order.planName || "—"}</td>
                        <td className="text-xs font-semibold">{formatCurrency(order.price)}</td>
                        <td><StatusBadge status={order.status} /></td>
                        <td className="text-xs opacity-70">{formatDate(order.createdAt)}</td>
                        <td className="text-xs opacity-70">{formatDate(order.paidAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-base-300">
              <table className="table table-sm w-full">
                <thead className="bg-base-200">
                  <tr>
                    <th className="text-xs">Username</th>
                    <th className="text-xs">Loại</th>
                    <th className="text-xs">Gói</th>
                    <th className="text-xs">Thời hạn</th>
                    <th className="text-xs">Hết hạn</th>
                    <th className="text-xs">Trạng thái</th>
                    <th className="text-xs">TT lần cuối</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-6 opacity-50">
                        Chưa có gói nào
                      </td>
                    </tr>
                  ) : (
                    filteredSubs.map((sub) => (
                      <tr key={sub.id} className="hover:bg-base-200/30">
                        <td className="font-semibold">@{sub.username || sub.email || "—"}</td>
                        <td><CategoryBadge category={sub.category} /></td>
                        <td className="text-xs">{sub.planName || "—"}</td>
                        <td className="text-xs">{sub.planDays ? `${sub.planDays} ngày` : "—"}</td>
                        <td className="text-xs opacity-70">{formatDate(sub.expireAt)}</td>
                        <td><VipBadge isExpired={sub.isExpired} expireAt={sub.expireAt} /></td>
                        <td className="text-xs opacity-70">
                          {sub.lastPayment ? formatCurrency(sub.lastPayment.amount) : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
