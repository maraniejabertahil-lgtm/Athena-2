import test from "node:test";
import assert from "node:assert/strict";
import { modelToolDescriptions, runTool } from "../src/tools/registry.js";

test("automatic model tools are read-only", () => {
  const names = modelToolDescriptions().map(item => item.function.name);
  assert.deepEqual(names, ["search_web", "search_knowledge", "get_current_time", "list_workspace", "read_workspace_file", "list_skills", "load_skill"]);
  assert.equal(names.includes("write_workspace_file"), false);
});

test("file writing needs approval", async () => {
  await assert.rejects(
    runTool("write_workspace_file", { path: "test.txt", content: "no" }, false),
    /approval/
  );
});

test("workspace traversal is blocked", async () => {
  await assert.rejects(runTool("list_workspace", { path: "../../" }), /outside the approved workspace/);
});
