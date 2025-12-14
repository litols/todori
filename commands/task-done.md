---
description: Mark a task as completed
allowed-tools: mcp__todori__update_task
---

# Mark Task Done

Mark a task as completed in Todori.

You should:
1. If a task ID is provided as an argument, use it directly
2. If no ID provided:
   - First call `get_tasks` with status filter for in-progress tasks
   - If there's exactly one in-progress task, offer to complete it
   - If multiple, show the list and ask which one to complete
3. Call the todori MCP server's `update_task` tool to set status to "done"
4. Confirm the completion
5. Suggest the next task using `get_next_task`

Example usage:
- /task-done abc-123
- /task-done (completes current in-progress task)
