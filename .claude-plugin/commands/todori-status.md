---
description: Show task status across all sessions (ccmanager multi-agent overview)
allowed-tools: mcp__todori__get_tasks, mcp__todori__get_task_stats
---

# Multi-Session Status

Show an overview of tasks across all sessions, useful for coordinating work with ccmanager.

## Steps

1. Call `get_task_stats` for overall statistics
2. Call `get_tasks` with `includeMetadata: true` to get all tasks with assignee info
3. Group and display tasks by:
   - **Assigned tasks** - grouped by session ID
   - **Unassigned tasks** - available for claiming
   - **Completed tasks** - recently done

## Output Format

```
Task Overview
=============
Total: X | Pending: X | In-Progress: X | Done: X | Blocked: X

By Session:
-----------
[feature-1] 2 tasks in-progress
  - Task A (high priority)
  - Task B (medium priority)

[feature-2] 1 task in-progress
  - Task C (medium priority)

Unassigned (available to claim):
--------------------------------
  - Task D (high priority) - no dependencies
  - Task E (medium priority) - depends on Task A

Recently Completed:
-------------------
  - Task F (by feature-1)
  - Task G (by feature-2)
```

## Example Usage

- `/todori-status` - Show full multi-session status overview
