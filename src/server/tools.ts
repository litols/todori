/**
 * MCP Tool Handlers - Main Export Module
 *
 * Re-exports all tool-related functionality from focused submodules.
 * This file maintains backward compatibility while the implementation
 * has been split into:
 *   - tools/schemas.ts: Zod validation schemas
 *   - tools/handlers.ts: Tool handler implementations
 *   - tools/registry.ts: Handler registry
 *   - tools/mcp-schemas.ts: MCP schema definitions
 */

// Re-export all handler functions and types
export type { ToolContext, ToolResult } from "./tools/handlers.js";
export {
  handleAddSubtask,
  handleCreateTask,
  handleDeleteSubtask,
  handleDeleteTask,
  handleGetNextTask,
  handleGetTask,
  handleGetTasks,
  handleGetTaskStats,
  handleQueryTasks,
  handleUpdateSubtask,
  handleUpdateTask,
} from "./tools/handlers.js";

// Re-export registry
export type { ToolName } from "./tools/registry.js";
export { ToolHandlers } from "./tools/registry.js";

// Re-export MCP schema generator
export { getToolSchemas } from "./tools/mcp-schemas.js";

// Re-export validation schemas (useful for testing)
export {
  AddSubtaskSchema,
  CreateTaskSchema,
  DeleteSubtaskSchema,
  DeleteTaskSchema,
  GetNextTaskSchema,
  GetTaskSchema,
  GetTasksSchema,
  GetTaskStatsSchema,
  PrioritySchema,
  QueryTasksSchema,
  TaskStatusSchema,
  UpdateSubtaskSchema,
  UpdateTaskSchema,
} from "./tools/schemas.js";
