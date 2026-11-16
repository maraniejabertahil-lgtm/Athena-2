# Version 4 capability status

This release expands the V3 foundation. It is not a claim of feature parity with ChatGPT or any frontier assistant. Capabilities depend on the connected model, provider terms, API keys, browser support and deployment environment.

## Working in this release
- OpenAI-compatible and Anthropic text model adapters from V3.
- Automatic execution of the registered read-only tools, within the configured tool-round limit.
- User-approved workspace file writes.
- User-managed persistent memory from V3.
- Local knowledge library for `.txt`, `.md`, `.json` and `.csv` files, with chunking and lexical retrieval.
- Optional Tavily web search, available to the model as a read-only tool when `TAVILY_API_KEY` is set. Search results should be cited by the assistant.
- API rate limiting. Optional shared admin-token gate for API endpoints.
- Browser speech-to-text when the browser supports the Web Speech API.
- Local chat history in browser storage from V3.
- Skills system remains intentionally absent; no skills are loaded or executed.

## Not implemented / requires later engineering
- Full MCP client and server lifecycle management.
- General-purpose plugin marketplace and OAuth integrations.
- Browser automation with a hardened isolated browser.
- Arbitrary code execution in a real OS/container sandbox.
- Image generation, image uploads/vision, audio transcription and speech synthesis, video understanding/generation.
- Multi-user accounts, roles, secure sessions, database-backed tenancy, audit log, encrypted secrets vault, backup/restore.
- PDF/Office document parsing, embeddings/vector database, semantic retrieval and reranking.
- Streaming responses, robust cancellation, background agents, scheduled tasks and orchestration.
- Provider-specific native multimodal APIs and comprehensive compatibility tests.

## Security notes
Keep the server bound to a trusted machine/network. Do not expose it directly to the public internet. `APP_ADMIN_TOKEN` is a simple shared-token gate, not a replacement for user authentication, HTTPS, CSRF protection, session management or a secrets vault. Rate limiting is in-memory and resets when the server restarts. Uploaded knowledge content is treated as reference data, but prompt injection defenses are not a complete security boundary.
