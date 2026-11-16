import test from "node:test";
import assert from "node:assert/strict";
import { checkUrl, parseSteps } from "../src/browser-actions.js";

test("only https pages on allowed domains pass", () => {
  assert.equal(checkUrl("https://www.example.com/page", ["example.com"]).hostname, "www.example.com");
  assert.throws(() => checkUrl("http://example.com", ["example.com"]), /Only public HTTPS/);
  assert.throws(() => checkUrl("https://evil.com", ["example.com"]), /not on BROWSER_ALLOWED_DOMAINS/);
  assert.throws(() => checkUrl("https://user:pw@example.com", ["example.com"]), /Only public HTTPS/);
  assert.throws(() => checkUrl("https://example.com", []), /No websites are allowed/);
});

test("steps parse from plain lines", () => {
  const steps = parseSteps("go https://example.com\nclick Contact us\ntype Your name | Jane\nread");
  assert.deepEqual(steps.map(s => s.action), ["go", "click", "type", "read"]);
  assert.equal(steps[2].label, "Your name");
  assert.equal(steps[2].value, "Jane");
});

test("risky steps are refused", () => {
  assert.throws(() => parseSteps("go https://example.com\nclick Pay now"), /blocked for safety/);
  assert.throws(() => parseSteps("go https://example.com\ntype Password | secret"), /blocked for safety/);
  assert.throws(() => parseSteps("click Contact"), /first step must be 'go'/);
  assert.throws(() => parseSteps("go https://example.com\nfly away"), /Unknown step/);
  assert.throws(() => parseSteps("go https://example.com\ntype no bar here"), /Use: type/);
});
