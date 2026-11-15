import { useCallback, useEffect, useMemo, useState } from "react";
import { Edit2, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import {
  deleteCaptionPreset,
  listCaptionPresets,
  saveCaptionPreset,
} from "@/services/AdminServices";
import { SonnerError, SonnerSuccess, SonnerWarning } from "@/components/ui/SonnerToast";
import { useOverlayStore } from "@/stores";

const CAPTION_TYPES = [
  ["suggest", "Gợi ý"],
  ["holiday", "Holiday"],
  ["decorative", "Trang trí"],
  ["custome", "Tùy chỉnh"],
  ["background", "Nền"],
  ["image_icon", "Icon"],
  ["image_gif", "GIF"],
  ["special", "Đặc biệt"],
];

const PROTECTED_IDS = new Set([
  "weather", "location", "time", "music", "poll", "color_palette", "star_sign",
  "review", "standard", "caption:weather", "caption:location", "caption:time",
  "caption:music", "caption:poll", "caption:color_palette", "caption:star_sign",
  "caption:review", "caption:standard",
]);

const emptyForm = (sectionId) => ({
  sectionId,
  presetId: "",
  overlayId: "",
  caption: "",
  icon: "✨",
  type: sectionId,
  color_top: "#000000",
  color_bottom: "#000000",
  text_color: "#FFFFFF",
  order_index: 9999,
  active: true,
  is_editable: true,
  custom: true,
});

const iconText = (icon) =>
  typeof icon === "string" ? icon : icon?.data || icon?.url || "";

const presetToForm = (preset, sectionId) => ({
  sectionId,
  presetId: preset.admin_id || preset.id || preset.preset_id || preset.overlay_id,
  overlayId: preset.overlay_id || preset.preset_id || preset.id,
  caption: preset.caption ?? preset.preset_caption ?? preset.text ?? "",
  icon: iconText(preset.icon),
  type: preset.type || sectionId,
  color_top: preset.color_top || preset.background?.colors?.[0] || "#000000",
  color_bottom: preset.color_bottom || preset.background?.colors?.[1] || "#000000",
  text_color: preset.text_color || "#FFFFFF",
  order_index: preset.order_index ?? preset.order_id ?? 9999,
  active: preset.active !== false,
  is_editable: preset.is_editable !== false,
  custom: preset.custom === true || preset.admin_custom === true,
});

export default function CaptionSettings() {
  const captionOverlays = useOverlayStore((state) => state.captionOverlays);
  const isLoading = useOverlayStore((state) => state.isLoading);
  const clearCaptionOverlays = useOverlayStore((state) => state.clearCaptionOverlays);
  const fetchCaptionOverlays = useOverlayStore((state) => state.fetchCaptionOverlays);
  const addCaptionOverlay = useOverlayStore((state) => state.addCaptionOverlay);
  const deleteCaptionOverlay = useOverlayStore((state) => state.deleteCaptionOverlay);
  const [activeTab, setActiveTab] = useState("suggest");
  const [managed, setManaged] = useState([]);
  const [form, setForm] = useState(null);
  const [originalId, setOriginalId] = useState(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    try {
      clearCaptionOverlays();
      const [, saved] = await Promise.all([fetchCaptionOverlays(), listCaptionPresets()]);
      setManaged(saved);
    } catch (error) {
      SonnerError(error.response?.data?.message || "Không tải được danh sách caption.");
    }
  }, [clearCaptionOverlays, fetchCaptionOverlays]);

  useEffect(() => {
    reload();
  }, [reload]);

  const currentPresets = useMemo(() => {
    const visible = [...(captionOverlays[activeTab] || [])];
    const ids = new Set(visible.map((item) => item.admin_id || item.id || item.preset_id || item.overlay_id));
    for (const item of managed) {
      if (item.sectionId !== activeTab || item.deleted || item.active !== false || ids.has(item.presetId)) continue;
      visible.push({
        ...item,
        admin_custom: item.custom === true,
        admin_id: item.presetId,
        preset_id: item.overlayId || item.presetId,
        overlay_id: item.overlayId || item.presetId,
        caption: item.caption,
      });
    }
    return visible.sort(
      (a, b) => Number(a.order_index ?? a.order_id ?? 9999) - Number(b.order_index ?? b.order_id ?? 9999),
    );
  }, [activeTab, captionOverlays, managed]);

  const startAdd = () => {
    setOriginalId(null);
    setForm(emptyForm(activeTab));
  };

  const startEdit = (preset) => {
    const next = presetToForm(preset, activeTab);
    setOriginalId(next.presetId);
    setForm(next);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form?.presetId.trim()) {
      SonnerWarning("Nhập ID caption.");
      return;
    }
    if (!originalId && currentPresets.some((item) => (item.admin_id || item.id || item.preset_id || item.overlay_id) === form.presetId)) {
      SonnerWarning("ID caption đã tồn tại.");
      return;
    }
    try {
      setSaving(true);
      const saved = await saveCaptionPreset(form);
      const displayPreset = {
        ...saved,
        admin_id: saved.presetId,
        admin_custom: saved.custom === true,
        preset_id: saved.overlayId || saved.presetId,
        overlay_id: saved.overlayId || saved.presetId,
      };
      setManaged((current) => [
        ...current.filter(
          (item) => !(item.sectionId === saved.sectionId && item.presetId === saved.presetId),
        ),
        saved,
      ]);
      if (saved.active === false) {
        deleteCaptionOverlay(saved.sectionId, originalId || saved.presetId);
      } else {
        addCaptionOverlay(saved.sectionId, displayPreset);
      }
      setForm(null);
      setOriginalId(null);
      SonnerSuccess(originalId ? "Đã cập nhật caption." : "Đã thêm caption.");
    } catch (error) {
      SonnerError(error.response?.data?.message || "Không lưu được caption.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (preset) => {
    const presetId = preset.admin_id || preset.id || preset.preset_id || preset.overlay_id;
    const overlayId = preset.overlay_id || preset.preset_id;
    if (PROTECTED_IDS.has(presetId) || PROTECTED_IDS.has(overlayId) || preset.type === "time") {
      SonnerWarning("Caption hệ thống không thể bị xoá.");
      return;
    }
    if (!window.confirm(`Xoá caption ${presetId}?`)) return;
    try {
      const removed = await deleteCaptionPreset(activeTab, presetId);
      deleteCaptionOverlay(activeTab, presetId);
      setManaged((current) => removed.deletedPermanently
        ? current.filter((item) => !(item.sectionId === activeTab && item.presetId === presetId))
        : [
            ...current.filter((item) => !(item.sectionId === activeTab && item.presetId === presetId)),
            { ...removed, active: false, deleted: true },
          ]);
      if (form?.presetId === presetId) {
        setForm(null);
        setOriginalId(null);
      }
      SonnerSuccess("Đã xoá caption.");
    } catch (error) {
      SonnerError(error.response?.data?.message || "Không xoá được caption.");
    }
  };

  return (
    <section className="rounded-xl border border-base-300 bg-base-200/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Quản lý Caption</h2>
          <p className="text-sm opacity-65">Thay đổi được lưu trên máy chủ và áp dụng cho mọi thiết bị.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={reload} disabled={isLoading}>
            <RefreshCw size={15} /> Tải lại
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={startAdd}>
            <Plus size={15} /> Thêm caption
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {CAPTION_TYPES.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`btn btn-sm whitespace-nowrap ${activeTab === id ? "btn-neutral" : "btn-ghost"}`}
            onClick={() => { setActiveTab(id); setForm(null); }}
          >
            {label} <span className="badge badge-sm">{(captionOverlays[id] || []).length}</span>
          </button>
        ))}
      </div>

      {form && (
        <form onSubmit={save} className="mt-4 grid gap-3 rounded-lg border border-base-300 bg-base-100 p-4 md:grid-cols-2">
          <label className="form-control">
            <span className="label-text">ID caption</span>
            <input className="input input-bordered mt-1" value={form.presetId} disabled={Boolean(originalId)} onChange={(e) => setForm({ ...form, presetId: e.target.value })} placeholder="my_caption" />
          </label>
          <label className="form-control">
            <span className="label-text">Tên/nội dung mặc định</span>
            <input className="input input-bordered mt-1" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} />
          </label>
          <label className="form-control">
            <span className="label-text">Emoji hoặc URL icon</span>
            <input className="input input-bordered mt-1" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
          </label>
          <label className="form-control">
            <span className="label-text">Thứ tự</span>
            <input className="input input-bordered mt-1" type="number" value={form.order_index} onChange={(e) => setForm({ ...form, order_index: Number(e.target.value) })} />
          </label>
          <div className="grid grid-cols-3 gap-3 md:col-span-2">
            {[["color_top", "Màu trên"], ["color_bottom", "Màu dưới"], ["text_color", "Màu chữ"]].map(([key, label]) => (
              <label key={key} className="form-control">
                <span className="label-text">{label}</span>
                <input className="mt-1 h-11 w-full cursor-pointer rounded-md border border-base-300 bg-base-100 p-1" type="color" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              </label>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-3 md:col-span-2">
            <input type="checkbox" className="toggle toggle-success" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            <span className="text-sm font-medium">Hiển thị caption này</span>
          </label>
          <div className="flex justify-end gap-2 md:col-span-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm(null)}><X size={15} /> Huỷ</button>
            <button className="btn btn-primary btn-sm" disabled={saving}><Save size={15} /> {saving ? "Đang lưu..." : "Lưu"}</button>
          </div>
        </form>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && currentPresets.length === 0 ? (
          <div className="py-6 text-center opacity-60 sm:col-span-2 lg:col-span-3">Đang tải caption...</div>
        ) : currentPresets.length === 0 ? (
          <div className="py-6 text-center opacity-60 sm:col-span-2 lg:col-span-3">Chưa có caption trong nhóm này.</div>
        ) : currentPresets.map((preset) => {
          const presetId = preset.admin_id || preset.id || preset.preset_id || preset.overlay_id;
          const protectedPreset = PROTECTED_IDS.has(presetId) || PROTECTED_IDS.has(preset.overlay_id) || preset.type === "time";
          const colors = [preset.color_top || preset.background?.colors?.[0] || "#333333", preset.color_bottom || preset.background?.colors?.[1] || "#111111"];
          return (
            <div key={presetId} className={`flex items-center gap-2 rounded-lg border border-base-300 p-2 ${preset.active === false ? "opacity-45" : ""}`}>
              <div className="min-w-0 flex-1 rounded-md px-3 py-2 text-sm font-semibold" style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`, color: preset.text_color || "#FFFFFF" }}>
                <div className="truncate">{iconText(preset.icon) && !/^https?:\/\//i.test(iconText(preset.icon)) ? `${iconText(preset.icon)} ` : ""}{preset.caption || preset.preset_caption || preset.text || "Caption"}</div>
                <div className="truncate text-[10px] opacity-70">{presetId}</div>
              </div>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => startEdit(preset)} title="Sửa"><Edit2 size={14} /></button>
              <button type="button" className="btn btn-ghost btn-xs text-error" onClick={() => remove(preset)} disabled={protectedPreset} title={protectedPreset ? "Caption hệ thống không thể xoá" : "Xoá"}><Trash2 size={14} /></button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
