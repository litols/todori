# API Reference

Todori exposes the following MCP tools for task management. These tools are automatically available in Claude Code when the MCP server is running.

## Task Management Tools

### `create_task`

Creates a new task in the current project.

**Parameters:**
- `title` (string, required): Task title
- `description` (string, optional): Detailed task description
- `priority` (number, optional): Priority level (0-100), default: 50
- `dependencies` (string[], optional): Array of task IDs this task depends on
- `status` (string, optional): Initial status, default: "pending"

**Returns:**
```typescript
{
  id: string;
  title: string;
  status: TaskStatus;
  created: ISO8601;
}
```

**Example:**
```typescript
{
  "title": "Implement user authentication",
  "description": "Add JWT-based authentication system",
  "priority": 80,
  "status": "pending"
}
```

---

### `list_tasks`

Lists all tasks in the current project.

**Parameters:**
- `status` (string, optional): Filter by status
- `minPriority` (number, optional): Minimum priority threshold
- `maxPriority` (number, optional): Maximum priority threshold

**Returns:**
```typescript
{
  tasks: Task[];
  count: number;
}
```

**Example:**
```typescript
{
  "status": "pending",
  "minPriority": 70
}
```

---

### `get_task`

Retrieves a specific task by ID.

**Parameters:**
- `id` (string, required): Task ID

**Returns:**
```typescript
{
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: number;
  dependencies: string[];
  subtasks: Subtask[];
  metadata: {
    created: ISO8601;
    updated: ISO8601;
    completedAt?: ISO8601;
  };
}
```

---

### `update_task`

Updates an existing task.

**Parameters:**
- `id` (string, required): Task ID
- `title` (string, optional): New title
- `description` (string, optional): New description
- `status` (TaskStatus, optional): New status
- `priority` (number, optional): New priority

**Returns:**
```typescript
{
  id: string;
  updated: ISO8601;
}
```

**Example:**
```typescript
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "in-progress",
  "priority": 90
}
```

---

### `delete_task`

Deletes a task permanently.

**Parameters:**
- `id` (string, required): Task ID

**Returns:**
```typescript
{
  success: boolean;
  deletedId: string;
}
```

---

### `add_dependency`

Adds a dependency relationship between tasks.

**Parameters:**
- `taskId` (string, required): Task that depends on another
- `dependsOn` (string, required): Task ID that must be completed first

**Returns:**
```typescript
{
  success: boolean;
  taskId: string;
  dependencies: string[];
}
```

**Note:** Automatically validates against circular dependencies.

---

### `remove_dependency`

Removes a dependency relationship.

**Parameters:**
- `taskId` (string, required): Task ID
- `dependencyId` (string, required): Dependency to remove

**Returns:**
```typescript
{
  success: boolean;
  taskId: string;
  dependencies: string[];
}
```

---

## Subtask Management

### `add_subtask`

Adds a subtask to an existing task.

**Parameters:**
- `taskId` (string, required): Parent task ID
- `title` (string, required): Subtask title
- `description` (string, optional): Subtask description

**Returns:**
```typescript
{
  taskId: string;
  subtaskId: string;
  title: string;
}
```

---

### `complete_subtask`

Marks a subtask as completed.

**Parameters:**
- `taskId` (string, required): Parent task ID
- `subtaskId` (string, required): Subtask ID

**Returns:**
```typescript
{
  success: boolean;
  taskId: string;
  subtaskId: string;
}
```

---

## Task Expansion

### `expand_task`

Expands a task into subtasks using Claude Code's context understanding.

**Parameters:**
- `taskId` (string, required): Task to expand
- `context` (string, optional): Additional context for expansion

**Returns:**
```typescript
{
  taskId: string;
  subtasks: Subtask[];
  expandedAt: ISO8601;
}
```

**Note:** This tool generates a prompt for Claude Code to analyze the project and suggest subtasks. The suggestions are then parsed and added as subtasks.

---

## Query Tools

### `query_tasks`

Advanced task querying with filters and sorting.

**Parameters:**
- `filter` (object, optional): Filter criteria
  - `status` (string | string[]): Status filter
  - `priority` (object): Priority range
    - `min` (number): Minimum priority
    - `max` (number): Maximum priority
  - `search` (string): Search in title and description
- `sort` (object, optional): Sort configuration
  - `field` (string): Field to sort by (priority, created, updated)
  - `order` ("asc" | "desc"): Sort order

**Returns:**
```typescript
{
  tasks: Task[];
  count: number;
  filters: object;
}
```

**Example:**
```typescript
{
  "filter": {
    "status": ["pending", "in-progress"],
    "priority": { "min": 70 },
    "search": "authentication"
  },
  "sort": {
    "field": "priority",
    "order": "desc"
  }
}
```

---

## Data Types

### TaskStatus

```typescript
type TaskStatus =
  | "pending"
  | "in-progress"
  | "blocked"
  | "done"
  | "deferred"
  | "cancelled";
```

### Task

```typescript
interface Task {
  id: string;                    // UUID
  title: string;
  description?: string;
  status: TaskStatus;
  priority: number;              // 0-100
  dependencies: string[];        // Task IDs
  subtasks: Subtask[];
  metadata: {
    created: ISO8601;
    updated: ISO8601;
    completedAt?: ISO8601;
  };
}
```

### Subtask

```typescript
interface Subtask {
  id: string;                    // UUID
  title: string;
  description?: string;
  completed: boolean;
  completedAt?: ISO8601;
}
```

---

## Storage Format

Tasks are stored in `.todori/tasks.yaml` using YAML format for human readability:

```yaml
tasks:
  - id: 550e8400-e29b-41d4-a716-446655440000
    title: Implement user authentication
    description: Add JWT-based authentication system
    status: in-progress
    priority: 80
    dependencies: []
    subtasks:
      - id: 6ba7b810-9dad-11d1-80b4-00c04fd430c8
        title: Create user model
        completed: true
        completedAt: 2025-12-14T10:30:00Z
      - id: 6ba7b811-9dad-11d1-80b4-00c04fd430c8
        title: Setup JWT middleware
        completed: false
    metadata:
      created: 2025-12-14T09:00:00Z
      updated: 2025-12-14T10:30:00Z
```

---

## Error Handling

All tools return errors in a consistent format:

```typescript
{
  error: string;
  code: string;
  details?: object;
}
```

### Common Error Codes

- `TASK_NOT_FOUND`: Task ID does not exist
- `CIRCULAR_DEPENDENCY`: Adding dependency would create a cycle
- `INVALID_STATUS`: Invalid status value
- `INVALID_PRIORITY`: Priority out of range (0-100)
- `STORAGE_ERROR`: File system error
- `VALIDATION_ERROR`: Input validation failed

---

## Context Window Optimization

Todori is designed to minimize context window usage:

- **Average response size**: <2KB per tool call
- **List operations**: Return minimal task summaries by default
- **Expansion prompts**: Structured to guide Claude Code efficiently
- **Storage format**: YAML with atomic writes for consistency

---

## Performance Characteristics

- **Task creation**: O(1)
- **Task lookup**: O(1) with ID
- **Task listing**: O(n) where n = number of tasks
- **Dependency validation**: O(n) for cycle detection
- **File I/O**: Atomic writes with proper-lockfile for consistency

---

## Integration Examples

See the [examples directory](https://github.com/litols/todori/tree/main/examples) for:
- Integration with CI/CD pipelines
- Custom workflow automation
- Project templates
- Advanced query patterns
