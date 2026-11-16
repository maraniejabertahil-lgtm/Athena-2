# Handoff: Personal AI Studio (version 8.6)

This note is for the next person or AI that continues the project.

## What the app is
A private web chat that connects to a model you choose (Anthropic Claude, or any OpenAI-compatible provider such as Gemini). It adds a knowledge library, approved browser steps, approved code runs in a Docker sandbox, image and video understanding, voice input and spoken replies, a skills library of 81 instruction files, and user accounts.

## Start here
1. Copy `.env.example` to `.env` and fill it in. Follow `docs/SETUP_DOCKER_AND_MODELS.md`.
2. Run `npm install`, then `npx playwright install chromium`, then `npm start`.
3. Run `npm test`. All tests should pass.
4. Check the startup messages. Lines starting with "Setup check:" name anything missing.

## Settings that matter
- `AI_PROVIDER`: `anthropic` or `openai-compatible`.
- `MAX_REPLY_TOKENS`, `MAX_HISTORY_MESSAGES`: reply length and memory.
- `REASONING_LEVEL`: `off`, `standard` or `deep`. Test that the chosen provider accepts it before relying on it.
- `AUTO_RUN_CODE`: off by default. Turn on only after testing the sandbox.
- `BROWSER_ALLOWED_DOMAINS`: the only websites the browser steps may visit.
- `VIDEO_MAX_FRAMES`, `VIDEO_MAX_SECONDS`: video sampling.

## Tested in code only (not yet live)
Treat these as unverified until someone runs them with real services:
- Connection to a live Claude or Gemini key, including tool use and reasoning settings.
- Docker code sandbox (Run button, AUTO_RUN_CODE).
- Browser steps (click, type, read) on a real site.
- Hands-free voice and spoken replies (Chrome-based browsers).
- Image generation and image understanding.
- Video frame sampling (needs FFmpeg).
- MCP connections (needs at least one tool server configured).

## Tested in code (automated tests pass)
Knowledge search ranking, Word (.docx) reading, settings check, skills loading, safety checks for browser steps, video setting limits, and the tool list.

## Known gaps, in order of importance
1. Streaming replies (answers appear word by word). Not built.
2. PDF reading. Not built; needs a PDF library.
3. Knowledge search by meaning. Not built; needs an embedding model.
4. Video sound. Not built; needs a transcription service.
5. Production security: needs a real database, HTTPS hosting, and an independent review.
6. Account management: no screen to add users, no password reset. Left as is by request.

## Safety rules to keep
- Never add a tool the model can run without a clear user approval, unless the user has turned on the matching setting.
- Never let the browser steps fill in passwords or payment details.
- Never expose the server directly to the public internet without HTTPS and a proper account system.
