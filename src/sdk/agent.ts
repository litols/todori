/**
 * Todori Agent Entry Point
 *
 * Example demonstrating Todori + Claude Agent SDK integration
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { createTodoriServer } from "./server.js";

/**
 * Options for running a Todori-enabled agent
 */
export interface TodoriAgentOptions {
  /**
   * Project root directory for task storage
   */
  projectRoot: string;
  /**
   * Model to use (defaults to claude-sonnet-4-5-20250929)
   */
  model?: string;
  /**
   * Maximum number of turns
   */
  maxTurns?: number;
  /**
   * Permission mode
   */
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions" | "plan" | "dontAsk";
  /**
   * Allow bypassing permissions (required for bypassPermissions mode)
   */
  allowDangerouslySkipPermissions?: boolean;
}

/**
 * Run a query with Todori task management enabled
 *
 * @param prompt - The prompt to run
 * @param options - Agent configuration options
 * @returns AsyncGenerator of SDK messages
 *
 * @example
 * ```typescript
 * import { runTodoriAgent } from "todori/sdk";
 *
 * const messages = runTodoriAgent(
 *   "Create a task list for implementing user authentication",
 *   { projectRoot: process.cwd() }
 * );
 *
 * for await (const message of messages) {
 *   if (message.type === "result") {
 *     console.log("Result:", message.result);
 *   }
 * }
 * ```
 */
export function runTodoriAgent(prompt: string, options: TodoriAgentOptions) {
  const {
    projectRoot,
    model = "claude-sonnet-4-5-20250929",
    maxTurns,
    permissionMode,
    allowDangerouslySkipPermissions,
  } = options;

  // Create Todori MCP server
  const todoriServer = createTodoriServer({ projectRoot });

  // Run query with Todori tools enabled
  return query({
    prompt,
    options: {
      model,
      maxTurns,
      permissionMode,
      allowDangerouslySkipPermissions,
      mcpServers: {
        todori: todoriServer,
      },
    },
  });
}

/**
 * Run a simple one-shot query with Todori enabled
 *
 * @param prompt - The prompt to run
 * @param options - Agent configuration options
 * @returns The result message
 *
 * @example
 * ```typescript
 * import { runTodoriPrompt } from "todori/sdk";
 *
 * const result = await runTodoriPrompt(
 *   "What tasks are currently pending?",
 *   { projectRoot: process.cwd() }
 * );
 *
 * if (result.subtype === "success") {
 *   console.log(result.result);
 * }
 * ```
 */
export async function runTodoriPrompt(
  prompt: string,
  options: TodoriAgentOptions,
): Promise<{
  success: boolean;
  result?: string;
  error?: string;
}> {
  try {
    const messages = runTodoriAgent(prompt, options);

    for await (const message of messages) {
      if (message.type === "result") {
        if (message.subtype === "success") {
          return {
            success: true,
            result: message.result,
          };
        }
        return {
          success: false,
          error: message.errors?.join(", ") || "Unknown error",
        };
      }
    }

    return {
      success: false,
      error: "No result received",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
