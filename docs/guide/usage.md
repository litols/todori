# Usage Guide

## Basic Task Management

### Creating Tasks

Simply ask Claude Code to create a task:

```
Create a task: Implement user authentication
```

You can also provide additional details:

```
Create a task: Add dark mode support
Description: Implement theme switching with localStorage persistence
Priority: 75
```

### Listing Tasks

View all your tasks:

```
Show me all my tasks
```

Filter by status:

```
Show me all pending tasks
Show me tasks in progress
```

### Updating Tasks

Update task status:

```
Mark task "Implement user authentication" as in-progress
Complete task "Add dark mode support"
```

Update task details:

```
Update task "Implement auth" priority to 90
Add description to task "Setup CI": Configure GitHub Actions workflow
```

### Task Dependencies

Create tasks with dependencies:

```
Create task: Deploy to production
Depends on: Run integration tests, Update documentation
```

Todori will automatically:
- Calculate task priorities based on dependencies
- Prevent circular dependencies
- Show you the dependency graph when listing tasks

## Task Expansion

One of Todori's most powerful features is automatic task expansion using Claude Code's understanding of your project.

### Automatic Subtask Generation

When you create a complex task, ask Claude Code to expand it:

```
Create and expand task: Refactor database layer
```

Claude Code will:
1. Analyze your codebase
2. Understand the current implementation
3. Break down the task into concrete subtasks
4. Create dependencies between subtasks

### Manual Expansion

You can also expand existing tasks:

```
Expand task: Implement user authentication
```

## Task Queries

### Filtering

Filter tasks by various criteria:

```
Show tasks with priority > 70
Show blocked tasks
Show tasks tagged with "backend"
```

### Sorting

Sort tasks by different fields:

```
Show tasks sorted by priority
List tasks by creation date
```

### Search

Search in task titles and descriptions:

```
Find tasks related to authentication
Search for tasks containing "API"
```

## Task Statuses

Todori supports the following task statuses:

- **pending**: Task is ready to be worked on
- **in-progress**: Currently being worked on
- **blocked**: Waiting for dependencies or external factors
- **done**: Task completed
- **deferred**: Postponed for later
- **cancelled**: Task cancelled

## Project Context

### Session Persistence

Tasks persist across Claude Code sessions. When you start a new session in the same project, all your tasks are automatically restored.

### Project Detection

Todori automatically detects your project by looking for:
- Git repository root
- Package manager files
- Common project markers

Tasks are stored in `.todori/tasks.yaml` at your project root.

### Multi-Project Support

You can work on multiple projects. Each project maintains its own task list in its `.todori/` directory.

## Multi-Agent Coordination (ccmanager)

Todori supports multi-agent task coordination, designed to work seamlessly with [ccmanager](https://github.com/kbwo/ccmanager) for parallel development workflows.

### Overview

When working with multiple Claude Code sessions (e.g., different git worktrees), Todori allows each session to "claim" tasks, preventing other sessions from working on the same task.

```
┌─────────────────────────────────────────────────────────┐
│                    ccmanager                            │
├──────────────┬──────────────┬──────────────────────────┤
│ Worktree A   │ Worktree B   │ Worktree C              │
│ (feature-1)  │ (feature-2)  │ (bugfix-1)              │
├──────────────┼──────────────┼──────────────────────────┤
│/todori-claim │/todori-claim │/todori-claim            │
│  → Task T1   │  → Task T2   │  → Task T3              │
│              │              │                          │
│ ... work ... │ ... work ... │ ... work ...            │
│              │              │                          │
│/todori-done  │/todori-done  │/todori-release          │
│  → T1 done   │  → T2 done   │  → T3 released          │
└──────────────┴──────────────┴──────────────────────────┘
```

### Commands for Multi-Agent Workflow

#### `/todori-claim` - Claim Next Task

Claims the next available task for the current session:

```
/todori-claim                    # Auto-detect session ID
/todori-claim feature-auth       # Specify session ID manually
```

The command will:
1. Find the next unassigned task (respecting dependencies and priority)
2. Set the task status to `in-progress`
3. Assign the task to your session

Session ID is detected in this order:
1. Command argument (if provided)
2. `CCMANAGER_WORKTREE_BRANCH` environment variable
3. `CCMANAGER_SESSION_ID` environment variable
4. Current git branch name
5. Fallback to "default"

#### `/todori-release` - Release a Task

Releases a claimed task without completing it:

```
/todori-release              # Release current in-progress task
/todori-release abc-123      # Release specific task by ID
```

This clears the assignee, making the task available for other sessions.

#### `/todori-status` - Multi-Session Overview

Shows task status across all sessions:

```
/todori-status
```

Output shows:
- Tasks grouped by session/assignee
- Unassigned tasks available for claiming
- Recently completed tasks

### Using with ccmanager

1. **Install ccmanager**:
   ```bash
   npm install -g ccmanager
   ```

2. **Create worktrees for parallel work**:
   ```bash
   # ccmanager will manage git worktrees automatically
   ccmanager
   ```

3. **In each session**, use Todori commands:
   ```
   /todori-claim          # Get next available task
   # ... work on the task ...
   /todori-done           # Mark complete when finished
   ```

4. **Status hooks** (optional): Configure ccmanager to run Todori commands on session state changes.

### API Support

The following MCP tools support multi-agent coordination:

#### `get_next_task` with `currentSessionId`

```typescript
// Excludes tasks assigned to other sessions
get_next_task({
  currentSessionId: "feature-1"
})
```

#### `update_task` with `assignee`

```typescript
// Assign task to a session
update_task({
  id: "task-uuid",
  status: "in-progress",
  assignee: { sessionId: "feature-1" }
})

// Clear assignee
update_task({
  id: "task-uuid",
  assignee: null
})
```

### Task Assignee

Each task can have an optional `assignee` field:

```yaml
tasks:
  - id: 550e8400-e29b-41d4-a716-446655440000
    title: Implement user authentication
    status: in-progress
    assignee:
      sessionId: feature-1
      assignedAt: 2025-12-15T10:30:00Z
```

## Advanced Features

### Subtasks

Break down complex tasks into subtasks:

```
Add subtask to "Implement auth": Create user model
Add subtask to "Implement auth": Setup JWT middleware
Add subtask to "Implement auth": Add login endpoint
```

### Task Metadata

Every task includes metadata:
- Creation timestamp
- Last update timestamp
- Completion timestamp (for done tasks)
- Auto-calculated priority

### Dependency Graph

View the full dependency graph:

```
Show dependency graph for task "Deploy to production"
```

## Best Practices

### 1. Use Descriptive Titles

Good:
```
Create task: Implement OAuth2 authentication with Google provider
```

Less good:
```
Create task: Add auth
```

### 2. Set Appropriate Priorities

- 90-100: Critical, blocking other work
- 70-89: High priority, should be done soon
- 40-69: Medium priority, normal work
- 20-39: Low priority, nice to have
- 0-19: Very low priority, future work

### 3. Break Down Large Tasks

Instead of:
```
Create task: Build entire frontend
```

Do:
```
Create task: Setup React project
Create task: Implement component library
Create task: Add routing
Create task: Integrate with API
```

### 4. Use Dependencies

Connect related tasks:
```
Create task: Write integration tests
Depends on: Implement API endpoints

Create task: Deploy to staging
Depends on: Write integration tests, Update documentation
```

### 5. Keep Tasks Updated

Regularly update task statuses to reflect current work:
```
Start task: Implement component library
Complete task: Setup React project
```

## Tips and Tricks

### Quick Task Creation

You can create multiple tasks at once:
```
Create these tasks:
- Setup development environment
- Configure linting
- Add pre-commit hooks
```

### Context-Aware Expansion

Let Claude Code analyze your project before expanding:
```
Look at the current authentication implementation, then expand the task: Migrate to OAuth2
```

### Review Before Completing

Before marking a task as done, ask Claude Code to verify:
```
Review if task "Implement auth" is complete
```

## Next Steps

- [Explore the full API reference](/api/reference)
- [View examples on GitHub](https://github.com/litols/todori/tree/main/examples)
