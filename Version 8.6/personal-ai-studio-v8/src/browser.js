import { URL } from 'node:url';
function allowedHost(host, allowlist) { return allowlist.some(entry => host === entry || host.endsWith(`.${entry}`)); }
export async function inspectWebPage(rawUrl) {
  let url; try { url = new URL(rawUrl); } catch { throw new Error('Enter a valid web address.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Only public HTTPS pages are allowed.');
  const allowlist = (process.env.BROWSER_ALLOWED_DOMAINS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  if (!allowlist.length || !allowedHost(url.hostname.toLowerCase(), allowlist)) throw new Error('This website is not on BROWSER_ALLOWED_DOMAINS. Add trusted domains in .env first.');
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage({ javaScriptEnabled: true });
    page.setDefaultNavigationTimeout(10000);
    await page.route('**/*', route => { const u = new URL(route.request().url()); if (u.protocol !== 'https:' || !allowedHost(u.hostname.toLowerCase(), allowlist)) return route.abort(); return route.continue(); });
    const response = await page.goto(url.href, { waitUntil: 'domcontentloaded' });
    const result = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    return { url: page.url(), status: response?.status() ?? null, title: await page.title(), text: result.slice(0,15000) };
  } finally { await browser.close(); }
}
