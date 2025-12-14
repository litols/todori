---
description: Show current tasks from Todori
---

# Show Tasks

Display the current task list from Todori.

Use the `get_tasks` MCP tool from the todori server to fetch and display tasks.

You should:
1. Call the todori MCP server's `get_tasks` tool
2. Format the results in a clear, readable way
3. Show task status (pending, in-progress, done) with visual indicators
4. Group by status if there are many tasks
5. Include task IDs for reference

If no tasks exist, suggest using /add-task to create some.
