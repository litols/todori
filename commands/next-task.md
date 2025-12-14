---
description: Get the recommended next task to work on
---

# Next Task Recommendation

Get a dependency-aware recommendation for the next task to work on.

Use the `get_next_task` MCP tool from the todori server.

You should:
1. Call the todori MCP server's `get_next_task` tool
2. Present the recommended task clearly
3. Explain the rationale (why this task is recommended)
4. Show any relevant context like dependencies or priority
5. Ask if the user wants to start working on it

If no tasks are available, explain why (all done, all blocked, etc.) and suggest next steps.
