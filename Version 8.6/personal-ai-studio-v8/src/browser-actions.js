// Approved browser steps. The user writes the steps and approves them before anything runs.
// Only HTTPS pages on BROWSER_ALLOWED_DOMAINS can be visited; passwords and payment fields are refused.
const MAX_STEPS = 12;
const SENSITIVE_CLICK = /(pay|checkout|purchase|buy now|place order|delete|remove account|transfer|send money|confirm order)/i;
const SENSITIVE_FIELD = /(password|passcode|pin|card|cvv|cvc|security code|social security|ssn|bank|account number|routing)/i;

function allowlist() {
  return (process.env.BROWSER_ALLOWED_DOMAINS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
}

export function checkUrl(rawUrl, domains = allowlist()) {
  let url;
  try { url = new URL(String(rawUrl || "")); } catch { throw new Error("Enter a valid web address starting with https://"); }
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Only public HTTPS pages are allowed.");
  const host = url.hostname.toLowerCase();
  if (!domains.length) throw new Error("No websites are allowed yet. Add trusted domains to BROWSER_ALLOWED_DOMAINS in .env first.");
  if (!domains.some(d => host === d || host.endsWith(`.${d}`))) throw new Error(`${host} is not on BROWSER_ALLOWED_DOMAINS.`);
  return url;
}

// Turns plain lines into steps:
//   go https://example.com
//   click Contact us
//   type Your name | Jane
//   read
export function parseSteps(text) {
  const lines = String(text || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) throw new Error("Write at least one step.");
  if (lines.length > MAX_STEPS) throw new Error(`Use at most ${MAX_STEPS} steps.`);
  const steps = lines.map(line => {
    const space = line.indexOf(" ");
    const verb = (space === -1 ? line : line.slice(0, space)).toLowerCase();
    const arg = space === -1 ? "" : line.slice(space + 1).trim();
    if (verb === "go") { if (!arg) throw new Error("'go' needs a web address."); return { action: "go", url: arg }; }
    if (verb === "click") {
      if (!arg) throw new Error("'click' needs the text of the button or link.");
      if (SENSITIVE_CLICK.test(arg)) throw new Error(`Clicking "${arg}" is blocked for safety (payments, orders and deletions are not automated).`);
      return { action: "click", text: arg };
    }
    if (verb === "type") {
      const bar = arg.indexOf("|");
      if (bar < 1) throw new Error("Use: type Field name | text to type");
      const label = arg.slice(0, bar).trim();
      if (SENSITIVE_FIELD.test(label)) throw new Error(`Typing into "${label}" is blocked for safety (passwords and payment details are never filled by the assistant).`);
      return { action: "type", label, value: arg.slice(bar + 1).trim() };
    }
    if (verb === "read") return { action: "read" };
    throw new Error(`Unknown step "${verb}". Use go, click, type or read.`);
  });
  if (steps[0].action !== "go") throw new Error("The first step must be 'go' with a web address.");
  return steps;
}

export async function runBrowserSteps(steps) {
  const domains = allowlist();
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const log = [];
  let lastText = "";
  try {
    const context = await browser.newContext({ acceptDownloads: false });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    page.setDefaultNavigationTimeout(10000);
    await page.route("**/*", route => {
      const u = new URL(route.request().url());
      if (u.protocol === "data:" || u.protocol === "blob:") return route.continue();
      const host = u.hostname.toLowerCase();
      if (u.protocol !== "https:" || !domains.some(d => host === d || host.endsWith(`.${d}`))) return route.abort();
      return route.continue();
    });
    for (const step of steps) {
      if (step.action === "go") {
        checkUrl(step.url, domains);
        await page.goto(step.url, { waitUntil: "domcontentloaded" });
        log.push(`Opened ${await page.title()}`);
      } else if (step.action === "click") {
        const target = page.getByRole("button", { name: step.text })
          .or(page.getByRole("link", { name: step.text }))
          .or(page.getByText(step.text)).first();
        await target.click();
        await page.waitForLoadState("domcontentloaded").catch(() => {});
        log.push(`Clicked "${step.text}"`);
      } else if (step.action === "type") {
        const field = page.getByLabel(step.label).or(page.getByPlaceholder(step.label)).first();
        const kind = ((await field.getAttribute("type")) || "").toLowerCase();
        if (kind === "password") throw new Error(`"${step.label}" is a password field and cannot be filled.`);
        await field.fill(step.value);
        log.push(`Typed into "${step.label}"`);
      } else if (step.action === "read") {
        lastText = (await page.locator("body").innerText({ timeout: 5000 }).catch(() => "")).slice(0, 4000);
        log.push("Read the page text");
      }
    }
    return { finalUrl: page.url(), title: await page.title(), log, text: lastText };
  } finally {
    await browser.close();
  }
}
