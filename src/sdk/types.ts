/**
 * SDK integration types for Todori
 *
 * Types for defining tools that integrate with Claude Agent SDK
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ZodObject, ZodRawShape, z } from "zod";

/**
 * TodoWrite input item matching Claude Code's TodoWrite tool format
 */
export interface TodoWriteItem {
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm: string;
}

/**
 * TodoWrite input matching Claude Code's TodoWrite tool
 */
export interface TodoWriteInput {
  todos: TodoWriteItem[];
}

/**
 * Task status for SDK tools (subset compatible with TodoWrite)
 */
export type SdkTaskStatus = "pending" | "in_progress" | "completed";

/**
 * Generic tool handler type
 */
export type ToolHandler<T extends ZodRawShape> = (
  args: z.infer<ZodObject<T>>,
  extra: unknown,
) => Promise<CallToolResult>;

/**
 * Tool definition with Zod schema
 */
export interface ToolDefinition<T extends ZodRawShape = ZodRawShape> {
  name: string;
  description: string;
  inputSchema: T;
  handler: ToolHandler<T>;
}

/**
 * Options for creating the Todori MCP server
 */
export interface TodoriServerOptions {
  /**
   * Server name (default: "todori")
   */
  name?: string;
  /**
   * Server version (default: package version)
   */
  version?: string;
  /**
   * Project root directory for task storage
   */
  projectRoot: string;
}

/**
 * Result returned by SDK tools
 */
export interface SdkToolResult {
  success: boolean;
  message: string;
  data?: unknown;
}

/**
 * Task query parameters for get_tasks tool
 */
export interface GetTasksParams {
  status?: SdkTaskStatus;
  limit?: number;
}

/**
 * Update task status parameters
 */
export interface UpdateTaskStatusParams {
  taskId: string;
  status: SdkTaskStatus;
}
