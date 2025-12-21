---
description: Claim the next available task for this session (ccmanager multi-agent support)
allowed-tools: mcp__todori__get_next_task, mcp__todori__update_task
---

# Claim Next Task

Claim the next available task for this session. This command is designed for multi-agent coordination with ccmanager.

## Session ID Detection

The session ID is determined in this order:
1. If provided as an argument, use that (e.g., `/todori-claim feature-branch`)
2. Check for `CCMANAGER_WORKTREE_BRANCH` environment variable (set by ccmanager)
3. Check for `CCMANAGER_SESSION_ID` environment variable
4. Fall back to current git branch name
5. If all else fails, use "default"

## Steps

1. Determine the session ID using the order above
2. Call `get_next_task` with `currentSessionId` to find an unassigned/available task
3. If a task is found:
   - Call `update_task` to:
     - Set `status` to "in-progress"
     - Set `assignee` to `{ sessionId: "<session-id>" }`
   - Display the claimed task details
   - Show the rationale for why this task was recommended
4. If no task is available:
   - Explain why (all tasks assigned to other sessions, all blocked, all done, etc.)
   - Suggest checking `/todori-tasks` for the full list

## Output Format

When a task is claimed, show:
```
Claimed task for session: <session-id>

[in-progress] <task-title>
ID: <task-id>
Priority: <priority>
Description: <description if any>

Rationale: <why this task was recommended>
```

## Example Usage

- `/todori-claim` - Auto-detect session and claim next task
- `/todori-claim feature-auth` - Claim next task for session "feature-auth"
