const form = document.querySelector("#chatForm");
const input = document.querySelector("#prompt");
const messagesEl = document.querySelector("#messages");
const welcome = document.querySelector("#welcome");
const send = document.querySelector("#send");
const STORAGE_KEY = "personal-ai-studio.chat.v2";
let history = [];

function saveHistory() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-200))); }
  catch { /* Private browsing or storage limits: chat still works for this tab. */ }
}
function addMessage(role, content) {
  welcome.hidden = true;
  const node = document.createElement("div");
  node.className = `message ${role}`;
  node.textContent = content;
  messagesEl.appendChild(node);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
function restoreHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(saved)) {
      history = saved.filter(m => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string").slice(-200);
      history.forEach(m => addMessage(m.role, m.content));
    }
  } catch { history = []; }
}
async function checkHealth() {
  try {
    const r = await fetch("/api/health"); const h = await r.json();
    document.querySelector("#providerStatus").textContent = h.configured ? "Engine connected" : "Engine needs setup";
    document.querySelector("#modelName").textContent = h.provider;
  } catch {
    document.querySelector("#providerStatus").textContent = "Server unavailable";
  }
}
form.addEventListener("submit", async e => {
  e.preventDefault();
  const text = input.value.trim(); if (!text) return;
  history.push({ role: "user", content: text }); saveHistory();
  addMessage("user", text); input.value = ""; send.disabled = true; send.textContent = "…";
  try {
    const r = await fetch("/api/chat", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({messages:history}) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Request failed");
    if (data.toolEvents?.length) {
      const names = [...new Set(data.toolEvents.map(t => t.name))].join(", ");
      addMessage("system", `Tools used: ${names}`);
    }
    const reply = typeof data.reply.content === "string" ? data.reply.content : JSON.stringify(data.reply.content);
    history.push({ role:"assistant", content:reply || "(Empty response)" }); saveHistory();
    addMessage("assistant", reply || "(Empty response)");
    speakText(reply, () => listenOnce());
  } catch(err) {
    const msg = `Connection error: ${err.message}`;
    history.push({ role:"assistant", content:msg }); saveHistory(); addMessage("assistant", msg); listenOnce();
  } finally { send.disabled = false; send.textContent = "Send ↑"; input.focus(); }
});
document.querySelector("#newChat").addEventListener("click", () => {
  history = []; saveHistory(); messagesEl.replaceChildren(); welcome.hidden = false; input.focus();
});
document.querySelectorAll(".suggestion").forEach(b => b.addEventListener("click", () => {
  input.value = b.textContent; input.focus();
}));
restoreHistory();
checkHealth();

// User-controlled persistent memory.
const memoryForm = document.querySelector('#memoryForm');
const memoryText = document.querySelector('#memoryText');
const memoryList = document.querySelector('#memoryList');
async function refreshMemories() {
  try {
    const response = await fetch('/api/memories'); const items = await response.json();
    memoryList.replaceChildren();
    for (const item of items) {
      const row = document.createElement('div'); row.className = 'memory-item';
      const label = document.createElement('span'); label.textContent = item.text;
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Delete';
      remove.addEventListener('click', async () => { await fetch(`/api/memories/${encodeURIComponent(item.id)}`, { method: 'DELETE' }); refreshMemories(); });
      row.append(label, remove); memoryList.append(row);
    }
    if (!items.length) memoryList.textContent = 'No saved memory notes yet.';
  } catch { memoryList.textContent = 'Could not load memory notes.'; }
}
memoryForm?.addEventListener('submit', async e => {
  e.preventDefault(); const text = memoryText.value.trim(); if (!text) return;
  const response = await fetch('/api/memories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  const data = await response.json();
  if (!response.ok) { alert(data.error || 'Could not save memory.'); return; }
  memoryText.value = ''; refreshMemories();
});

// File writes always require a clear user confirmation in the browser.
const writeForm = document.querySelector('#writeForm');
writeForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const path = document.querySelector('#writePath').value.trim();
  const content = document.querySelector('#writeContent').value;
  const ok = window.confirm(`Approve writing this file?\n\nFile: ${path}\n\nThe contents will replace any existing file with this name inside the workspace.`);
  if (!ok) return;
  const status = document.querySelector('#approvalStatus'); status.textContent = 'Saving…';
  try {
    const response = await fetch('/api/approvals/write', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-User-Approved': 'true' }, body: JSON.stringify({ path, content }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Write failed.');
    status.textContent = `Saved ${data.result.path} (${data.result.bytes} bytes).`;
  } catch (error) { status.textContent = `Not saved: ${error.message}`; }
});
refreshMemories();


// Knowledge base management
const knowledgeForm = document.querySelector("#knowledgeForm");
const knowledgeFile = document.querySelector("#knowledgeFile");
const knowledgeList = document.querySelector("#knowledgeList");
async function refreshKnowledge(){
  if(!knowledgeList) return;
  const items=await fetch("/api/knowledge").then(r=>r.json()).catch(()=>[]);
  knowledgeList.replaceChildren();
  for(const item of items){const row=document.createElement("div");row.className="memory-item";const label=document.createElement("span");label.textContent=`${item.name} · ${item.chunkCount} sections`;const del=document.createElement("button");del.textContent="Remove";del.addEventListener("click",async()=>{await fetch(`/api/knowledge/${encodeURIComponent(item.id)}`,{method:"DELETE"});refreshKnowledge();});row.append(label,del);knowledgeList.append(row);}
}
knowledgeForm?.addEventListener("submit",async e=>{e.preventDefault();const file=knowledgeFile.files?.[0];if(!file)return; if(file.size>1_000_000){alert("Please choose a file under 1 MB.");return;}const isWord=file.name.toLowerCase().endsWith(".docx");if(isWord&&file.size>3000000){alert("Please choose a Word file under 3 MB.");return;}const content=isWord?await fileToBase64(file):await file.text();const r=await fetch("/api/knowledge",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:file.name,content})});const data=await r.json();if(!r.ok){alert(data.error||"Could not add file.");return;}knowledgeForm.reset();refreshKnowledge();});
refreshKnowledge();

// Optional browser speech-to-text. Availability depends on the browser and device.
const voiceButton=document.querySelector("#voiceInput");
voiceButton?.addEventListener("click",()=>{const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SpeechRecognition){alert("Voice input is not supported in this browser. Try a recent Chrome-based browser.");return;}const recognition=new SpeechRecognition();recognition.lang=navigator.language||"en-US";recognition.interimResults=false;recognition.onresult=e=>{const box=document.querySelector("#prompt");box.value+=(box.value?" ":"")+e.results[0][0].transcript;box.focus();};recognition.onerror=()=>alert("Voice input could not be completed.");recognition.start();});

// Account gate: only the first account can be registered; later signups are closed.
const authGate = document.querySelector('#authGate');
const authForm = document.querySelector('#authForm');
let registerMode = false;
async function initialiseAuth() {
  const status = await fetch('/api/auth/status').then(r=>r.json()).catch(()=>({setupRequired:true}));
  if (status.setupRequired) { authGate.hidden=false; document.querySelector('#authTitle').textContent='Set up your studio first'; document.querySelector('#authHelp').textContent='Add a random SESSION_SECRET (32+ characters) to .env, then restart the server.'; document.querySelector('#authSubmit').disabled=true; return; }
  const me = await fetch('/api/auth/me');
  if (me.ok) { authGate.hidden=true; return; }
  registerMode = status.registrationOpen;
  document.querySelector('#authTitle').textContent=registerMode?'Create your owner account':'Sign in to your studio';
  document.querySelector('#authHelp').textContent=registerMode?'This creates the first account. Use a password with at least 12 characters.':'Your saved memory is private to your account.';
  document.querySelector('#authSubmit').textContent=registerMode?'Create account':'Sign in';
  authGate.hidden=false;
}
authForm?.addEventListener('submit', async e=>{e.preventDefault();const error=document.querySelector('#authError');error.textContent='';const endpoint=registerMode?'/api/auth/register':'/api/auth/login';const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.querySelector('#authEmail').value,password:document.querySelector('#authPassword').value})});const data=await r.json();if(!r.ok){error.textContent=data.error||'Could not sign in.';return;}authGate.hidden=true;refreshMemories();refreshKnowledge();});
document.querySelector('#logoutButton')?.addEventListener('click',async()=>{await fetch('/api/auth/logout',{method:'POST'});location.reload();});
initialiseAuth();

// High-risk actions require a browser confirmation and server-side policy checks.
document.querySelector('#browserForm')?.addEventListener('submit',async e=>{e.preventDefault();const url=document.querySelector('#browserUrl').value;if(!confirm(`Approve reading the visible text of this page?\n${url}`))return;const out=document.querySelector('#browserResult');out.textContent='Inspecting…';const r=await fetch('/api/browser/inspect',{method:'POST',headers:{'Content-Type':'application/json','X-User-Approved':'true'},body:JSON.stringify({url})});const d=await r.json();out.textContent=r.ok?JSON.stringify(d.result,null,2):d.error;});
document.querySelector('#codeForm')?.addEventListener('submit',async e=>{e.preventDefault();const code=document.querySelector('#codeInput').value;if(!confirm('Approve running this JavaScript inside the isolated Docker sandbox?'))return;const out=document.querySelector('#codeResult');out.textContent='Running…';const r=await fetch('/api/code/run',{method:'POST',headers:{'Content-Type':'application/json','X-User-Approved':'true'},body:JSON.stringify({code,language:'javascript'})});const d=await r.json();out.textContent=r.ok?JSON.stringify(d.result,null,2):d.error;});


// Media tools: uploads are encoded locally, then sent to the signed-in server session.
async function asDataUrl(file){return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Could not read that file.'));r.readAsDataURL(file);});}
const imageUnderstandForm=document.querySelector('#imageUnderstandForm');
imageUnderstandForm?.addEventListener('submit',async e=>{e.preventDefault();const file=document.querySelector('#imageUnderstandFile').files?.[0];if(!file)return;if(file.size>8*1024*1024){alert('Image must be smaller than 8 MB.');return;}const out=document.querySelector('#imageUnderstandResult');out.textContent='Looking at image…';try{const dataUrl=await asDataUrl(file);const r=await fetch('/api/media/image/understand',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dataUrl,prompt:document.querySelector('#imageQuestion').value})});const d=await r.json();if(!r.ok)throw new Error(d.error);out.textContent=d.description;}catch(err){out.textContent=`Could not understand image: ${err.message}`;}});
const imageGenerateForm=document.querySelector('#imageGenerateForm');
imageGenerateForm?.addEventListener('submit',async e=>{e.preventDefault();const prompt=document.querySelector('#imagePrompt').value;if(!confirm('Approve sending this prompt to your configured image provider to create an image?'))return;const out=document.querySelector('#imageGenerateResult');out.textContent='Creating image…';try{const r=await fetch('/api/media/image/generate',{method:'POST',headers:{'Content-Type':'application/json','X-User-Approved':'true'},body:JSON.stringify({prompt})});const d=await r.json();if(!r.ok)throw new Error(d.error);out.replaceChildren();const img=document.createElement('img');img.src=d.image;img.alt='AI-generated image';img.style.maxWidth='100%';img.style.borderRadius='12px';out.append(img);if(d.revisedPrompt){const p=document.createElement('p');p.textContent=`Provider prompt: ${d.revisedPrompt}`;out.append(p);}}catch(err){out.textContent=`Could not create image: ${err.message}`;}});
const videoUnderstandForm=document.querySelector('#videoUnderstandForm');
videoUnderstandForm?.addEventListener('submit',async e=>{e.preventDefault();const file=document.querySelector('#videoFile').files?.[0];if(!file)return;if(file.size>20*1024*1024){alert('Video must be smaller than 20 MB.');return;}const out=document.querySelector('#videoUnderstandResult');out.textContent='Sampling video frames…';try{const dataUrl=await asDataUrl(file);const r=await fetch('/api/media/video/understand',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dataUrl,prompt:document.querySelector('#videoQuestion').value})});const d=await r.json();if(!r.ok)throw new Error(d.error);out.textContent=`${d.summary}\n\nFrames checked: ${d.framesAnalyzed}. ${d.note}`;}catch(err){out.textContent=`Could not understand video: ${err.message}`;}});

// Spoken replies using the browser's built-in voice. Off by default; the choice is remembered.
const SPEAK_KEY = "personal-ai-studio.speak";
const speakButton = document.querySelector("#speakToggle");
let speakReplies = false;
try { speakReplies = localStorage.getItem(SPEAK_KEY) === "on"; } catch { /* storage unavailable */ }
function paintSpeakButton() {
  if (!speakButton) return;
  speakButton.textContent = speakReplies ? "🔊" : "🔇";
  speakButton.setAttribute("aria-pressed", String(speakReplies));
  speakButton.title = speakReplies ? "Spoken replies: on" : "Spoken replies: off";
}
function speakText(text, onDone = () => {}) {
  if (!speakReplies || !("speechSynthesis" in window)) return onDone();
  window.speechSynthesis.cancel();
  const plain = String(text || "").replace(/[*#`_>]/g, "").slice(0, 4000);
  const utterance = new SpeechSynthesisUtterance(plain);
  utterance.lang = navigator.language || "en-US";
  utterance.rate = 1;
  utterance.onend = () => onDone();
  utterance.onerror = () => onDone();
  window.speechSynthesis.speak(utterance);
}
speakButton?.addEventListener("click", () => {
  speakReplies = !speakReplies;
  try { localStorage.setItem(SPEAK_KEY, speakReplies ? "on" : "off"); } catch { /* storage unavailable */ }
  if (!speakReplies && "speechSynthesis" in window) window.speechSynthesis.cancel();
  paintSpeakButton();
});
paintSpeakButton();

// Approved browser steps: the user reviews the exact steps before anything runs.
const browserForm = document.querySelector("#browserForm");
browserForm?.addEventListener("submit", async e => {
  e.preventDefault();
  const steps = document.querySelector("#browserSteps").value;
  const out = document.querySelector("#browserResult");
  const ok = window.confirm(`Run these browser steps?\n\n${steps}\n\nOnly allowed websites will be visited. Nothing is paid, ordered or deleted.`);
  if (!ok) return;
  out.textContent = "Running steps…";
  try {
    const response = await fetch("/api/browser/act", { method: "POST", headers: { "Content-Type": "application/json", "X-User-Approved": "true" }, body: JSON.stringify({ steps }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Browser steps failed.");
    const r = data.result;
    out.textContent = `${r.log.join("\n")}\n\nFinal page: ${r.title} (${r.finalUrl})\n\n${r.text || ""}`.trim();
  } catch (error) { out.textContent = `Not completed: ${error.message}`; }
});

// Hands-free conversation: listen, send what you said, read the reply aloud, then listen again.
const HANDS_KEY = "personal-ai-studio.handsfree";
const handsFreeButton = document.querySelector("#handsFreeToggle");
let handsFree = false;
let activeRecognition = null;
function paintHandsFree() {
  if (!handsFreeButton) return;
  handsFreeButton.setAttribute("aria-pressed", String(handsFree));
  handsFreeButton.title = handsFree ? "Hands-free: on (listening after each reply)" : "Hands-free: off";
  handsFreeButton.style.opacity = handsFree ? "1" : "0.5";
}
function listenOnce() {
  if (!handsFree || activeRecognition) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { handsFree = false; paintHandsFree(); alert("Hands-free needs a Chrome-based browser with voice input."); return; }
  const rec = new SR();
  rec.lang = navigator.language || "en-US";
  rec.interimResults = false;
  rec.continuous = false;
  activeRecognition = rec;
  let heard = false;
  rec.onresult = e => {
    heard = true;
    const said = e.results[0][0].transcript.trim();
    if (said && handsFree) { input.value = said; form.requestSubmit(); }
  };
  rec.onerror = e => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      handsFree = false; paintHandsFree();
      alert("Microphone access was refused, so hands-free was turned off.");
    }
  };
  rec.onend = () => {
    activeRecognition = null;
    if (handsFree && !heard) setTimeout(listenOnce, 500);
  };
  try { rec.start(); } catch { activeRecognition = null; }
}
handsFreeButton?.addEventListener("click", () => {
  handsFree = !handsFree;
  try { localStorage.setItem(HANDS_KEY, handsFree ? "on" : "off"); } catch { /* storage unavailable */ }
  if (!handsFree && activeRecognition) { activeRecognition.abort(); activeRecognition = null; }
  paintHandsFree();
  if (handsFree && !input.value) listenOnce();
});
try { handsFree = localStorage.getItem(HANDS_KEY) === "on"; } catch { /* storage unavailable */ }
paintHandsFree();

function fileToBase64(file) {
  return file.arrayBuffer().then(buffer => {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  });
}
