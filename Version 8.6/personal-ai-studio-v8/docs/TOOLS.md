# Tools — Version 3

The model may automatically call only these read-only tools:
- `get_current_time`
- `list_workspace`
- `read_workspace_file`

Both OpenAI-compatible and Anthropic adapters support these tools, with a maximum of five tool rounds per chat turn.

`write_workspace_file` is deliberately excluded from model tool schemas. The user can instead enter a path and content in the Approvals panel and confirm the write in the browser. Writes are restricted to the workspace directory. This confirmation mechanism is intended for local development, not as production-grade authorization.
