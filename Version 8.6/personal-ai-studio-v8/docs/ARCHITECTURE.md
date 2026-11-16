# Architecture — Version 3

- `public/`: browser chat, memory manager, and explicit file-write confirmation UI.
- `src/server.js`: Express API routes.
- `src/providers/`: provider adapters. Both adapters support bounded tool loops for read-only tools.
- `src/tools/registry.js`: tool schemas and workspace-limited tool implementations. Write tool is excluded from model tool schemas.
- `src/memory.js`: stores only user-added memory notes in `data/memory.json` and supplies them as context.
- `skills/`: intentionally empty except for instructions; no loader or execution engine.
- `workspace/`: files available to the local workspace tools.

The browser chat history is separate from persistent memory. Chat history remains in browser local storage; memory notes are stored on the server in a JSON file.
