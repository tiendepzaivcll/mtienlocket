import test from "node:test";
import assert from "node:assert/strict";
import { shouldHideNavigationDock } from "../src/pages/LocketCameraBeta/Layout/navigationDockVisibility.js";

test("navigation dock stays hidden while a media crop editor is open", () => {
  assert.equal(shouldHideNavigationDock({ imageToCrop: "blob:image" }), true);
  assert.equal(shouldHideNavigationDock({ videoCrop: "blob:video" }), true);
});

test("navigation dock returns when no editor or media selection is active", () => {
  assert.equal(shouldHideNavigationDock(), false);
  assert.equal(
    shouldHideNavigationDock({
      selectedFile: null,
      selectedQueue: null,
      imageToCrop: null,
      videoCrop: null,
    }),
    false,
  );
});
