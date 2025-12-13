# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Todori** is a Claude Code-native task management MCP (Model Context Protocol) server designed to provide persistent, structured task management with minimal context window overhead.

**Key Design Principles:**
- **Claude Code Integration First**: Uses Claude Code's context understanding rather than direct API calls for AI-driven task expansion
- **Minimal Context**: MCP responses target <2KB average (1/10th of Task Master) to preserve Claude Code's context window
- **YAML Storage**: Human-readable, git-friendly YAML files instead of JSON for better diff visibility and comment support
- **No External Dependencies**: Zero database dependencies, runs on Bun for performance

## Architecture

The codebase follows the **RPG (Repository Planning Graph) methodology** with explicit dependency ordering:

### Module Dependency Layers (Build Order)

1. **Foundation (Phase 0)**: `types/`, `storage/schema.ts`
2. **Storage (Phase 1)**: `storage/file-io.ts`, `storage/task-store.ts`
3. **Core Logic (Phase 2)**: `core/task-manager.ts`, `core/dependency.ts`, `core/query.ts`
4. **Integration (Phase 3)**: `integration/project-detect.ts`, `integration/session-restore.ts`
5. **Expansion & Commands (Phase 4)**: `expand/*`, `commands/*`
6. **MCP Server (Phase 5)**: `server/*`

### Key Components

```
src/
├── server/          # MCP server (stdio transport)
├── storage/         # YAML-based persistence with atomic writes
├── core/            # Task CRUD, dependency graph (topological sort), query engine
├── expand/          # Claude Code-driven task breakdown
│   ├── prompt-builder.ts    # Generates prompts FOR Claude Code
│   ├── context.ts           # Collects project context
│   ├── response-parser.ts   # Parses Claude Code's natural language responses
│   └── subtask-gen.ts       # Persists parsed subtasks
├── commands/        # Claude Code custom commands (.claude/commands/)
└── integration/     # Project detection, session restore
```

## Task Data Model

```typescript
interface Task {
  id: string;                    // UUID
  title: string;
  description?: string;
  status: TaskStatus;            // pending | in-progress | blocked | done | deferred | cancelled
  priority: number;              // 0-100, auto-computed from dependencies
  dependencies: string[];        // Task IDs this depends on
  subtasks: Subtask[];
  metadata: {
    created: ISO8601;
    updated: ISO8601;
    completedAt?: ISO8601;
  };
}
```

**Storage Location**: `.todori/tasks.yaml` (YAML format for human readability and git diffs)

## Development Setup

**Runtime**: Bun 1.3.4 (managed via mise)
```bash
mise install  # Installs Bun 1.3.4
```

**No package.json yet** - this is early-stage PRD-driven development. Implementation follows the phased approach defined in `prd.txt`.

## Task Master Integration

This project uses Task Master for project planning:

```bash
# Generate tasks from PRD (already configured)
task-master parse-prd --input=prd.txt --force

# View tasks
task-master list

# Get next task based on dependencies
task-master next

# Expand a task into subtasks
task-master expand <task-id>
```

**Task Master Config**: `.taskmaster/config.json`
- Uses Claude Code provider for AI operations
- Response language: Japanese
- Default: 10 tasks, 5 subtasks per expansion

## Critical Design Decisions

### Why YAML over JSON?
- Human-readable with better indentation
- Supports comments (inline task notes)
- Git diffs are more readable
- Hierarchical structures are cleaner

### Why Claude Code-driven expansion (not direct API)?
- No API key management required
- Leverages Claude Code's existing codebase context
- Simpler architecture (prompt generation → response parsing)
- Avoids Task Master's API complexity

### Why Minimal MCP Responses?
- Task Master's large responses consume Claude Code's context window
- Target: <2KB average response size
- Use field selection, pagination, summary modes
- Only return what's needed for the current operation

## MCP Custom Commands

Once implemented, these will be available in `.claude/commands/`:

- `/todori-expand <task-id>` - Break down a task into subtasks (uses Claude Code to generate)
- `/todori-next` - Get next task based on dependencies
- `/todori-status` - Show project task overview

## Implementation Notes

### Dependency Graph Algorithm
- Uses **Kahn's algorithm** for topological sorting
- Cycle detection prevents circular dependencies
- `getNextTask()` returns first unblocked task in dependency order

### Atomic File Operations
Storage layer uses temp file + rename pattern to prevent data loss:
1. Write to `.todori/tasks.yaml.tmp`
2. Atomic rename to `.todori/tasks.yaml`
3. File locking for concurrent access

### Response Parser Design
The `expand/response-parser.ts` module must handle:
- Various natural language response formats from Claude Code
- Graceful degradation (fallback to manual subtask creation)
- Structured extraction of: task title, description, dependencies

## Testing Strategy

- **60%** Unit tests (pure functions, mocked I/O)
- **30%** Integration tests (real filesystem, temp dirs)
- **10%** E2E MCP tests (stdio transport, actual Claude Code interaction)

**Critical paths** (storage, dependency validation) require 100% coverage.

## Project Status

🚧 **Early Stage**: Currently in PRD phase with Task Master-generated tasks.

**Next Steps** (from PRD Phase 0):
1. Define TypeScript types (`types/task.ts`, `types/mcp.ts`)
2. Create YAML schema for validation
3. Implement storage layer with atomic file I/O
4. Build core task manager (CRUD + dependency graph)

See `prd.txt` for complete functional decomposition and phased implementation roadmap.
