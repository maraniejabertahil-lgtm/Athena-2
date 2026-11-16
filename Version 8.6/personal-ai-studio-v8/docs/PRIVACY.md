# Privacy and safety

- Provider API keys stay on the server in `.env`.
- Chat history is saved in browser local storage (last 30 messages).
- Persistent memory contains only notes manually added in the Memory panel; users can delete each note.
- Memory is stored as plain text in `data/memory.json`, not encrypted.
- Read-only workspace tools can run automatically. File writes are not model tools and require the browser confirmation flow.
- The app has no authentication, account separation, CSRF protection, or rate limiting. Run locally and do not expose it to the public internet.
- Do not save secrets or highly sensitive data in chat or memory.
