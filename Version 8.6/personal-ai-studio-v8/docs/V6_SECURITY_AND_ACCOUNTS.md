# Version 6 — Accounts, browser inspection and code sandbox

## Accounts and private memory

- The first account is created through the sign-up screen. Registration closes after that first account; this starter does not include an admin user-management screen.
- Passwords are hashed with Node.js scrypt and a per-user random salt.
- Sessions are random, stored in an HttpOnly, SameSite=Strict cookie, and expire after seven days. Sessions are held in server memory and are cleared on restart.
- Memory and knowledge files are separated by user ID and written with restrictive local file permissions.
- Set `SESSION_SECRET` to at least 32 random characters. Generate one with `openssl rand -hex 32`.
- Set `COOKIE_SECURE=true` when served over HTTPS. Do not expose this development server directly to the public internet.

## Browser inspection

- This is deliberately limited page inspection, not unrestricted browser automation. It reads visible page text and title; it does not click, submit forms, download files, or log into websites.
- Install Chromium using `npx playwright install chromium`.
- Set `BROWSER_ALLOWED_DOMAINS` to a comma-separated list of trusted hostnames. The tool blocks non-HTTPS pages and navigation outside the allowlist.
- Each inspection requires a user confirmation in the UI.
- Browser inspection is not a perfect SSRF defense. Use a separate isolated host/container and a strict outbound network policy before any public deployment.

## Code execution

- JavaScript runs only inside Docker. There is no fallback to host execution.
- The container has no network, a read-only root filesystem, low memory/CPU, a PID limit, dropped Linux capabilities, and a five-second timeout.
- The `node:22-alpine` image must be available locally or Docker must be allowed to pull it.
- Each execution requires a user confirmation. Do not expose this endpoint to untrusted users without further isolation and quotas.

## Still not production-ready

This starter has no email verification, password reset, MFA, account administration, persistent session store, database migrations, audit log, CSRF token framework, reverse-proxy hardening, or formal security audit. The first-account registration lock is not a substitute for an administrator invitation workflow. MCP servers remain trusted integrations and can have their own permissions and risks.
