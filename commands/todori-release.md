---
description: Release a claimed task (remove assignee, keep status)
allowed-tools: mcp__todori__update_task, mcp__todori__get_tasks
---

# Release Task

Release a task that was claimed by this session. This removes the assignee but keeps the task status unchanged (useful when you need to stop working on a task without completing it).

## Steps

1. If a task ID is provided as an argument, use it directly
2. If no ID provided:
   - Call `get_tasks` with status filter for in-progress tasks
   - Filter to tasks assigned to the current session (if detectable)
   - If there's exactly one, offer to release it
   - If multiple, show the list and ask which one to release
3. Call `update_task` with:
   - `assignee: null` (to clear the assignee)
   - Optionally set `status: "pending"` if the user wants to reset it
4. Confirm the release
5. The task is now available for other sessions to claim

## Example Usage

- `/todori-release` - Release the current session's in-progress task
- `/todori-release abc-123` - Release a specific task by ID
- `/todori-release --reset` - Release and reset status to pending
