# Version 7: Media and security

## Image generation

The signed-in UI sends an approved prompt to `POST /api/media/image/generate`. Configure `IMAGE_API_BASE_URL`, `IMAGE_API_KEY`, and `IMAGE_MODEL`. The default endpoint is the OpenAI Images API. The key stays on the server. A provider must support the Images API request/response shape and base64 image responses.

## Image understanding

`POST /api/media/image/understand` accepts a PNG, JPEG, WEBP, or GIF data URL (up to 8 MB). The image is passed as a multimodal user message to the configured chat model. The model must support image input. Both OpenAI-compatible chat-completions and Anthropic Messages adapters convert the image block to their native format.

## Video understanding

`POST /api/media/video/understand` accepts MP4, WEBM, or MOV (up to 20 MB). Install FFmpeg and set `FFMPEG_PATH` if needed. The app samples up to eight frames from the first 24 seconds at about three-second intervals, with a 30-second processing limit, then sends those frames to the configured multimodal chat model. It does not extract or understand audio, and sampling can miss events between frames.

## Security hardening

Version 7 adds security response headers, a restrictive same-origin content security policy, same-host Origin checks for unsafe requests (Origin is required in production), persistent server-side session records with restrictive file permissions, and a production startup guard. Production requires `NODE_ENV=production`, `SESSION_SECRET` with at least 64 characters, and `COOKIE_SECURE=true`; deploy behind HTTPS.

This is a stronger baseline, **not a security certification or a claim that the app is fully production-safe**. Before exposing it to the public internet, use a managed database with transactional account creation, a trusted reverse proxy, backups, monitoring, dependency scanning, a security review, and penetration testing. Protect the data directory and restrict who can edit environment settings. The app has not had an independent security audit.

## Skills remain excluded

The `skills/` folder remains intentionally empty apart from its explanatory README. No skill loader or execution system is added.
