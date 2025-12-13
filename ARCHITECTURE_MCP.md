# Todori MCP Server Architecture Design

## Overview

This document specifies the MCP (Model Context Protocol) server architecture for Todori, a Claude Code-native task management system. The server exposes task management capabilities through stdio-based JSON-RPC 2.0 communication with minimal context overhead (<2KB per tool call).

---

## 1. MCP Tools Specification

### Tool Categories

MCP tools are organized into three categories: **CRUD Operations**, **Query & Analysis**, and **Utility**.

---

### 1.1 CRUD Operations

#### `get_tasks`
Retrieve tasks with flexible filtering and pagination.

**Description:** Fetch tasks with optional filtering by status, priority, date ranges, and pagination support.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "status": {
      "type": "array|string",
      "description": "Filter by status: pending, in-progress, blocked, done, deferred, cancelled",
      "example": ["pending", "in-progress"]
    },
    "priority": {
      "type": "array|string",
      "description": "Filter by priority: high, medium, low",
      "example": "high"
    },
    "createdAfter": {
      "type": "string",
      "description": "ISO8601 timestamp - filter tasks created after this date",
      "example": "2025-12-10T00:00:00Z"
    },
    "createdBefore": {
      "type": "string",
      "description": "ISO8601 timestamp - filter tasks created before this date"
    },
    "updatedAfter": {
      "type": "string",
      "description": "ISO8601 timestamp - filter tasks updated after this date"
    },
    "updatedBefore": {
      "type": "string",
      "description": "ISO8601 timestamp - filter tasks updated before this date"
    },
    "offset": {
      "type": "number",
      "description": "Pagination offset (default: 0)"
    },
    "limit": {
      "type": "number",
      "description": "Pagination limit (default: 50)"
    }
  }
}
```

**Response:** Array of Task objects (max 20 tasks per response to stay <2KB)

---

#### `get_task`
Retrieve a single task by ID with full details including subtasks.

**Description:** Fetch complete task details including all subtasks and dependency information.

**Input Schema:**
```json
{
  "type": "object",
  "required": ["id"],
  "properties": {
    "id": {
      "type": "string",
      "description": "Task UUID"
    }
  }
}
```

**Response:** Single Task object or error if not found

---

#### `create_task`
Create a new task with optional dependencies and metadata.

**Description:** Create a new task with title, description, priority, and initial dependencies.

**Input Schema:**
```json
{
  "type": "object",
  "required": ["title"],
  "properties": {
    "title": {
      "type": "string",
      "description": "Task title (required, max 200 chars)"
    },
    "description": {
      "type": "string",
      "description": "Optional task description"
    },
    "priority": {
      "type": "string",
      "enum": ["high", "medium", "low"],
      "description": "Priority level (default: medium)"
    },
    "dependencies": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Array of task IDs this task depends on"
    },
    "status": {
      "type": "string",
      "enum": ["pending", "in-progress", "blocked", "done", "deferred", "cancelled"],
      "description": "Initial status (default: pending)"
    }
  }
}
```

**Response:** Created Task object with generated ID and timestamps

---

#### `update_task`
Update task fields (status, priority, description, dependencies).

**Description:** Modify existing task properties. Validates dependency changes to prevent cycles.

**Input Schema:**
```json
{
  "type": "object",
  "required": ["id"],
  "properties": {
    "id": {
      "type": "string",
      "description": "Task UUID"
    },
    "title": {
      "type": "string",
      "description": "New task title"
    },
    "description": {
      "type": "string",
      "description": "New task description"
    },
    "status": {
      "type": "string",
      "enum": ["pending", "in-progress", "blocked", "done", "deferred", "cancelled"]
    },
    "priority": {
      "type": "string",
      "enum": ["high", "medium", "low"]
    },
    "dependencies": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Replace dependencies list"
    }
  }
}
```

**Response:** Updated Task object or error if validation fails (e.g., cycle detected)

---

#### `delete_task`
Delete a task and remove it from all dependent tasks.

**Description:** Permanently delete a task by ID. Automatically removes task ID from all other tasks' dependencies.

**Input Schema:**
```json
{
  "type": "object",
  "required": ["id"],
  "properties": {
    "id": {
      "type": "string",
      "description": "Task UUID to delete"
    }
  }
}
```

**Response:** `{ "success": true, "deletedId": "uuid" }` or error if not found

---

### 1.2 Query & Analysis Tools

#### `get_next_task`
Recommend the next task to work on based on dependencies and priority.

**Description:** Uses topological sorting and dependency analysis to recommend an unblocked, high-priority task. Returns task and reasoning.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "status": {
      "type": "array|string",
      "description": "Filter candidates by status (default: pending, in-progress)",
      "example": ["pending"]
    },
    "priority": {
      "type": "array|string",
      "description": "Filter candidates by priority"
    }
  }
}
```

**Response:**
```json
{
  "task": { /* Task object or null */ },
  "rationale": "Recommended: high priority, all dependencies completed"
}
```

---

#### `query_tasks`
Advanced query with sorting and field selection.

**Description:** Perform complex queries with filtering, sorting, and projection of specific fields.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "filters": {
      "type": "object",
      "description": "Same as get_tasks filters (status, priority, date ranges)"
    },
    "sort": {
      "type": "object",
      "properties": {
        "field": {
          "type": "string",
          "enum": ["priority", "created", "updated", "status"]
        },
        "order": {
          "type": "string",
          "enum": ["asc", "desc"],
          "default": "asc"
        }
      }
    },
    "fields": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Project only these fields: id, title, status, priority, etc."
    }
  }
}
```

**Response:** Array of Task objects (projected if fields specified)

---

#### `get_task_stats`
Retrieve aggregate statistics about tasks.

**Description:** Get task counts by status, average completion time, dependency graph metrics, and blocked task count.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {}
}
```

**Response:**
```json
{
  "total": 42,
  "byStatus": {
    "pending": 15,
    "in-progress": 8,
    "blocked": 3,
    "done": 14,
    "deferred": 2,
    "cancelled": 0
  },
  "byPriority": {
    "high": 10,
    "medium": 20,
    "low": 12
  },
  "blockedCount": 3,
  "avgCompletionDays": 4.2,
  "dependencyStats": {
    "maxDepth": 5,
    "averageDepsPerTask": 1.3
  }
}
```

---

### 1.3 Subtask Management

#### `add_subtask`
Add a subtask to an existing task.

**Description:** Create a subtask under a parent task. Subtask IDs are hierarchical (e.g., `uuid.1`, `uuid.2`).

**Input Schema:**
```json
{
  "type": "object",
  "required": ["parentId", "title"],
  "properties": {
    "parentId": {
      "type": "string",
      "description": "Parent task UUID"
    },
    "title": {
      "type": "string",
      "description": "Subtask title"
    },
    "description": {
      "type": "string",
      "description": "Optional subtask description"
    }
  }
}
```

**Response:** Updated parent Task object with new subtask

---

#### `update_subtask`
Update a subtask's status or description.

**Description:** Modify a subtask within its parent task.

**Input Schema:**
```json
{
  "type": "object",
  "required": ["subtaskId"],
  "properties": {
    "subtaskId": {
      "type": "string",
      "description": "Subtask ID in format 'parentId.N' (e.g., 'abc123.2')"
    },
    "status": {
      "type": "string",
      "enum": ["pending", "in-progress", "blocked", "done", "deferred", "cancelled"]
    },
    "title": {
      "type": "string"
    },
    "description": {
      "type": "string"
    }
  }
}
```

**Response:** Updated parent Task object or error if subtask not found

---

#### `delete_subtask`
Remove a subtask from its parent.

**Description:** Delete a specific subtask.

**Input Schema:**
```json
{
  "type": "object",
  "required": ["subtaskId"],
  "properties": {
    "subtaskId": {
      "type": "string",
      "description": "Subtask ID in format 'parentId.N'"
    }
  }
}
```

**Response:** Updated parent Task object or error if not found

---

## 2. MCP Prompts Specification

### Optional Prompt Handlers for Claude Code Integration

Prompts allow Claude Code to request contextual information without explicit tool calls.

---

#### `session_restore`
**Description:** Automatically called when Claude Code initializes a Todori session. Provides project overview.

**Response:**
```markdown
# Project Status

Total Tasks: 42
- Pending: 15
- In Progress: 8
- Blocked: 3 (review dependencies)
- Done: 14
- Deferred: 2

## Next Task to Work On
[Task Title] (priority: high)
[Description]

## Recent Updates (5 most recent)
1. [Task] - status changed to done
2. [Task] - created
...
```

---

#### `task_context`
**Description:** Provides detailed context for a specific task (called with task ID as input).

**Response:**
```markdown
# Task: [Title]

Status: in-progress
Priority: high
Created: 2025-12-10

## Description
[Full description]

## Dependencies
- [Task A] - status: done ✓
- [Task B] - status: pending

## Dependent Tasks (blocked by this)
- [Task C]
- [Task D]

## Subtasks (3/5 complete)
- [x] Subtask 1
- [x] Subtask 2
- [ ] Subtask 3
- [ ] Subtask 4
- [ ] Subtask 5
```

---

## 3. Server Structure

### File Organization

```
src/server/
├── index.ts              # Server entry point (main loop, stdio setup)
├── tools.ts              # Tool handler implementations
├── prompts.ts            # Prompt handler implementations
├── transport.ts          # Stdio JSON-RPC 2.0 transport
├── response-builder.ts   # Standardized response formatting
└── error-handler.ts      # Centralized error handling & codes
```

---

### 3.1 Entry Point: `src/server/index.ts`

**Responsibilities:**
- Initialize project root (via `detectProjectRoot`)
- Load TaskStore, TaskManager, QueryEngine
- Set up stdio transport with JSON-RPC 2.0
- Register all tool and prompt handlers
- Main event loop: read JSON-RPC request → route to handler → send response

**Pseudo-code Structure:**
```
async function main() {
  // 1. Detect project root
  const projectRoot = await detectProjectRoot(cwd)
  // 2. Initialize storage & core
  const taskStore = new TaskStore(projectRoot)
  const taskManager = new TaskManager(taskStore)
  const queryEngine = new QueryEngine(taskManager)
  // 3. Setup transport & handlers
  const transport = new StdioTransport()
  registerToolHandlers(taskManager, queryEngine, ...)
  registerPromptHandlers(...)
  // 4. Start server loop
  transport.listen()
}
```

---

### 3.2 Tool Handlers: `src/server/tools.ts`

**Structure:**
```typescript
export class ToolHandlers {
  constructor(
    private taskManager: TaskManager,
    private queryEngine: QueryEngine,
    private projectRoot: string
  ) {}

  // CRUD Handlers
  async get_tasks(params: GetTasksParams): Promise<ToolResponse> { }
  async get_task(params: GetTaskParams): Promise<ToolResponse> { }
  async create_task(params: CreateTaskParams): Promise<ToolResponse> { }
  async update_task(params: UpdateTaskParams): Promise<ToolResponse> { }
  async delete_task(params: DeleteTaskParams): Promise<ToolResponse> { }

  // Query Handlers
  async get_next_task(params: GetNextTaskParams): Promise<ToolResponse> { }
  async query_tasks(params: QueryTasksParams): Promise<ToolResponse> { }
  async get_task_stats(params: GetStatsParams): Promise<ToolResponse> { }

  // Subtask Handlers
  async add_subtask(params: AddSubtaskParams): Promise<ToolResponse> { }
  async update_subtask(params: UpdateSubtaskParams): Promise<ToolResponse> { }
  async delete_subtask(params: DeleteSubtaskParams): Promise<ToolResponse> { }
}
```

**Key Implementation Details:**
- Each handler validates input parameters
- Catches domain errors (e.g., task not found, cycle detected)
- Returns `ToolResponse` via response builder
- Logs errors to stderr for debugging

---

### 3.3 Prompt Handlers: `src/server/prompts.ts`

**Structure:**
```typescript
export class PromptHandlers {
  constructor(
    private taskManager: TaskManager,
    private queryEngine: QueryEngine
  ) {}

  async session_restore(): Promise<string> { }
  async task_context(taskId: string): Promise<string> { }
}
```

**Key Details:**
- Return formatted markdown strings
- Include task statistics, recommendations, and context
- Keep output concise (<2KB)

---

### 3.4 Transport Layer: `src/server/transport.ts`

**Responsibilities:**
- Stdin reader: parse JSON-RPC 2.0 requests
- Stdout writer: send JSON-RPC 2.0 responses
- Route `method` field to appropriate handler
- Handle malformed JSON and protocol errors

**Key Methods:**
```typescript
export class StdioTransport {
  onRequest(handler: (req: MCPRequest) => Promise<MCPResponse>): void
  sendResponse(response: MCPResponse): void
  sendError(id: string | number, error: MCPError): void
  listen(): Promise<void>
}
```

---

### 3.5 Response Builder: `src/server/response-builder.ts`

**Provides standardized response formatting:**

```typescript
export class ResponseBuilder {
  static success(id: string | number, data: unknown): MCPResponse
  static error(id: string | number, code: number, message: string): MCPResponse
  static parseError(id?: string | number): MCPResponse
  static serverError(id?: string | number, data?: unknown): MCPResponse
}
```

**Error Codes (JSON-RPC 2.0 standard + custom):**
- `-32700`: Parse error
- `-32600`: Invalid Request
- `-32601`: Method not found
- `-32602`: Invalid params
- `-32603`: Internal error
- `-32000 to -32099`: Server error (reserved for implementation)
  - `-32000`: Task not found
  - `-32001`: Invalid dependency (cycle detected)
  - `-32002`: Project root not found

---

### 3.6 Error Handler: `src/server/error-handler.ts`

**Centralized error mapping:**

```typescript
export function mapErrorToMCPError(error: unknown): MCPError {
  if (error instanceof TaskNotFoundError) {
    return { code: -32000, message: "Task not found" }
  }
  if (error instanceof CycleDetectedError) {
    return { code: -32001, message: "Dependency would create a cycle" }
  }
  // ... other domain errors
  return { code: -32603, message: "Internal server error" }
}
```

---

## 4. Key Architecture Decisions

### 4.1 Response Size Management (<2KB Target)

**Strategies:**
1. **Pagination in `get_tasks`**: Return max 20 tasks per call
2. **Field Selection in `query_tasks`**: Project only requested fields
3. **Compact Stats**: Return aggregated counts, not full task objects
4. **Lazy Expansion**: Full task details only when explicitly requested via `get_task`

**Example:**
- `get_tasks` with `limit=20`: ~1.8KB per response
- `get_task_stats`: ~0.4KB
- `get_next_task`: ~1.2KB (includes rationale)

---

### 4.2 Error Handling Strategy

**Principle:** Fail fast with clear error messages

1. **Validation Layer:** All tool inputs validated before DB access
2. **Domain Errors:** Caught and mapped to JSON-RPC error codes
3. **Transient Errors:** Retry logic for file I/O (max 3 attempts)
4. **Client Errors vs Server Errors:** Distinguished in error codes
   - `-32600 to -32602`: Client error (invalid request)
   - `-32000 to -32002`: Client domain error (logic violation)
   - `-32603`: Server error (unrecoverable)

---

### 4.3 Project Root Detection on Init

**Sequence:**
1. Check `TODORI_PROJECT_ROOT` environment variable
2. Walk up from CWD looking for `.git` or `.todori` directory
3. If found, initialize TaskStore at that location
4. If not found, return error `-32002` with helpful message

**Rationale:** Allows server to work with any project structure

---

### 4.4 No State Between Requests

**Design:** Each request is independent
- No in-memory task caching (load from YAML on each call)
- Supports multiple Claude Code instances sharing same .todori directory
- File I/O is atomic (write-on-modify pattern)

---

### 4.5 Minimal Dependencies

**Stack:**
- Runtime: Bun (built-in, no npm needed)
- Core utilities: Node.js builtins only
- Third-party: `uuid` (for task IDs)

---

## 5. Request/Response Examples

### Example 1: Create Task
```json
{
  "jsonrpc": "2.0",
  "id": "req-1",
  "method": "create_task",
  "params": {
    "title": "Implement MCP server",
    "description": "Build stdio transport and tool handlers",
    "priority": "high"
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-1",
  "result": {
    "id": "abc-123-uuid",
    "title": "Implement MCP server",
    "description": "Build stdio transport and tool handlers",
    "status": "pending",
    "priority": "high",
    "dependencies": [],
    "subtasks": [],
    "metadata": {
      "created": "2025-12-14T12:00:00Z",
      "updated": "2025-12-14T12:00:00Z"
    }
  }
}
```

---

### Example 2: Get Next Task
```json
{
  "jsonrpc": "2.0",
  "id": "req-2",
  "method": "get_next_task",
  "params": {
    "priority": ["high", "medium"]
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-2",
  "result": {
    "task": {
      "id": "def-456-uuid",
      "title": "Set up project root detection",
      "status": "pending",
      "priority": "high",
      "dependencies": [],
      "metadata": {
        "created": "2025-12-14T10:00:00Z",
        "updated": "2025-12-14T10:00:00Z"
      }
    },
    "rationale": "Recommended: high priority, no dependencies, topologically first"
  }
}
```

---

### Example 3: Error Response
```json
{
  "jsonrpc": "2.0",
  "id": "req-3",
  "error": {
    "code": -32000,
    "message": "Task not found",
    "data": {
      "taskId": "nonexistent-uuid"
    }
  }
}
```

---

## 6. Implementation Roadmap

### Phase 5: MCP Server (Sequential)

1. **Setup Infrastructure** (src/server/)
   - [ ] Create index.ts (main entry point)
   - [ ] Create transport.ts (stdio JSON-RPC)
   - [ ] Create response-builder.ts
   - [ ] Create error-handler.ts

2. **Tool Handlers** (src/server/)
   - [ ] Create tools.ts with all 10 tool implementations
   - [ ] Validate inputs and error handling

3. **Prompt Handlers** (src/server/)
   - [ ] Create prompts.ts
   - [ ] Implement session_restore and task_context

4. **Testing & Documentation**
   - [ ] Write stdio tests
   - [ ] Write tool call tests
   - [ ] Integration test with actual Claude Code

---

## 7. MCP Protocol Details

### Initialization

Claude Code sends an `initialize` request on startup:
```json
{
  "jsonrpc": "2.0",
  "id": "init",
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": { /* ... */ },
    "clientInfo": { "name": "claude-code", "version": "1.0" }
  }
}
```

Server responds with capabilities:
```json
{
  "jsonrpc": "2.0",
  "id": "init",
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": [
        { "name": "get_tasks", "description": "...", "inputSchema": { ... } },
        { "name": "get_task", ... },
        // ... all 10 tools
      ],
      "prompts": [
        { "name": "session_restore", "description": "..." },
        { "name": "task_context", "description": "..." }
      ]
    },
    "serverInfo": { "name": "todori", "version": "1.0" }
  }
}
```

---

## 8. Context Window Preservation

### Why <2KB per Response?

**Context Budget:** 200K tokens available to Claude Code
- Task expansions, file edits, research: ~80K tokens
- Project code analysis: ~60K tokens
- **Todori task management: ~40K tokens (10 concurrent sessions × 4KB buffer)**

**Per-Request Breakdown:**
- Minimal response: 0.2KB (error)
- Average response: 1.5KB
- Maximum response: 2.0KB (full task with subtasks)

**Optimization Techniques:**
1. **Pagination:** Limit results to prevent large array responses
2. **Selective Fields:** Only return requested columns
3. **Async Expansion:** Detailed info fetched in separate request if needed
4. **Aggregation:** Stats computed server-side, not returned raw

---

## 9. Thread Safety & Concurrency

**Note:** Todori is designed for single-machine operation.

- **File I/O:** Atomic writes via YAML serialization
- **Read Consistency:** All reads from single source of truth (.todori/tasks.yaml)
- **Conflict Handling:** Last-write-wins (later update overwrites earlier)
- **Future Enhancement:** Add file lock detection for multi-process safety

---

## 10. Summary

| Aspect | Decision |
|--------|----------|
| **Protocol** | JSON-RPC 2.0 over stdio |
| **Tools** | 10 core tools + utilities |
| **Prompts** | 2 optional prompts (session, context) |
| **Response Size** | <2KB average, <2.5KB max |
| **Error Codes** | JSON-RPC standard + custom (-32000 to -32002) |
| **Project Detection** | Walk up to .git or .todori |
| **Concurrency** | Single-machine, atomic file I/O |
| **Dependencies** | uuid only (plus Node.js builtins) |

---

This architecture is ready for implementation in Phase 5. Each tool is self-contained and can be implemented independently, with error handling and response formatting standardized across all handlers.
