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
  Trash2,
  RotateCcw,
  Archive,
  CalendarDays,
  AlertTriangle,
} from "lucide-react";
import {
  listPaymentOrders,
  listAdminSubscriptions,
  deletePaymentOrder,
  cleanupCancelledPaymentOrders,
  resetRevenue,
} from "@/services/AdminServices";
import {
  SonnerError,
  SonnerSuccess,
  SonnerInfo,
} from "@/components/ui/SonnerToast";

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
  if (!val) return "0đ";
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
  const [revenueSettings, setRevenueSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [monthFilter, setMonthFilter] = useState("CURRENT"); // "CURRENT" | "ALL" | "PAST"
  const [isOpen, setIsOpen] = useState(true);

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthLabel = `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ordersRes, subsData] = await Promise.all([
        listPaymentOrders(),
        listAdminSubscriptions(),
      ]);
      const ordersList = Array.isArray(ordersRes) ? ordersRes : ordersRes?.orders || [];
      const revSettings = ordersRes?.revenueSettings || null;
      setOrders(ordersList);
      setSubs(subsData);
      setRevenueSettings(revSettings);
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

  // Xoá 1 đơn hàng cụ thể
  const handleDeleteOrder = async (order) => {
    const code = order.orderCode || order.id;
    if (!window.confirm(`Bạn có chắc chắn muốn xoá đơn hàng #${code} của @${order.username}?`)) {
      return;
    }
    try {
      setActionLoading(true);
      await deletePaymentOrder(order.id || code);
      setOrders((prev) => prev.filter((o) => (o.id || o.orderCode) !== (order.id || code)));
      SonnerSuccess(`Đã xoá đơn hàng #${code}`);
    } catch {
      SonnerError("Không thể xoá đơn hàng.");
    } finally {
      setActionLoading(false);
    }
  };

  // Dọn dẹp tất cả đơn hàng đã huỷ / hết hạn
  const handleCleanupCancelled = async () => {
    if (!window.confirm("Xác nhận XOÁ TOÀN BỘ đơn hàng đã huỷ và hết hạn?\nCác đơn thành công sẽ được giữ nguyên an toàn.")) {
      return;
    }
    try {
      setActionLoading(true);
      const res = await cleanupCancelledPaymentOrders();
      await fetchData();
      SonnerSuccess(res.message || "Đã dọn dẹp các đơn đã huỷ");
    } catch {
      SonnerError("Không thể dọn dẹp đơn hàng.");
    } finally {
      setActionLoading(false);
    }
  };

  // Reset doanh thu: Chốt mốc doanh thu cũ vào lịch sử, bắt đầu tính đợt mới từ 0đ
  const handleResetRevenue = async () => {
    if (
      !window.confirm(
        "Xác nhận RESET DOANH THU?\n\nDoanh thu trước thời điểm này sẽ được lưu trữ an toàn vào mục 'Lịch sử / Doanh thu cũ'.\nDoanh thu mới sẽ bắt đầu tính lại từ 0đ cho các đơn hàng tiếp theo.",
      )
    ) {
      return;
    }
    try {
      setActionLoading(true);
      const res = await resetRevenue();
      await fetchData();
      SonnerSuccess(res.message || "Đã reset doanh thu thành công!");
    } catch {
      SonnerError("Không thể reset doanh thu.");
    } finally {
      setActionLoading(false);
    }
  };

  // Thống kê doanh thu theo tháng hiện tại, các tháng cũ, và sau khi reset
  const stats = useMemo(() => {
    const paid = orders.filter((o) => o.status === "PAID");
    const activeSubs = subs.filter((s) => !s.isExpired);
    const resetTime = revenueSettings?.lastResetAt ? new Date(revenueSettings.lastResetAt).getTime() : 0;

    // Phân loại theo tháng hiện tại
    const thisMonthPaid = paid.filter((o) => {
      const d = o.paidAt ? new Date(o.paidAt) : o.createdAt ? new Date(o.createdAt) : null;
      if (!d || isNaN(d.getTime())) return false;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return key === currentMonthKey;
    });

    const pastMonthsPaid = paid.filter((o) => {
      const d = o.paidAt ? new Date(o.paidAt) : o.createdAt ? new Date(o.createdAt) : null;
      if (!d || isNaN(d.getTime())) return false;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return key !== currentMonthKey;
    });

    // Doanh thu sau lần reset gần nhất
    const sinceResetPaid = resetTime > 0
      ? paid.filter((o) => {
          const t = o.paidAt ? new Date(o.paidAt).getTime() : new Date(o.createdAt).getTime();
          return t >= resetTime;
        })
      : paid;

    // Doanh thu đã lưu trữ trước lần reset
    const archivedBeforeReset = resetTime > 0
      ? paid.filter((o) => {
          const t = o.paidAt ? new Date(o.paidAt).getTime() : new Date(o.createdAt).getTime();
          return t < resetTime;
        })
      : [];

    const totalRevenue = paid.reduce((sum, o) => sum + (o.price || 0), 0);
    const thisMonthRevenue = thisMonthPaid.reduce((sum, o) => sum + (o.price || 0), 0);
    const pastMonthsRevenue = pastMonthsPaid.reduce((sum, o) => sum + (o.price || 0), 0);
    const currentBatchRevenue = sinceResetPaid.reduce((sum, o) => sum + (o.price || 0), 0);
    const archivedRevenue = archivedBeforeReset.reduce((sum, o) => sum + (o.price || 0), 0);

    return {
      totalOrders: orders.length,
      paidOrders: paid.length,
      thisMonthPaidCount: thisMonthPaid.length,
      totalRevenue,
      thisMonthRevenue,
      pastMonthsRevenue,
      currentBatchRevenue,
      archivedRevenue,
      activeSubs: activeSubs.length,
      hasReset: resetTime > 0,
      lastResetAt: revenueSettings?.lastResetAt,
    };
  }, [orders, subs, revenueSettings, currentMonthKey]);

  // Bộ lọc đơn hàng (theo text search, trạng thái và tháng)
  const filteredOrders = useMemo(() => {
    let result = orders;

    // Lọc theo tháng
    if (monthFilter === "CURRENT") {
      result = result.filter((o) => {
        const d = o.paidAt ? new Date(o.paidAt) : o.createdAt ? new Date(o.createdAt) : null;
        if (!d || isNaN(d.getTime())) return false;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return key === currentMonthKey;
      });
    } else if (monthFilter === "PAST") {
      result = result.filter((o) => {
        const d = o.paidAt ? new Date(o.paidAt) : o.createdAt ? new Date(o.createdAt) : null;
        if (!d || isNaN(d.getTime())) return false;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return key !== currentMonthKey;
      });
    }

    // Lọc theo tìm kiếm
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (o) =>
          (o.username || "").toLowerCase().includes(q) ||
          String(o.orderCode || "").includes(q) ||
          (o.planName || "").toLowerCase().includes(q),
      );
    }

    // Lọc theo trạng thái
    if (statusFilter !== "ALL") {
      result = result.filter((o) => o.status === statusFilter);
    }

    return result;
  }, [orders, search, statusFilter, monthFilter, currentMonthKey]);

  const filteredSubs = useMemo(() => {
    if (!search.trim()) return subs;
    const q = search.trim().toLowerCase();
    return subs.filter(
      (s) =>
        (s.username || "").toLowerCase().includes(q) ||
        (s.email || "").toLowerCase().includes(q),
    );
  }, [subs, search]);

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
            <h3 className="text-sm font-bold flex items-center gap-2">
              Quản lý thanh toán & Doanh thu
              <span className="badge badge-warning badge-xs font-semibold">Tự động theo tháng</span>
            </h3>
            <p className="text-xs opacity-60">
              {currentMonthLabel}: {formatCurrency(stats.thisMonthRevenue)} • Tổng tích luỹ:{" "}
              {formatCurrency(stats.totalRevenue)}
            </p>
          </div>
        </div>
        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {!isOpen ? null : (
        <div className="border-t border-base-300 p-4 space-y-4">
          {/* Stats Cards: Doanh thu tháng này, Đợt hiện tại, Doanh thu cũ, VIP */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Card 1: Doanh thu tháng này (Tự động cập nhật theo tháng mới) */}
            <div className="rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-cyan-400 font-semibold mb-1">
                <CalendarDays size={13} />
                <span>Doanh thu {currentMonthLabel}</span>
              </div>
              <p className="text-2xl font-extrabold text-cyan-300">
                {formatCurrency(stats.thisMonthRevenue)}
              </p>
              <p className="text-[11px] opacity-60 mt-0.5">
                {stats.thisMonthPaidCount} đơn đã thanh toán
              </p>
            </div>

            {/* Card 2: Doanh thu đợt hiện tại (hoặc sau khi Reset) */}
            <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-emerald-400 font-semibold mb-1">
                <DollarSign size={13} />
                <span>{stats.hasReset ? "Doanh thu đợt này" : "Tổng doanh thu"}</span>
              </div>
              <p className="text-2xl font-extrabold text-emerald-400">
                {formatCurrency(stats.currentBatchRevenue)}
              </p>
              <p className="text-[11px] opacity-60 mt-0.5">
                {stats.hasReset
                  ? `Reset: ${formatDate(stats.lastResetAt)}`
                  : `${stats.paidOrders} đơn thành công`}
              </p>
            </div>

            {/* Card 3: Doanh thu cũ / Đã lưu trữ */}
            <div className="rounded-xl bg-base-100/60 border border-base-300 p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-xs opacity-70 font-semibold mb-1">
                <Archive size={13} />
                <span>Doanh thu cũ / Lưu trữ</span>
              </div>
              <p className="text-xl font-bold text-gray-300">
                {formatCurrency(stats.hasReset ? stats.archivedRevenue : stats.pastMonthsRevenue)}
              </p>
              <p className="text-[11px] opacity-60 mt-0.5">
                {stats.hasReset ? "Đã chốt trước mốc reset" : "Các tháng trước đó"}
              </p>
            </div>

            {/* Card 4: VIP đang hoạt động */}
            <div className="rounded-xl bg-base-100/60 border border-base-300 p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-amber-400 font-semibold mb-1">
                <Crown size={13} />
                <span>VIP đang hoạt động</span>
              </div>
              <p className="text-2xl font-bold text-warning">{stats.activeSubs}</p>
              <p className="text-[11px] opacity-60 mt-0.5">Tổng {subs.length} thuê bao</p>
            </div>
          </div>

          {/* Action Toolbar: Bộ lọc tháng, Nút dọn dẹp đơn huỷ, Nút reset doanh thu */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-xl bg-base-100/70 border border-base-300">
            {/* Bộ lọc tháng */}
            <div className="flex items-center gap-1 text-xs">
              <span className="font-semibold opacity-70 flex items-center gap-1 mr-1">
                <Calendar size={13} /> Tháng:
              </span>
              <button
                type="button"
                onClick={() => setMonthFilter("CURRENT")}
                className={`btn btn-xs ${
                  monthFilter === "CURRENT" ? "btn-primary font-bold" : "btn-ghost"
                }`}
              >
                {currentMonthLabel}
              </button>
              <button
                type="button"
                onClick={() => setMonthFilter("ALL")}
                className={`btn btn-xs ${monthFilter === "ALL" ? "btn-primary font-bold" : "btn-ghost"}`}
              >
                Tất cả thời gian
              </button>
              <button
                type="button"
                onClick={() => setMonthFilter("PAST")}
                className={`btn btn-xs ${monthFilter === "PAST" ? "btn-primary font-bold" : "btn-ghost"}`}
              >
                Tháng cũ / Lưu trữ
              </button>
            </div>

            {/* Các nút hành động quản lý */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCleanupCancelled}
                disabled={actionLoading}
                className="btn btn-xs btn-outline btn-error gap-1"
                title="Xoá tất cả đơn hàng đã huỷ và đơn quá hạn 5 phút"
              >
                <Trash2 size={12} />
                Dọn dẹp đơn huỷ
              </button>
              <button
                type="button"
                onClick={handleResetRevenue}
                disabled={actionLoading}
                className="btn btn-xs btn-outline btn-warning gap-1"
                title="Lưu doanh thu hiện tại vào lịch sử và bắt đầu tính lại từ 0đ"
              >
                <RotateCcw size={12} />
                Reset doanh thu
              </button>
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
                Đơn hàng ({filteredOrders.length})
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
                  placeholder="Tìm username, mã đơn..."
                  className="input input-bordered input-sm w-full sm:w-52 pl-8"
                />
              </div>
              {activeTab === "orders" && (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="select select-bordered select-sm"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="PAID">Đã thanh toán</option>
                  <option value="PENDING">Chờ TT (5p)</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              )}
              <button
                type="button"
                onClick={fetchData}
                disabled={loading}
                className="btn btn-ghost btn-sm"
                title="Làm mới dữ liệu"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="py-8 text-center opacity-60">Đang tải dữ liệu...</div>
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
                    <th className="text-xs text-right">Xoá</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-6 opacity-50">
                        Không có đơn hàng nào
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr key={order.id || order.orderCode} className="hover:bg-base-200/30">
                        <td className="font-mono text-xs">#{order.orderCode}</td>
                        <td className="font-semibold">@{order.username || "—"}</td>
                        <td><CategoryBadge category={order.planCategory} /></td>
                        <td className="text-xs">{order.planName || "—"}</td>
                        <td className="text-xs font-semibold">{formatCurrency(order.price)}</td>
                        <td><StatusBadge status={order.status} /></td>
                        <td className="text-xs opacity-70">{formatDate(order.createdAt)}</td>
                        <td className="text-xs opacity-70">{formatDate(order.paidAt)}</td>
                        <td className="text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteOrder(order)}
                            disabled={actionLoading}
                            className="btn btn-ghost btn-xs text-error hover:bg-error/20"
                            title="Xoá đơn hàng này"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
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
