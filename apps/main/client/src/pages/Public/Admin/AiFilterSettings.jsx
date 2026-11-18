import { useEffect, useMemo, useState } from "react";
import { Cloud, Save, Sparkles } from "lucide-react";
import {
  getAiFilterSettings,
  saveAiFilterSettings,
} from "@/services/AdminServices";
import {
  SonnerError,
  SonnerSuccess,
  SonnerWarning,
} from "@/components/ui/SonnerToast";

export default function AiFilterSettings() {
  const [status, setStatus] = useState(null);
  const [modelId, setModelId] = useState("");
  const [inputKiraKey, setInputKiraKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  useEffect(() => {
    let active = true;
    getAiFilterSettings()
      .then((data) => {
        if (!active) return;
        setStatus(data);
        setModelId(data.activeModelId);
      })
      .catch((error) => {
        if (!active) return;
        SonnerError(
          error.response?.data?.message || "Không tải được cấu hình AI Filter.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selected = useMemo(
    () => status?.models?.find((model) => model.id === modelId) || null,
    [modelId, status],
  );

  const save = async () => {
    if (!selected || saving) return;
    if (selected.supportsImageGeneration === false) {
      SonnerWarning("Model này chỉ chat và đọc ảnh, không tạo ảnh.");
      return;
    }
    if (!selected.configured && !inputKiraKey) {
      SonnerWarning(
        selected.provider === "kira"
          ? "Server chưa có KIRA_API_KEY. Vui lòng nhập key bên dưới."
          : "Server chưa cấu hình Cloudflare Workers AI.",
      );
      return;
    }

    try {
      setSaving(true);
      const result = await saveAiFilterSettings({
        modelId,
        kiraApiKey: inputKiraKey.trim() || undefined,
      });
      setStatus(result.data);
      setModelId(result.data.activeModelId);
      if (inputKiraKey.trim()) setInputKiraKey("");
      SonnerSuccess("Đã cập nhật mô hình AI.");
    } catch (error) {
      SonnerError(
        error.response?.data?.message || "Không đổi được mô hình AI.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateKiraKey = async (e) => {
    e.preventDefault();
    if (!inputKiraKey.trim()) {
      SonnerWarning("Vui lòng nhập Kira API Key mới.");
      return;
    }
    try {
      setSavingKey(true);
      const result = await saveAiFilterSettings({
        modelId: modelId || status?.activeModelId,
        kiraApiKey: inputKiraKey.trim(),
      });
      setStatus(result.data);
      setInputKiraKey("");
      SonnerSuccess("Đã cập nhật Kira API Key mới thành công!");
    } catch (error) {
      SonnerError(
        error.response?.data?.message || "Không thể cập nhật API Key.",
      );
    } finally {
      setSavingKey(false);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-base-300 bg-base-200/30 p-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Sparkles size={19} /> Mô hình AI Filter
          {status?.models?.length > 0 && (
            <span className="badge badge-primary badge-sm">
              {status.models.length} mô hình
            </span>
          )}
        </h2>
        <p className="mt-1 text-sm opacity-65">
          Chọn mô hình dùng cho toàn hệ thống. Thay đổi được áp dụng ngay, không cần khởi động lại server.
        </p>
      </div>

      {status?.supportsImageGeneration === false && <p role="alert" className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">Model hiện tại là HY4 Flash Free, chỉ hỗ trợ chat và đọc ảnh. Hãy chọn mô hình tạo ảnh để dùng AI Filter.</p>}

      {/* Cập nhật nhanh Kira API Key */}
      <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-3.5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold text-violet-300 flex items-center gap-1.5">
            <Sparkles size={14} />
            <span>Kira AI API Key</span>
          </div>
          <div className="text-[11px] opacity-75">
            Key hiện tại:{" "}
            <code className="bg-black/30 px-1.5 py-0.5 rounded text-white font-mono">
              {status?.kiraApiKeyMasked || (status?.hasKiraApiKey ? "Đang dùng ENV" : "Chưa có")}
            </code>
          </div>
        </div>
        <form onSubmit={handleUpdateKiraKey} className="flex gap-2">
          <input
            type="password"
            className="input input-bordered input-sm flex-1 text-xs"
            value={inputKiraKey}
            onChange={(e) => setInputKiraKey(e.target.value)}
            placeholder="Nhập hoặc dán Kira API Key mới tại đây..."
          />
          <button
            type="submit"
            className="btn btn-primary btn-sm text-xs"
            disabled={savingKey || !inputKiraKey.trim()}
          >
            {savingKey ? "Đang lưu..." : "Cập nhật Key"}
          </button>
        </form>
        <p className="text-[11px] opacity-60">
          💡 Khi Kira báo <em>"Invalid API key"</em> hoặc tài khoản hết tiền/đổi key mới trên{" "}
          <a
            href="https://kiraai.vn"
            target="_blank"
            rel="noreferrer"
            className="text-violet-400 underline font-medium hover:text-violet-300"
          >
            kiraai.vn
          </a>
          , dán key mới vào đây và bấm <strong>Cập nhật Key</strong> là áp dụng ngay lập tức mà không cần deploy lại.
        </p>
      </div>

      {loading ? (
        <div className="py-5 text-center text-sm opacity-60">Đang tải cấu hình...</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {(status?.models || []).map((model) => {
            const checked = model.id === modelId;
            const Icon = model.provider === "cloudflare" ? Cloud : Sparkles;
            return (
              <label
                key={model.id}
                className={`relative cursor-pointer rounded-xl border p-4 transition-colors ${
                  checked
                    ? "border-primary bg-primary/10"
                    : "border-base-300 bg-base-100 hover:border-primary/40"
                }`}
              >
                <input
                  type="radio"
                  name="ai-filter-model"
                  className="radio radio-primary absolute right-3 top-3 radio-sm"
                  checked={checked}
                  disabled={saving || model.supportsImageGeneration === false}
                  onChange={() => setModelId(model.id)}
                />
                <Icon size={22} className={model.provider === "cloudflare" ? "text-orange-500" : "text-primary"} />
                <div className="mt-3 pr-7 font-semibold">{model.label}</div>
                <div className="mt-1 text-xs opacity-60">
                  {model.provider === "kira" ? "Kira AI" : "Cloudflare Workers AI"}
                </div>
                <div className={`mt-3 text-xs font-medium ${model.configured && model.supportsImageGeneration !== false ? "text-success" : "text-warning"}`}>
                  {model.supportsImageGeneration === false ? "Chỉ chat / đọc ảnh · không tạo ảnh" : model.configured ? "Sẵn sàng" : "Thiếu API key phía server"}
                </div>
              </label>
            );
          })}
        </div>
      )}

      {status && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-base-300 pt-3">
          <p className="text-xs opacity-60">
            Nguồn cấu hình: {status.source === "admin" ? "Admin" : "env mặc định"}
            {!status.storageAvailable && " · Firestore tạm thời không khả dụng"}
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={saving || !selected || selected.supportsImageGeneration === false || modelId === status.activeModelId}
            onClick={save}
          >
            <Save size={15} /> {saving ? "Đang lưu..." : "Lưu và áp dụng"}
          </button>
        </div>
      )}
    </section>
  );
}
