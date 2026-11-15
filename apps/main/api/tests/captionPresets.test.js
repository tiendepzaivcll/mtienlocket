const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyOverrides,
  normalizePreset,
  PROTECTED_PRESET_IDS,
} = require("../src/services/CaptionPreset/store");

const themes = [{
  section_id: "suggest",
  name: "Suggest",
  items: [{ overlay_id: "galaxy", caption: "Old", type: "custom", active: true }],
}];

test("caption presets validate identifiers and normalize colors", () => {
  const preset = normalizePreset({
    sectionId: "suggest",
    presetId: "my_caption",
    caption: " Hello ",
    color_top: "#aabbcc",
  });
  assert.equal(preset.caption, "Hello");
  assert.equal(preset.color_top, "#AABBCC");
  assert.equal(preset.overlayId, "my_caption");
  assert.throws(
    () => normalizePreset({ sectionId: "unknown", presetId: "x" }),
    /không hợp lệ/,
  );
  assert.throws(
    () => normalizePreset({ sectionId: "suggest", presetId: "bad id" }),
    /ID caption/,
  );
});

test("caption preset overrides preserve the functional overlay id of variants", () => {
  const result = applyOverrides([{
    section_id: "caption_icon_by_locketdio",
    items: [{ id: "holiday_christmas", overlay_id: "time", type: "time", text: "Old" }],
  }], [{
    sectionId: "image_icon",
    presetId: "holiday_christmas",
    overlayId: "time",
    caption: "Giáng sinh mới",
    type: "time",
  }]);
  assert.equal(result[0].items[0].id, "holiday_christmas");
  assert.equal(result[0].items[0].overlay_id, "time");
  assert.equal(result[0].items[0].caption, "Giáng sinh mới");
});

test("caption presets update, add and remove effective public themes", () => {
  const result = applyOverrides(themes, [
    {
      sectionId: "suggest",
      presetId: "galaxy",
      caption: "Updated",
      type: "custom",
      color_top: "#112233",
      color_bottom: "#445566",
      text_color: "#FFFFFF",
      order_index: 2,
    },
    {
      sectionId: "custome",
      presetId: "new_one",
      caption: "New",
      type: "custome",
      color_top: "#000000",
      color_bottom: "#111111",
      text_color: "#FFFFFF",
      order_index: 1,
    },
  ]);
  assert.equal(result[0].items[0].caption, "Updated");
  assert.equal(result.find((section) => section.section_id === "custome").items[0].overlay_id, "new_one");

  const deleted = applyOverrides(result, [{
    sectionId: "suggest",
    presetId: "galaxy",
    deleted: true,
  }]);
  assert.equal(deleted[0].items.length, 0);
});

test("system caption ids are protected from deletion", () => {
  assert.equal(PROTECTED_PRESET_IDS.has("caption:weather"), true);
  assert.equal(PROTECTED_PRESET_IDS.has("caption:poll"), true);
});

test("holiday is an admin-manageable caption section", () => {
  const preset = normalizePreset({
    sectionId: "holiday",
    presetId: "mid_autumn",
    caption: "Tết Trung Thu",
    type: "holiday",
  });
  assert.equal(preset.sectionId, "holiday");
  assert.equal(preset.type, "holiday");
});
