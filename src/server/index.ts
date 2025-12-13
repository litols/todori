#!/usr/bin/env node

/**
 * Todori MCP Server Entry Point
 *
 * Implements MCP server using @modelcontextprotocol/sdk
 * Provides tools and prompts for Claude Code integration.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import process from "node:process";
import { detectProjectRoot, initializeProject } from "../integration/project-detect.js";
import { TaskStore } from "../storage/task-store.js";
import { TaskManager } from "../core/task-manager.js";
import { QueryEngine } from "../core/query.js";
import { getToolSchemas, ToolHandlers, type ToolName } from "./tools.js";
import {
  getPromptSchemas,
  PromptHandlers,
  type PromptName,
  type PromptContext,
} from "./prompts.js";

/**
 * Server version
 */
const SERVER_VERSION = "1.0.0";

/**
 * Main server initialization and setup
 */
async function main() {
  try {
    // Detect project root
    const cwd = process.cwd();
    const projectRoot = await detectProjectRoot(cwd);

    if (!projectRoot) {
      console.error(
        "[Todori] Could not detect project root. Looking for .git or .todori directory.",
      );
      console.error(`[Todori] Searched from: ${cwd}`);
      process.exit(1);
    }

    console.error(`[Todori] Project root detected: ${projectRoot}`);

    // Initialize project if needed (creates .todori directory)
    await initializeProject(projectRoot);

    // Initialize storage and core components
    const taskStore = new TaskStore(projectRoot);
    const taskManager = new TaskManager(taskStore);
    const queryEngine = new QueryEngine(taskManager);

    console.error("[Todori] Server initialized successfully");

    // Create MCP server
    const server = new Server(
      {
        name: "todori",
        version: SERVER_VERSION,
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
        },
      },
    );

    // Register tools/list handler
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: getToolSchemas(),
      };
    });

    // Register tools/call handler
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name as ToolName;
      const handler = ToolHandlers[toolName];

      if (!handler) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      const context = {
        taskManager,
        queryEngine,
        projectRoot,
      };

      const result = await handler(request.params.arguments || {}, context);

      if (!result.success) {
        throw new Error(result.error?.message || "Tool execution failed");
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
    });

    // Register prompts/list handler
    server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: getPromptSchemas(),
      };
    });

    // Register prompts/get handler
    server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const promptName = request.params.name as PromptName;
      const handler = PromptHandlers[promptName];

      if (!handler) {
        throw new Error(`Unknown prompt: ${promptName}`);
      }

      const context: PromptContext = {
        taskManager,
        queryEngine,
        projectRoot,
      };

      let content: string;

      // Handle prompts with different signatures
      if (promptName === "task_context") {
        const taskId = request.params.arguments?.taskId as string;
        if (!taskId) {
          throw new Error("task_context prompt requires taskId argument");
        }
        content = await (handler as (taskId: string, context: PromptContext) => Promise<string>)(
          taskId,
          context,
        );
      } else {
        content = await (handler as (context: PromptContext) => Promise<string>)(context);
      }

      return {
        description: `${promptName} prompt result`,
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: content,
            },
          },
        ],
      };
    });

    // Setup graceful shutdown
    process.on("SIGINT", async () => {
      console.error("[Todori] Received SIGINT, shutting down gracefully...");
      await server.close();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.error("[Todori] Received SIGTERM, shutting down gracefully...");
      await server.close();
      process.exit(0);
    });

    // Create stdio transport and connect
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error("[Todori] MCP server running on stdio");
  } catch (error) {
    console.error("[Todori] Fatal error:", error);
    process.exit(1);
  }
}

// Run the server
main();
