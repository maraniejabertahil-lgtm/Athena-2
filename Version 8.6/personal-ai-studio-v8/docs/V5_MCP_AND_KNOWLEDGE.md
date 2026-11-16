# Version 5: MCP and improved knowledge retrieval

## MCP connectors

Set `MCP_SERVERS` to a JSON array in `.env`. Each server needs a unique `name`, a `transport` (`stdio` or `http`), and an explicit `allowTools` list. For `stdio`, set `command` and optional `args`/`env`. For Streamable HTTP, set `url` and optional `headers`.

Only allowlisted tools are exposed to the model. The server starts connections on boot and reports status at `GET /api/mcp`. The app closes clients on shutdown. MCP tools run with the server process's permissions, so only connect trusted servers and allow only tools you understand. A tool allowlist is not a full security sandbox. Avoid giving an MCP server access to secrets or folders outside the intended workspace.

The app does not install or discover MCP servers automatically. Configure and install them yourself.

## Knowledge retrieval

Knowledge chunks are now ranked with a small BM25-style term-frequency/inverse-document-frequency scorer rather than raw substring counts. This is lexical search, not embeddings or semantic vector search.

## Limits

This release does not add user accounts, multi-user isolation, remote browser automation, sandboxed code execution, image/audio/video generation, or production deployment hardening. MCP support requires installing the SDK dependency and configuring a trusted server. Skills remain deliberately unused and empty.
