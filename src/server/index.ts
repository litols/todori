#!/usr/bin/env node

/**
 * Todori MCP Server Entry Point
 *
 * Implements JSON-RPC 2.0 protocol over stdio for task management.
 * Provides tools and prompts for Claude Code integration.
 */

import process from "node:process";
import { detectProjectRoot, initializeProject } from "../integration/project-detect.js";
import { TaskStore } from "../storage/task-store.js";
import { TaskManager } from "../core/task-manager.js";
import { QueryEngine } from "../core/query.js";
import { StdioTransport } from "./transport.js";
import { getToolSchemas, ToolHandlers, type ToolName } from "./tools.js";
import {
  getPromptSchemas,
  PromptHandlers,
  type PromptName,
  type PromptContext,
} from "./prompts.js";
import type {
  MCPRequest,
  MCPResponse,
  MCPInitializeParams,
  MCPInitializeResult,
  MCPToolCallParams,
  MCPPromptGetParams,
} from "../types/mcp.js";
import {
  methodNotFound,
  invalidParams,
  internalError,
  projectRootNotFound,
} from "./error-handler.js";

/**
 * Server version
 */
const SERVER_VERSION = "1.0.0";

/**
 * MCP protocol version
 */
const PROTOCOL_VERSION = "2024-11-05";

/**
 * Main server class
 */
class TodoriMCPServer {
  private transport: StdioTransport;
  private taskManager?: TaskManager;
  private queryEngine?: QueryEngine;
  private projectRoot?: string;
  private initialized = false;

  constructor() {
    this.transport = new StdioTransport();
  }

  /**
   * Initialize the server with project root detection
   */
  async initialize(): Promise<void> {
    try {
      // Detect project root
      const cwd = process.cwd();
      const root = await detectProjectRoot(cwd);

      if (!root) {
        console.error(
          "[Todori] Could not detect project root. Looking for .git or .todori directory.",
        );
        console.error(`[Todori] Searched from: ${cwd}`);
        throw new Error("Project root not found");
      }

      this.projectRoot = root;
      console.error(`[Todori] Project root detected: ${root}`);

      // Initialize project if needed (creates .todori directory)
      await initializeProject(root);

      // Initialize storage and core components
      const taskStore = new TaskStore(root);
      this.taskManager = new TaskManager(taskStore);
      this.queryEngine = new QueryEngine(this.taskManager);

      console.error("[Todori] Server initialized successfully");
    } catch (error) {
      console.error(`[Todori] Initialization failed:`, error);
      throw error;
    }
  }

  /**
   * Handle MCP initialize request
   */
  private handleInitialize(
    id: string | number,
    params: unknown,
  ): MCPResponse {
    // Validate params (optional for initialize)
    const initParams = params as Partial<MCPInitializeParams>;

    // Mark as initialized
    this.initialized = true;

    const result: MCPInitializeResult = {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {
        tools: getToolSchemas(),
        prompts: getPromptSchemas(),
      },
      serverInfo: {
        name: "todori",
        version: SERVER_VERSION,
      },
    };

    console.error(
      `[Todori] Initialize handshake completed (client: ${initParams?.clientInfo?.name || "unknown"})`,
    );

    return {
      jsonrpc: "2.0",
      id,
      result,
    };
  }

  /**
   * Handle tools/list request
   */
  private handleToolsList(id: string | number): MCPResponse {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: getToolSchemas(),
      },
    };
  }

  /**
   * Handle tools/call request
   */
  private async handleToolsCall(
    id: string | number,
    params: unknown,
  ): Promise<MCPResponse> {
    if (!this.taskManager || !this.queryEngine || !this.projectRoot) {
      return {
        jsonrpc: "2.0",
        id,
        error: internalError("Server not initialized"),
      };
    }

    const toolParams = params as MCPToolCallParams;

    if (!toolParams.name) {
      return {
        jsonrpc: "2.0",
        id,
        error: invalidParams("Missing tool name"),
      };
    }

    const toolName = toolParams.name as ToolName;
    const handler = ToolHandlers[toolName];

    if (!handler) {
      return {
        jsonrpc: "2.0",
        id,
        error: methodNotFound(toolName),
      };
    }

    try {
      const context = {
        taskManager: this.taskManager,
        queryEngine: this.queryEngine,
        projectRoot: this.projectRoot,
      };

      const result = await handler(toolParams.arguments || {}, context);

      if (!result.success) {
        return {
          jsonrpc: "2.0",
          id,
          error: result.error,
        };
      }

      return {
        jsonrpc: "2.0",
        id,
        result: result.data,
      };
    } catch (error) {
      console.error(`[Todori] Tool execution error (${toolName}):`, error);
      return {
        jsonrpc: "2.0",
        id,
        error: internalError(
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      };
    }
  }

  /**
   * Handle prompts/list request
   */
  private handlePromptsList(id: string | number): MCPResponse {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        prompts: getPromptSchemas(),
      },
    };
  }

  /**
   * Handle prompts/get request
   */
  private async handlePromptsGet(
    id: string | number,
    params: unknown,
  ): Promise<MCPResponse> {
    if (!this.taskManager || !this.queryEngine || !this.projectRoot) {
      return {
        jsonrpc: "2.0",
        id,
        error: internalError("Server not initialized"),
      };
    }

    const promptParams = params as MCPPromptGetParams;

    if (!promptParams.name) {
      return {
        jsonrpc: "2.0",
        id,
        error: invalidParams("Missing prompt name"),
      };
    }

    const promptName = promptParams.name as PromptName;
    const handler = PromptHandlers[promptName];

    if (!handler) {
      return {
        jsonrpc: "2.0",
        id,
        error: methodNotFound(promptName),
      };
    }

    try {
      const context: PromptContext = {
        taskManager: this.taskManager,
        queryEngine: this.queryEngine,
        projectRoot: this.projectRoot,
      };

      let content: string;

      // Handle prompts with different signatures
      if (promptName === "task_context") {
        const taskId = promptParams.arguments?.taskId as string;
        if (!taskId) {
          return {
            jsonrpc: "2.0",
            id,
            error: invalidParams("task_context prompt requires taskId argument"),
          };
        }
        content = await (handler as (taskId: string, context: PromptContext) => Promise<string>)(taskId, context);
      } else {
        content = await (handler as (context: PromptContext) => Promise<string>)(context);
      }

      return {
        jsonrpc: "2.0",
        id,
        result: {
          description: `${promptName} prompt result`,
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: content,
              },
            },
          ],
        },
      };
    } catch (error) {
      console.error(`[Todori] Prompt execution error (${promptName}):`, error);
      return {
        jsonrpc: "2.0",
        id,
        error: internalError(
          `Prompt execution failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      };
    }
  }

  /**
   * Handle incoming MCP request
   */
  private async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    const { method, id, params } = request;

    console.error(`[Todori] Received request: ${method} (id: ${id})`);

    try {
      switch (method) {
        case "initialize":
          return this.handleInitialize(id, params);

        case "tools/list":
          return this.handleToolsList(id);

        case "tools/call":
          return await this.handleToolsCall(id, params);

        case "prompts/list":
          return this.handlePromptsList(id);

        case "prompts/get":
          return await this.handlePromptsGet(id, params);

        default:
          return {
            jsonrpc: "2.0",
            id,
            error: methodNotFound(method),
          };
      }
    } catch (error) {
      console.error(`[Todori] Request handling error:`, error);
      return {
        jsonrpc: "2.0",
        id,
        error: internalError(
          error instanceof Error ? error.message : String(error),
        ),
      };
    }
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    console.error("[Todori] Starting MCP server...");

    // Register request handler
    this.transport.onRequest(async (request) => {
      return await this.handleRequest(request);
    });

    // Setup graceful shutdown
    process.on("SIGINT", () => {
      console.error("[Todori] Received SIGINT, shutting down gracefully...");
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      console.error("[Todori] Received SIGTERM, shutting down gracefully...");
      process.exit(0);
    });

    // Start listening on stdio
    console.error("[Todori] Listening for requests on stdin...");
    await this.transport.listen();
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    const server = new TodoriMCPServer();

    // Initialize server (detect project root, setup storage)
    await server.initialize();

    // Start listening for requests
    await server.start();
  } catch (error) {
    console.error("[Todori] Fatal error:", error);
    process.exit(1);
  }
}

// Run the server
main();
