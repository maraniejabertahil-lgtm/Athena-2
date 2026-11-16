// Adds Run (JavaScript, in the Docker sandbox, after approval) and Preview (HTML) buttons to code blocks in assistant replies.
(function () {
  const messagesEl = document.querySelector("#messages");
  const promptEl = document.querySelector("#prompt");
  const formEl = document.querySelector("#chatForm");
  if (!messagesEl || !promptEl || !formEl) return;

  // Splits a reply into plain text parts and fenced code parts.
  function splitFences(text) {
    const parts = [];
    const re = /```([a-zA-Z0-9+-]*)\n([\s\S]*?)```/g;
    let last = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push({ type: "text", value: text.slice(last, m.index) });
      parts.push({ type: "code", lang: (m[1] || "").toLowerCase(), value: m[2].replace(/\n$/, "") });
      last = re.lastIndex;
    }
    if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
    return parts;
  }

  function button(label, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "small-button";
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  async function runCode(code, output, bar) {
    const ok = window.confirm("Run this JavaScript in the isolated sandbox?\n\nIt has no internet access and stops after 5 seconds. Only run code you understand.");
    if (!ok) return;
    output.hidden = false;
    output.textContent = "Running…";
    try {
      const response = await fetch("/api/code/run", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Approved": "true" },
        body: JSON.stringify({ code, language: "javascript" })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Run failed.");
      const res = data.result;
      output.textContent = `Exit code: ${res.exitCode}\n` +
        (res.stdout ? `Output:\n${res.stdout}` : "(no output)") +
        (res.stderr ? `\nErrors:\n${res.stderr}` : "");
      if (!bar.querySelector(".send-result")) {
        const send = button("Send result to assistant", () => {
          promptEl.value = `I ran the code. Here is the result:\n${output.textContent}\nPlease check it and tell me what to fix or confirm.`;
          formEl.requestSubmit();
        });
        send.classList.add("send-result");
        bar.append(send);
      }
    } catch (error) {
      output.textContent = `Not run: ${error.message}`;
    }
  }

  // Shows HTML in a sandboxed frame with no scripts, no storage and no network access.
  function togglePreview(html, wrap) {
    const existing = wrap.querySelector("iframe.html-preview");
    if (existing) { existing.remove(); return; }
    const frame = document.createElement("iframe");
    frame.className = "html-preview";
    frame.setAttribute("sandbox", "");
    frame.setAttribute("title", "Page preview");
    frame.style.cssText = "width:100%;min-height:260px;border:1px solid #ccc;border-radius:8px;background:#fff;margin-top:8px";
    frame.srcdoc = html;
    wrap.append(frame);
  }

  function codeBlock(part) {
    const wrap = document.createElement("div");
    wrap.className = "code-block";
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = part.value;
    pre.append(code);
    const bar = document.createElement("div");
    bar.className = "code-actions";
    const output = document.createElement("pre");
    output.className = "status-note";
    output.hidden = true;
    wrap.append(pre, bar, output);
    if (part.lang === "javascript" || part.lang === "js") {
      bar.append(button("▶ Run", () => runCode(part.value, output, bar)));
    }
    if (part.lang === "html") {
      bar.append(button("Preview", () => togglePreview(part.value, wrap)));
    }
    return wrap;
  }

  function enhance(node) {
    if (node.dataset.enhanced) return;
    node.dataset.enhanced = "1";
    const text = node.textContent;
    if (!text.includes("```")) return;
    const parts = splitFences(text);
    node.replaceChildren(...parts.map(p => p.type === "text" ? document.createTextNode(p.value) : codeBlock(p)));
  }

  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === 1 && node.classList.contains("assistant")) enhance(node);
      }
    }
  });
  observer.observe(messagesEl, { childList: true });
  messagesEl.querySelectorAll(".message.assistant").forEach(enhance);
})();
