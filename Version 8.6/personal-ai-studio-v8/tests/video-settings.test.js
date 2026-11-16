import test from "node:test";
import assert from "node:assert/strict";
import { videoSettings } from "../src/video-settings.js";

test("video settings default to 8 frames over 24 seconds", () => {
  assert.deepEqual(videoSettings({}), { frames: 8, seconds: 24, intervalSeconds: 3 });
});

test("video settings are read from env and clamped to safe limits", () => {
  assert.equal(videoSettings({ VIDEO_MAX_FRAMES: "16", VIDEO_MAX_SECONDS: "60" }).frames, 16);
  assert.equal(videoSettings({ VIDEO_MAX_FRAMES: "500" }).frames, 24);
  assert.equal(videoSettings({ VIDEO_MAX_SECONDS: "1" }).seconds, 3);
  assert.equal(videoSettings({ VIDEO_MAX_FRAMES: "abc" }).frames, 8);
});
