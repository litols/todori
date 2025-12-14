/**
 * Todori SDK Server Factory
 *
 * Creates an in-process MCP server with all Todori tools registered
 */

import type { McpSdkServerConfigWithInstance } from "@anthropic-ai/claude-agent-sdk";
import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { createGetNextTaskTool } from "./tools/get-next-task.js";
import { createGetTasksTool } from "./tools/get-tasks.js";
import { createTodoWriteTool } from "./tools/todowrite.js";
import { createUpdateTaskStatusTool } from "./tools/update-task-status.js";
import type { TodoriServerOptions } from "./types.js";

/**
 * Default server name
 */
const DEFAULT_SERVER_NAME = "todori";

/**
 * Default server version
 */
const DEFAULT_SERVER_VERSION = "0.1.0";

/**
 * Create a Todori MCP server instance for use with Claude Agent SDK
 *
 * This creates an in-process MCP server with all Todori tools:
 * - todowrite: Create and update task lists
 * - get_tasks: Query tasks with filtering
 * - get_next_task: Get dependency-aware task recommendations
 * - update_task_status: Update individual task status
 *
 * @param options - Server configuration options
 * @returns MCP server configuration for use with SDK options.mcpServers
 *
 * @example
 * ```typescript
 * import { query } from "@anthropic-ai/claude-agent-sdk";
 * import { createTodoriServer } from "todori/sdk";
 *
 * const todoriServer = createTodoriServer({
 *   projectRoot: process.cwd(),
 * });
 *
 * const result = await query({
 *   prompt: "Create a task list for implementing a new feature",
 *   options: {
 *     mcpServers: {
 *       todori: todoriServer,
 *     },
 *   },
 * });
 * ```
 */
export function createTodoriServer(options: TodoriServerOptions): McpSdkServerConfigWithInstance {
  const { projectRoot, name = DEFAULT_SERVER_NAME, version = DEFAULT_SERVER_VERSION } = options;

  // Create tool instances bound to project root
  const todoWriteTool = createTodoWriteTool(projectRoot);
  const getTasksTool = createGetTasksTool(projectRoot);
  const getNextTaskTool = createGetNextTaskTool(projectRoot);
  const updateTaskStatusTool = createUpdateTaskStatusTool(projectRoot);

  // Create the MCP server with all tools
  return createSdkMcpServer({
    name,
    version,
    tools: [todoWriteTool, getTasksTool, getNextTaskTool, updateTaskStatusTool],
  });
}

export { createGetNextTaskTool } from "./tools/get-next-task.js";
export { createGetTasksTool } from "./tools/get-tasks.js";
/**
 * Re-export individual tool creators for custom server configurations
 */
export { createTodoWriteTool } from "./tools/todowrite.js";
export { createUpdateTaskStatusTool } from "./tools/update-task-status.js";
