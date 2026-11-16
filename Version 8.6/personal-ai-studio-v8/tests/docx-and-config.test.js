import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { docxToText, xmlToText } from "../src/docx-text.js";
import { configWarnings } from "../src/config-check.js";

test("reads text from a real .docx file", () => {
  const text = docxToText(fs.readFileSync("tests/fixtures/sample.docx"));
  assert.match(text, /Soil pH & crop health/);
  assert.match(text, /Potassium deficiency/);
});

test("rejects files that are not Word documents", () => {
  assert.throws(() => docxToText(Buffer.from("just plain text, not a zip")), /valid Word/);
});

test("xml entities and paragraphs are converted", () => {
  assert.equal(xmlToText("<w:p><w:t>a &lt; b</w:t></w:p><w:p><w:t>c</w:t></w:p>"), "a < b\nc");
});

test("config warnings name the missing setting", () => {
  const w = configWarnings({ provider: "openai-compatible", baseUrl: "", apiKey: "", model: "", sessionSecret: "short", autoRunCode: false, reasoningLevel: "off" });
  assert.ok(w.some(x => x.includes("AI_BASE_URL")));
  assert.ok(w.some(x => x.includes("SESSION_SECRET")));
  assert.equal(configWarnings({ provider: "anthropic", anthropicKey: "k", anthropicModel: "m", sessionSecret: "x".repeat(40), autoRunCode: false, reasoningLevel: "off" }).length, 0);
});
