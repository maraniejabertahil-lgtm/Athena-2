# Personal AI Studio — Version 6

A local-first, model-independent AI assistant starter. The Skills Library is intentionally empty and is not loaded or executed.

## Requirements
- Node.js 20+
- An OpenAI-compatible API or Anthropic API key and model
- Docker for the optional code sandbox
- Playwright Chromium for optional browser page inspection

## Setup
1. Unzip the project and open its folder.
2. Copy `.env.example` to `.env`.
3. Configure your AI provider.
4. Set `SESSION_SECRET` to a random value of at least 32 characters (`openssl rand -hex 32`).
5. Run `npm install`.
6. For browser inspection, run `npx playwright install chromium` and set `BROWSER_ALLOWED_DOMAINS` to trusted hosts.
7. For code execution, install Docker and make sure `node:22-alpine` is available.
8. Run `npm start` and open `http://localhost:3000`.
9. Create the first owner account. Further public registration is closed.

## Version 6 features
- Account sign-in; password hashes use scrypt.
- HttpOnly, SameSite session cookie.
- Per-account saved memory and per-account knowledge libraries.
- Existing model provider adapters, tool use, knowledge library and MCP connectors.
- Approval-gated browser page inspection restricted to an explicit domain allowlist.
- Approval-gated JavaScript sandbox using Docker with no network access and resource limits.
- Skills Library remains empty and disabled.

## Important limitations
This is a development starter, not a production-ready hosted service. Sessions are memory-only and expire after seven days; restart logs everyone out. The first-account registration lock is not a complete admin system. No MFA, email verification, password reset, account management, formal CSRF framework, security audit, or robust audit logging is included. Browser inspection is page-text extraction, not full interactive browser automation. Docker must be installed for sandbox execution; there is no unsafe host fallback. Never expose this app directly to the public internet without professional security hardening.

## Tests
Run `npm test`. The test suite covers basic tool and knowledge functions; it does not certify security or prove every external integration works.

## Version 7 media features

- Image generation through a configurable Images API provider (`IMAGE_API_*`).
- Image understanding through your selected multimodal chat model.
- Video understanding by sampling up to eight frames from the first 24 seconds with FFmpeg (no audio analysis).
- Stronger security defaults: response headers, same-origin checks, persistent sessions, and a production startup guard.

See `docs/V7_MEDIA_AND_SECURITY.md` for setup and important limits. Media support needs a model/provider that accepts the relevant input type; video support also needs FFmpeg. The security work is a stronger baseline, not an independent security audit or a guarantee of production safety. The skills folder remains empty by design.
