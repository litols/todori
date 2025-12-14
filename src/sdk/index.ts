/**
 * Todori SDK Integration
 *
 * Provides Claude Agent SDK integration for Todori task management.
 *
 * @example Basic usage with query
 * ```typescript
 * import { query } from "@anthropic-ai/claude-agent-sdk";
 * import { createTodoriServer } from "todori/sdk";
 *
 * const todoriServer = createTodoriServer({
 *   projectRoot: process.cwd(),
 * });
 *
 * const messages = query({
 *   prompt: "Create a task list for my project",
 *   options: {
 *     mcpServers: {
 *       todori: todoriServer,
 *     },
 *   },
 * });
 *
 * for await (const message of messages) {
 *   console.log(message);
 * }
 * ```
 *
 * @example Using the agent helpers
 * ```typescript
 * import { runTodoriPrompt } from "todori/sdk";
 *
 * const result = await runTodoriPrompt(
 *   "What is the next task I should work on?",
 *   { projectRoot: process.cwd() }
 * );
 *
 * console.log(result);
 * ```
 *
 * @module
 */

// Agent helpers
export { runTodoriAgent, runTodoriPrompt, type TodoriAgentOptions } from "./agent.js";
// Server factory
// Individual tool creators
export {
  createGetNextTaskTool,
  createGetTasksTool,
  createTodoriServer,
  createTodoWriteTool,
  createUpdateTaskStatusTool,
} from "./server.js";

// Types
export type {
  GetTasksParams,
  SdkTaskStatus,
  SdkToolResult,
  TodoriServerOptions,
  TodoWriteInput,
  TodoWriteItem,
  ToolDefinition,
  ToolHandler,
  UpdateTaskStatusParams,
} from "./types.js";
