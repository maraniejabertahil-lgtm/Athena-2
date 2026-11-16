# Changelog

## 8.6.0
- Knowledge library reads Word (.docx) files, with no extra libraries.
- Settings check at startup and on the health page, in plain language.
- REASONING_LEVEL=off|standard|deep asks the model to think longer on hard problems (Claude extended thinking; reasoning_effort for compatible providers). Off by default.

## 8.5.0
- Reply length and history are set in .env (MAX_REPLY_TOKENS default 8192, MAX_HISTORY_MESSAGES default 60). Earlier default was 4096 tokens and 30 messages.
- Optional AUTO_RUN_CODE=true lets the assistant run JavaScript in the Docker sandbox while replying and read the output. Off by default.
- Tool rounds per reply raised from 5 to 8.

## 8.4.0
- Code blocks in replies get a Run button (JavaScript, in the Docker sandbox, after approval, with the result sent back to the assistant) and a Preview button (HTML, in a sandboxed frame).
- The assistant is told it can propose runnable code but cannot run it itself.
- Added docs/SETUP_DOCKER_AND_MODELS.md.

## 8.3.0
- Added hands-free voice conversation: listen, send, hear the reply, listen again. Turn it on with the headphones button.
- Video sampling is configurable with VIDEO_MAX_FRAMES and VIDEO_MAX_SECONDS.

## 8.2.0
- Added approved browser steps (go, click, type, read) on BROWSER_ALLOWED_DOMAINS only. Passwords, payments, orders and deletions are blocked. Each run needs approval.

## 8.1.0
- Knowledge search now uses BM25 ranking (rare words count more; long passages are not favoured).
- Added a spoken-replies switch (browser text-to-speech). Off by default.

## 8.0.0
- Added a user-managed skills library. Each skill is a folder in `skills/` with a `SKILL.md` file (81 skills included).
- Added read-only `list_skills` and `load_skill` tools. The assistant sees only skill names until it loads one.
- Added `GET /api/skills`. Skills never run code and cannot grant tools.

## 7.0.0
- Added configurable image generation API integration with explicit user approval.
- Added image understanding for multimodal OpenAI-compatible and Anthropic chat models.
- Added video frame sampling and multimodal frame analysis using FFmpeg.
- Added security headers, same-origin request checks, persistent sessions, and production startup safeguards.
- Kept the skills library empty and disabled.

## 6.0.0
- Added first-account registration, per-user memory and knowledge, controlled browser inspection, and Docker code execution.
