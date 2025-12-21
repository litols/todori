---
description: Add a new task to Todori
allowed-tools: mcp__todori__create_task
---

# Add Task

Add a new task to the Todori task list.

You should:
1. If arguments are provided after the command, use them as the task title
2. If no arguments, ask the user for:
   - Task title (required)
   - Description (optional)
   - Priority (high/medium/low, default: medium)
   - Dependencies (optional, comma-separated task IDs)
3. Call the todori MCP server's `create_task` tool with the information
4. Confirm the task was created and show its ID
5. Suggest related actions (add subtasks, set dependencies, etc.)

Example usage:
- /add-task Implement user authentication
- /add-task (interactive mode)
