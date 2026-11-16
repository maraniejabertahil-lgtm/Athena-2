import test from "node:test";
import assert from "node:assert/strict";
import { addKnowledgeFile, searchKnowledge, listKnowledge, deleteKnowledge } from "../src/knowledge.js";
const userId = "11111111-1111-4111-8111-111111111111";
test("knowledge library adds, searches and deletes text per user", async()=>{
  const item=await addKnowledgeFile(userId,"test-note.txt","The blue whale is the largest animal on Earth.");
  assert.ok(item.id);
  const hits=await searchKnowledge("blue whale largest animal",5,userId);
  assert.ok(hits.length>0);
  assert.match(hits[0].text,/blue whale/);
  assert.ok((await listKnowledge(userId)).some(x=>x.id===item.id));
  assert.equal(await deleteKnowledge(userId,item.id),true);
});
test("knowledge library rejects unsupported file types", async()=>{
  await assert.rejects(()=>addKnowledgeFile(userId,"bad.exe","nope"),/Supported knowledge files/);
});
test("knowledge files are isolated by user", async()=>{
  const other="22222222-2222-4222-8222-222222222222";
  assert.deepEqual(await listKnowledge(other),[]);
});
test("rare matching words rank above common ones", async()=>{
  const id=(await addKnowledgeFile(userId,"rank-test.txt","Soil pH affects crop growth. Soil is common. Soil and water and light matter. Potassium deficiency shows yellow leaf edges.")).id;
  const hits=await searchKnowledge("potassium leaf",3,userId);
  assert.match(hits[0].text,/Potassium/);
  await deleteKnowledge(userId,id);
});
