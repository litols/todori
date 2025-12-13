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

## Rule
- Please make git commits at appropriate intervals. DON'T touch .gitignore files.
- you need to run taskmaster tasks with sub-agent. sub-agent is not shared context window, so you need to give a properly context with tasks.
