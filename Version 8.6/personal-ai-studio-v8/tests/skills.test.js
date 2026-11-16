import test from "node:test";
import assert from "node:assert/strict";
import { parseFrontmatter, listSkills, readSkill } from "../src/skills.js";

test("frontmatter reads plain, quoted and folded values", () => {
  const { meta, body } = parseFrontmatter("---\r\nname: demo\r\ndescription: >\r\n  first line\r\n  second line\r\nnote: 'it''s fine'\r\n---\r\nBody text");
  assert.equal(meta.name, "demo");
  assert.equal(meta.description, "first line second line");
  assert.equal(meta.note, "it's fine");
  assert.equal(body, "Body text");
});

test("skills library loads the bundled skills", async () => {
  const list = await listSkills();
  assert.ok(list.length > 0);
  assert.ok(list.every(s => s.id && s.name));
});

test("unknown skill is refused with a clear message", async () => {
  await assert.rejects(readSkill("no-such-skill-xyz"), /No skill matches/);
});
