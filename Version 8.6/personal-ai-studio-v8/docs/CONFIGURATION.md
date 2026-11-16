# Configuration guide

| Variable | Meaning |
|---|---|
| `AI_PROVIDER` | `openai-compatible` or `anthropic` |
| `AI_BASE_URL` | OpenAI-compatible API base URL |
| `AI_API_KEY` | Server-side key for that provider |
| `AI_MODEL` | Model name for compatible provider |
| `ANTHROPIC_API_KEY` | Server-side Anthropic key |
| `ANTHROPIC_MODEL` | Anthropic model name |
| `PORT` | Local web server port |
| `SESSION_SECRET` | Required random secret (32+ characters) for signing account sessions |
| `WORKSPACE_DIR` | Directory tools may access |

The app does not include a browser-based settings page for API keys. This is intentional: keys should not be sent to or stored in browser local storage.
