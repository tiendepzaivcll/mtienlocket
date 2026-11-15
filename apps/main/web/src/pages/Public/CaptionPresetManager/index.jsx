import React, { useState, useEffect } from "react";
import { Trash2, Edit2, Plus, Save, X } from "lucide-react";
import { Toaster, toast } from "sonner";
import { useOverlayStore } from "@/stores";
import "./styles.css";

const CaptionPresetManager = () => {
  // Get store functions for CRUD operations
  const { updateCaptionOverlay, deleteCaptionOverlay, addCaptionOverlay, fetchCaptionOverlays, captionOverlays } = useOverlayStore();

  const STORAGE_KEY = "captionPresets";
  const CAPTION_TYPES = [
    { id: "suggest", label: "💬 Gợi ý" },
    { id: "decorative", label: "🎨 Trang trí" },
    { id: "custome", label: "✏️ Tùy chỉnh" },
    { id: "background", label: "🎭 Nền" },
    { id: "image_icon", label: "✨ Icon" },
    { id: "image_gif", label: "🎬 GIF" },
    { id: "special", label: "🌟 Đặc biệt" },
  ];

  const [editingId, setEditingId] = useState(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const [activeTab, setActiveTab] = useState("suggest");
  const [formData, setFormData] = useState({
    preset_id: "",
    caption: "",
    color_top: "#000000",
    color_bottom: "#000000",
    text_color: "#FFFFFF",
    icon: "✨",
    type: "suggest",
  });

  // Load captions from store on mount
  useEffect(() => {
    fetchCaptionOverlays();
  }, [fetchCaptionOverlays]);

  // Helper to extract icon string from object or string
  const getIconString = (icon) => {
    if (!icon) return "✨";
    if (typeof icon === "string") return icon;
    if (typeof icon === "object" && icon.data) return icon.data;
    return "✨";
  };

  // Helper to check if icon is an image URL
  const isImageUrl = (icon) => {
    if (!icon) return false;
    const str = getIconString(icon);
    return /^https?:\/\/.+\.(gif|png|jpg|jpeg|webp|svg)/.test(str.toLowerCase());
  };

  // Helper to get display icon - if URL, show generic icon; otherwise show the icon
  const getDisplayIcon = (icon) => {
    const iconStr = getIconString(icon);
    if (isImageUrl(icon)) {
      return "🖼️"; // Show image icon for URLs
    }
    return iconStr;
  };

  // Function to toggle debug panel
  const toggleDebugPanel = () => {
    setDebugInfo({
      store: captionOverlays,
      currentState: captionOverlays,
    });
  };

  // Add sample data for testing

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      preset_id: "",
      caption: "",
      color_top: "#000000",
      color_bottom: "#000000",
      text_color: "#FFFFFF",
      icon: "✨",
      type: activeTab,
    });
    setEditingId(null);
    setIsAddingNew(false);
  };

  // Handle add new preset
  const handleAddNew = () => {
    setIsAddingNew(true);
    setEditingId(null);
    setFormData({
      preset_id: "",
      caption: "",
      color_top: "#000000",
      color_bottom: "#000000",
      text_color: "#FFFFFF",
      icon: "✨",
      type: activeTab,
    });
  };

  // Handle edit preset
  const handleEdit = (preset) => {
    setEditingId(preset.preset_id);
    setIsAddingNew(false);
    setFormData({
      preset_id: preset.preset_id,
      caption: preset.caption || preset.preset_caption || "",
      color_top: preset.color_top || "#000000",
      color_bottom: preset.color_bottom || "#000000",
      text_color: preset.text_color || "#FFFFFF",
      icon: getIconString(preset.icon),
      type: activeTab,
    });
  };

  // Handle save preset
  const handleSavePreset = () => {
    if (!formData.preset_id.trim()) {
      toast.error("⚠️ Vui lòng nhập ID preset");
      return;
    }

    if (isAddingNew) {
      // Check if preset_id already exists in this type
      const exists = captionOverlays[activeTab]?.some(
        (p) => p.preset_id === formData.preset_id
      );
      if (exists) {
        toast.error("⚠️ ID preset này đã tồn tại");
        return;
      }
      
      // Add to store (which also syncs to localStorage)
      const success = addCaptionOverlay(activeTab, {
        ...formData,
        type: activeTab,
      });
      
      if (success) {
        toast.success("✅ Thêm preset mới thành công");
      } else {
        toast.error("❌ Lỗi thêm preset");
        return;
      }
    } else {
      // Edit existing - update store
      const captionToUpdate = {
        ...formData,
        type: activeTab,
      };
      updateCaptionOverlay(activeTab, editingId, captionToUpdate);
      toast.success("✅ Cập nhật preset thành công");
    }

    resetForm();
  };

  // Handle delete preset
  const handleDelete = (presetId) => {
    if (
      window.confirm(
        `Bạn có chắc muốn xoá preset này?\n\nPreset ID: ${presetId}`
      )
    ) {
      // Delete from store (which also updates localStorage)
      deleteCaptionOverlay(activeTab, presetId);
      toast.success("🗑️ Đã xoá preset");
    }
  };

  const currentPresets = captionOverlays[activeTab] || [];
  const activeTabObj = CAPTION_TYPES.find((t) => t.id === activeTab);

  return (
    <>
      <Toaster position="top-right" />
      <div className="caption-preset-manager-container">
      <div className="preset-header">
        <h1>📋 Quản lý Caption Preset</h1>
        <p>Xem, sửa, xoá và thêm mới các preset caption của bạn</p>
        <button 
          onClick={toggleDebugPanel}
          style={{
            marginTop: "1rem",
            padding: "0.5rem 1rem",
            background: "rgba(255,255,255,0.2)",
            border: "1px solid white",
            color: "white",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "0.9rem",
          }}
        >
          🔍 {debugInfo ? "Ẩn Debug" : "Hiện Debug"}
        </button>
      </div>

      {/* Debug Panel */}
      {debugInfo && (
        <div style={{
          maxWidth: "1200px",
          margin: "0 auto 2rem",
          background: "white",
          border: "2px solid #f59e0b",
          borderRadius: "12px",
          padding: "1.5rem",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}>
          <h3 style={{ margin: "0 0 1rem", color: "#f59e0b" }}>🔧 DEBUG INFO</h3>
          
          <div style={{ marginBottom: "1rem", display: "flex", gap: "1rem" }}>
            <button
              onClick={() => {
                localStorage.clear();
                toast.success("🗑️ Đã xoá hết localStorage!");
                window.location.reload();
              }}
              style={{
                padding: "0.75rem 1.5rem",
                background: "#ef4444",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              🗑️ Xoá localStorage
            </button>
          </div>
          
          <div style={{ marginBottom: "1rem" }}>
            <h4 style={{ margin: "0 0 0.5rem", color: "#333" }}>🏪 Zustand Store Data (📦 useOverlayStore):</h4>
            <pre style={{
              background: "#f3f4f6",
              padding: "1rem",
              borderRadius: "8px",
              overflow: "auto",
              maxHeight: "300px",
              fontSize: "0.85rem",
              fontFamily: "monospace",
            }}>
              {JSON.stringify(debugInfo.store, null, 2) || "NULL"}
            </pre>
          </div>

          <div>
            <h4 style={{ margin: "0 0 0.5rem", color: "#333" }}>🎨 Current State (presets):</h4>
            <pre style={{
              background: "#f3f4f6",
              padding: "1rem",
              borderRadius: "8px",
              overflow: "auto",
              maxHeight: "300px",
              fontSize: "0.85rem",
              fontFamily: "monospace",
            }}>
              {JSON.stringify(debugInfo.currentState, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="preset-tabs">
        {CAPTION_TYPES.map((type) => (
          <button
            key={type.id}
            className={`tab-button ${activeTab === type.id ? "active" : ""}`}
            onClick={() => {
              setActiveTab(type.id);
              resetForm();
            }}
          >
            {type.label}
            <span className="badge">{(captionOverlays[type.id] || []).length}</span>
          </button>
        ))}
      </div>

      <div className="preset-content">
        {/* Add New Button */}
        <button className="btn-add-new" onClick={handleAddNew}>
          <Plus size={20} />
          Thêm Preset Mới
        </button>

        {/* Form - Add/Edit */}
        {(isAddingNew || editingId) && (
          <div className="preset-form">
            <h3>{isAddingNew ? "➕ Thêm Preset Mới" : "✏️ Chỉnh Sửa Preset"}</h3>

            <div className="form-group">
              <label htmlFor="preset_id">ID Preset *</label>
              <input
                id="preset_id"
                type="text"
                name="preset_id"
                value={formData.preset_id}
                onChange={handleInputChange}
                placeholder="Ví dụ: my_custom_caption"
                disabled={editingId !== null}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="caption">Tên hiển thị</label>
                <input
                  id="caption"
                  type="text"
                  name="caption"
                  value={formData.caption}
                  onChange={handleInputChange}
                  placeholder="Ví dụ: My Special Caption"
                />
              </div>

              <div className="form-group">
                <label htmlFor="icon">Icon/Emoji</label>
                <input
                  id="icon"
                  type="text"
                  name="icon"
                  value={formData.icon}
                  onChange={handleInputChange}
                  placeholder="✨"
                  maxLength="2"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="color_top">Màu Gradient Trên</label>
                <div className="color-input-wrapper">
                  <input
                    id="color_top"
                    type="color"
                    name="color_top"
                    value={formData.color_top}
                    onChange={handleInputChange}
                  />
                  <input
                    type="text"
                    value={formData.color_top}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        color_top: e.target.value,
                      }))
                    }
                    placeholder="#000000"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="color_bottom">Màu Gradient Dưới</label>
                <div className="color-input-wrapper">
                  <input
                    id="color_bottom"
                    type="color"
                    name="color_bottom"
                    value={formData.color_bottom}
                    onChange={handleInputChange}
                  />
                  <input
                    type="text"
                    value={formData.color_bottom}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        color_bottom: e.target.value,
                      }))
                    }
                    placeholder="#000000"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="text_color">Màu Chữ</label>
                <div className="color-input-wrapper">
                  <input
                    id="text_color"
                    type="color"
                    name="text_color"
                    value={formData.text_color}
                    onChange={handleInputChange}
                  />
                  <input
                    type="text"
                    value={formData.text_color}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        text_color: e.target.value,
                      }))
                    }
                    placeholder="#FFFFFF"
                  />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="form-preview">
              <h4>Xem trước</h4>
              <div
                className="preview-box"
                style={{
                  background: `linear-gradient(135deg, ${formData.color_top} 0%, ${formData.color_bottom} 100%)`,
                  color: formData.text_color,
                }}
              >
                {isImageUrl(formData.icon) ? (
                  <>
                    <img src={getIconString(formData.icon)} alt="preview" className="preview-icon-image" />
                    <span className="preview-text">
                      {formData.caption || "Preview"}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="preview-icon">{getIconString(formData.icon)}</span>
                    <span className="preview-text">
                      {formData.caption || "Preview"}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Form Actions */}
            <div className="form-actions">
              <button
                className="btn-save"
                onClick={handleSavePreset}
              >
                <Save size={18} />
                Lưu
              </button>
              <button className="btn-cancel" onClick={resetForm}>
                <X size={18} />
                Huỷ
              </button>
            </div>
          </div>
        )}

        {/* Presets List */}
        <div className="presets-list">
          {currentPresets.length === 0 ? (
            <div className="empty-state">
              <p>📭 Không có preset {activeTabObj?.label.toLowerCase()}</p>
              <p>Nhấn "Thêm Preset Mới" để tạo preset đầu tiên</p>
            </div>
          ) : (
            <div className="presets-buttons-wrap">
              {currentPresets.map((preset) => (
                <div
                  key={preset.preset_id}
                  className="preset-button-group"
                >
                  <button
                    className="preset-button"
                    style={{
                      background: `linear-gradient(to bottom, ${preset.color_top || "#000000"}, ${preset.color_bottom || "#000000"})`,
                      color: preset.text_color || "#FFFFFF",
                    }}
                    title={preset.preset_id}
                  >
                    {isImageUrl(preset.icon) ? (
                      <>
                        <img src={getIconString(preset.icon)} alt="preview" className="preset-button-image" />
                        {preset.caption || "Caption"}
                      </>
                    ) : (
                      <>{getDisplayIcon(preset.icon)} {preset.caption || "Caption"}</>
                    )}
                  </button>
                  <div className="preset-button-actions">
                    <button
                      className="btn-edit-small"
                      onClick={() => handleEdit(preset)}
                      title="Chỉnh sửa"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      className="btn-delete-small"
                      onClick={() => handleDelete(preset.preset_id)}
                      title="Xoá"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
};

export default CaptionPresetManager;
