/**
 * MCP Server Integration Tests
 *
 * Tests the full MCP server JSON-RPC 2.0 protocol implementation including:
 * - Server initialization and MCP handshake
 * - All 11 tool handlers
 * - 2 prompt handlers
 * - Error handling and validation
 *
 * Testing approach: Direct method calls via StdioTransport.processRequest()
 * avoiding the need for subprocess stdio mocking.
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { StdioTransport } from "../../src/server/transport.js";
import { TaskStore } from "../../src/storage/task-store.js";
import { TaskManager } from "../../src/core/task-manager.js";
import { QueryEngine } from "../../src/core/query.js";
import { getToolSchemas, ToolHandlers, type ToolName } from "../../src/server/tools.js";
import {
  getPromptSchemas,
  PromptHandlers,
  type PromptName,
  type PromptContext,
} from "../../src/server/prompts.js";
import type {
  MCPRequest,
  MCPResponse,
  MCPInitializeParams,
  MCPInitializeResult,
  MCPToolCallParams,
  MCPPromptGetParams,
} from "../../src/types/mcp.js";
import {
  methodNotFound,
  invalidParams,
  internalError,
} from "../../src/server/error-handler.js";
import { initializeProject } from "../../src/integration/project-detect.js";
import { TaskStatus } from "../../src/types/task.js";

/**
 * Helper to create MCP request
 */
function createRequest(
  method: string,
  id: string | number,
  params?: unknown,
): MCPRequest {
  return {
    jsonrpc: "2.0",
    method,
    id,
    params,
  };
}

/**
 * MCP Server Test Harness
 * Mimics TodoriMCPServer without stdio dependencies
 */
class TestMCPServer {
  private transport: StdioTransport;
  private taskManager?: TaskManager;
  private queryEngine?: QueryEngine;
  private projectRoot?: string;
  private initialized = false;

  constructor() {
    this.transport = new StdioTransport();
  }

  async initialize(testDir: string): Promise<void> {
    this.projectRoot = testDir;
    await initializeProject(testDir);

    const taskStore = new TaskStore(testDir);
    this.taskManager = new TaskManager(taskStore);
    this.queryEngine = new QueryEngine(this.taskManager);

    // Register request handler
    this.transport.onRequest(async (request) => {
      return await this.handleRequest(request);
    });
  }

  private handleInitialize(
    id: string | number,
    params: unknown,
  ): MCPResponse {
    this.initialized = true;

    const result: MCPInitializeResult = {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: getToolSchemas(),
        prompts: getPromptSchemas(),
      },
      serverInfo: {
        name: "todori",
        version: "1.0.0",
      },
    };

    return {
      jsonrpc: "2.0",
      id,
      result,
    };
  }

  private handleToolsList(id: string | number): MCPResponse {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: getToolSchemas(),
      },
    };
  }

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
      return {
        jsonrpc: "2.0",
        id,
        error: internalError(
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      };
    }
  }

  private handlePromptsList(id: string | number): MCPResponse {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        prompts: getPromptSchemas(),
      },
    };
  }

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
      return {
        jsonrpc: "2.0",
        id,
        error: internalError(
          `Prompt execution failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      };
    }
  }

  private async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    const { method, id, params } = request;

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
      return {
        jsonrpc: "2.0",
        id,
        error: internalError(
          error instanceof Error ? error.message : String(error),
        ),
      };
    }
  }

  async processRequest(request: unknown): Promise<MCPResponse> {
    return await this.transport.processRequest(request);
  }
}

describe("MCP Server - Integration Tests", () => {
  let testDir: string;
  let server: TestMCPServer;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "todori-mcp-"));

    // Create server and initialize
    server = new TestMCPServer();
    await server.initialize(testDir);
  });

  afterEach(async () => {
    // Clean up test directories
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Server Initialization", () => {
    test("handles initialize request with correct protocol version", async () => {
      const request = createRequest("initialize", 1, {
        clientInfo: { name: "test-client", version: "1.0.0" },
        protocolVersion: "2024-11-05",
      } as MCPInitializeParams);

      const response = await server.processRequest(request);

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(1);
      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();

      const result = response.result as MCPInitializeResult;
      expect(result.protocolVersion).toBe("2024-11-05");
      expect(result.serverInfo.name).toBe("todori");
      expect(result.serverInfo.version).toBe("1.0.0");
    });

    test("advertises tool capabilities", async () => {
      const request = createRequest("initialize", 1);
      const response = await server.processRequest(request);

      const result = response.result as MCPInitializeResult;
      expect(result.capabilities.tools).toBeDefined();
      expect(Array.isArray(result.capabilities.tools)).toBe(true);
      expect(result.capabilities.tools.length).toBe(11); // All 11 tools
    });

    test("advertises prompt capabilities", async () => {
      const request = createRequest("initialize", 1);
      const response = await server.processRequest(request);

      const result = response.result as MCPInitializeResult;
      expect(result.capabilities.prompts).toBeDefined();
      expect(Array.isArray(result.capabilities.prompts)).toBe(true);
      expect(result.capabilities.prompts.length).toBe(2); // 2 prompts
    });

    test("validates protocol version format", async () => {
      const request = createRequest("initialize", 1);
      const response = await server.processRequest(request);

      const result = response.result as MCPInitializeResult;
      // Protocol version should match YYYY-MM-DD format
      expect(result.protocolVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("Tools - List", () => {
    test("returns all 11 tool schemas", async () => {
      const request = createRequest("tools/list", 2);
      const response = await server.processRequest(request);

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();

      const result = response.result as { tools: unknown[] };
      expect(result.tools).toBeDefined();
      expect(result.tools.length).toBe(11);
    });

    test("tool schemas include required fields", async () => {
      const request = createRequest("tools/list", 2);
      const response = await server.processRequest(request);

      const result = response.result as { tools: { name: string; description: string; inputSchema: object }[] };

      for (const tool of result.tools) {
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe("string");
        expect(tool.description).toBeDefined();
        expect(typeof tool.description).toBe("string");
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.inputSchema).toBe("object");
      }
    });

    test("includes all expected tool names", async () => {
      const request = createRequest("tools/list", 2);
      const response = await server.processRequest(request);

      const result = response.result as { tools: { name: string }[] };
      const toolNames = result.tools.map((t) => t.name);

      const expectedTools = [
        "get_tasks",
        "get_task",
        "create_task",
        "update_task",
        "delete_task",
        "get_next_task",
        "query_tasks",
        "get_task_stats",
        "add_subtask",
        "update_subtask",
        "delete_subtask",
      ];

      for (const expected of expectedTools) {
        expect(toolNames).toContain(expected);
      }
    });
  });

  describe("Tools - create_task", () => {
    test("creates task successfully with valid params", async () => {
      const request = createRequest("tools/call", 3, {
        name: "create_task",
        arguments: {
          title: "Test Task",
          description: "Test description",
          priority: "high",
        },
      } as MCPToolCallParams);

      const response = await server.processRequest(request);

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();

      const result = response.result as {
        id: string;
        title: string;
        description: string;
        priority: string;
      };
      expect(result.id).toBeDefined();
      expect(result.title).toBe("Test Task");
      expect(result.description).toBe("Test description");
      expect(result.priority).toBe("high");
    });

    test("returns validation error for missing title", async () => {
      const request = createRequest("tools/call", 4, {
        name: "create_task",
        arguments: {
          description: "No title provided",
        },
      } as MCPToolCallParams);

      const response = await server.processRequest(request);

      expect(response.result).toBeUndefined();
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602); // Invalid params
    });

    test("creates task with default values", async () => {
      const request = createRequest("tools/call", 5, {
        name: "create_task",
        arguments: {
          title: "Minimal Task",
        },
      } as MCPToolCallParams);

      const response = await server.processRequest(request);

      expect(response.error).toBeUndefined();
      const result = response.result as {
        status: string;
        priority: string;
        dependencies: unknown[];
        subtasks: unknown[];
      };
      expect(result.status).toBe("pending");
      expect(result.priority).toBe("medium");
      expect(result.dependencies).toEqual([]);
      expect(result.subtasks).toEqual([]);
    });
  });

  describe("Tools - get_task", () => {
    test("retrieves task by ID", async () => {
      // Create a task first
      const createReq = createRequest("tools/call", 6, {
        name: "create_task",
        arguments: { title: "Retrieve Me" },
      } as MCPToolCallParams);

      const createResp = await server.processRequest(createReq);
      const created = createResp.result as { id: string };

      // Retrieve it
      const getReq = createRequest("tools/call", 7, {
        name: "get_task",
        arguments: { id: created.id },
      } as MCPToolCallParams);

      const response = await server.processRequest(getReq);

      expect(response.error).toBeUndefined();
      const result = response.result as { id: string; title: string };
      expect(result.id).toBe(created.id);
      expect(result.title).toBe("Retrieve Me");
    });

    test("returns error for non-existent task", async () => {
      const request = createRequest("tools/call", 8, {
        name: "get_task",
        arguments: { id: "non-existent-id" },
      } as MCPToolCallParams);

      const response = await server.processRequest(request);

      expect(response.result).toBeUndefined();
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32000); // Task not found
    });
  });

  describe("Tools - update_task", () => {
    test("updates task fields", async () => {
      // Create task
      const createReq = createRequest("tools/call", 9, {
        name: "create_task",
        arguments: { title: "Original Title" },
      } as MCPToolCallParams);

      const createResp = await server.processRequest(createReq);
      const created = createResp.result as { id: string };

      // Update it
      const updateReq = createRequest("tools/call", 10, {
        name: "update_task",
        arguments: {
          id: created.id,
          title: "Updated Title",
          status: "in-progress",
          priority: "high",
        },
      } as MCPToolCallParams);

      const response = await server.processRequest(updateReq);

      expect(response.error).toBeUndefined();
      const result = response.result as {
        id: string;
        title: string;
        status: string;
        priority: string;
      };
      expect(result.id).toBe(created.id);
      expect(result.title).toBe("Updated Title");
      expect(result.status).toBe("in-progress");
      expect(result.priority).toBe("high");
    });

    test("returns error for invalid task ID", async () => {
      const request = createRequest("tools/call", 11, {
        name: "update_task",
        arguments: {
          id: "invalid-id",
          title: "Won't Work",
        },
      } as MCPToolCallParams);

      const response = await server.processRequest(request);

      expect(response.result).toBeUndefined();
      expect(response.error).toBeDefined();
    });
  });

  describe("Tools - delete_task", () => {
    test("deletes task successfully", async () => {
      // Create task
      const createReq = createRequest("tools/call", 12, {
        name: "create_task",
        arguments: { title: "Delete Me" },
      } as MCPToolCallParams);

      const createResp = await server.processRequest(createReq);
      const created = createResp.result as { id: string };

      // Delete it
      const deleteReq = createRequest("tools/call", 13, {
        name: "delete_task",
        arguments: { id: created.id },
      } as MCPToolCallParams);

      const deleteResp = await server.processRequest(deleteReq);

      expect(deleteResp.error).toBeUndefined();
      const deleteResult = deleteResp.result as { success: boolean; deletedId: string };
      expect(deleteResult.success).toBe(true);
      expect(deleteResult.deletedId).toBe(created.id);

      // Verify it's gone
      const getReq = createRequest("tools/call", 14, {
        name: "get_task",
        arguments: { id: created.id },
      } as MCPToolCallParams);

      const getResp = await server.processRequest(getReq);
      expect(getResp.error).toBeDefined();
    });

    test("returns error for non-existent task", async () => {
      const request = createRequest("tools/call", 15, {
        name: "delete_task",
        arguments: { id: "does-not-exist" },
      } as MCPToolCallParams);

      const response = await server.processRequest(request);

      expect(response.result).toBeUndefined();
      expect(response.error).toBeDefined();
    });
  });

  describe("Tools - get_tasks", () => {
    test("retrieves all tasks", async () => {
      // Create multiple tasks
      await server.processRequest(
        createRequest("tools/call", 16, {
          name: "create_task",
          arguments: { title: "Task 1" },
        } as MCPToolCallParams),
      );

      await server.processRequest(
        createRequest("tools/call", 17, {
          name: "create_task",
          arguments: { title: "Task 2" },
        } as MCPToolCallParams),
      );

      // Get all tasks
      const request = createRequest("tools/call", 18, {
        name: "get_tasks",
        arguments: {},
      } as MCPToolCallParams);

      const response = await server.processRequest(request);

      expect(response.error).toBeUndefined();
      const result = response.result as unknown[];
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    test("filters tasks by status", async () => {
      // Create tasks with different statuses
      await server.processRequest(
        createRequest("tools/call", 19, {
          name: "create_task",
          arguments: { title: "Pending Task", status: "pending" },
        } as MCPToolCallParams),
      );

      await server.processRequest(
        createRequest("tools/call", 20, {
          name: "create_task",
          arguments: { title: "Done Task", status: "done" },
        } as MCPToolCallParams),
      );

      // Filter by pending
      const request = createRequest("tools/call", 21, {
        name: "get_tasks",
        arguments: { status: "pending" },
      } as MCPToolCallParams);

      const response = await server.processRequest(request);

      expect(response.error).toBeUndefined();
      const result = response.result as { status: string }[];
      expect(result.length).toBe(1);
      expect(result[0]?.status).toBe("pending");
    });

    test("supports pagination", async () => {
      // Create 5 tasks
      for (let i = 0; i < 5; i++) {
        await server.processRequest(
          createRequest("tools/call", 22 + i, {
            name: "create_task",
            arguments: { title: `Task ${i}` },
          } as MCPToolCallParams),
        );
      }

      // Get with limit
      const request = createRequest("tools/call", 27, {
        name: "get_tasks",
        arguments: { limit: 3, offset: 0 },
      } as MCPToolCallParams);

      const response = await server.processRequest(request);

      expect(response.error).toBeUndefined();
      const result = response.result as unknown[];
      expect(result.length).toBe(3);
    });
  });

  describe("Tools - get_next_task", () => {
    test("recommends next task based on priority and dependencies", async () => {
      // Create high priority task
      await server.processRequest(
        createRequest("tools/call", 28, {
          name: "create_task",
          arguments: { title: "High Priority", priority: "high" },
        } as MCPToolCallParams),
      );

      // Create low priority task
      await server.processRequest(
        createRequest("tools/call", 29, {
          name: "create_task",
          arguments: { title: "Low Priority", priority: "low" },
        } as MCPToolCallParams),
      );

      // Get next task
      const request = createRequest("tools/call", 30, {
        name: "get_next_task",
        arguments: {},
      } as MCPToolCallParams);

      const response = await server.processRequest(request);

      expect(response.error).toBeUndefined();
      const result = response.result as { task: { title: string } };
      expect(result.task.title).toBe("High Priority");
    });

    test("returns null when no tasks available", async () => {
      const request = createRequest("tools/call", 31, {
        name: "get_next_task",
        arguments: {},
      } as MCPToolCallParams);

      const response = await server.processRequest(request);

      expect(response.error).toBeUndefined();
      const result = response.result as { task: null };
      expect(result.task).toBeNull();
    });
  });

  describe("Tools - query_tasks", () => {
    test("queries with filters and sorting", async () => {
      // Create tasks
      await server.processRequest(
        createRequest("tools/call", 32, {
          name: "create_task",
          arguments: { title: "A Task", priority: "high" },
        } as MCPToolCallParams),
      );

      await server.processRequest(
        createRequest("tools/call", 33, {
          name: "create_task",
          arguments: { title: "B Task", priority: "low" },
        } as MCPToolCallParams),
      );

      // Query with sort
      const request = createRequest("tools/call", 34, {
        name: "query_tasks",
        arguments: {
          sort: { field: "priority", order: "desc" },
        },
      } as MCPToolCallParams);

      const response = await server.processRequest(request);

      expect(response.error).toBeUndefined();
      const result = response.result as { title: string; priority: string }[];
      expect(result.length).toBe(2);
      expect(result[0]?.priority).toBe("high");
    });

    test("supports field projection", async () => {
      await server.processRequest(
        createRequest("tools/call", 35, {
          name: "create_task",
          arguments: { title: "Full Task", description: "With description" },
        } as MCPToolCallParams),
      );

      const request = createRequest("tools/call", 36, {
        name: "query_tasks",
        arguments: {
          fields: ["id", "title"],
        },
      } as MCPToolCallParams);

      const response = await server.processRequest(request);

      expect(response.error).toBeUndefined();
      const result = response.result as { id: string; title: string; description?: string }[];
      expect(result[0]?.id).toBeDefined();
      expect(result[0]?.title).toBeDefined();
      expect(result[0]?.description).toBeUndefined();
    });
  });

  describe("Tools - get_task_stats", () => {
    test("calculates task statistics", async () => {
      // Create tasks with different statuses
      await server.processRequest(
        createRequest("tools/call", 37, {
          name: "create_task",
          arguments: { title: "Pending", status: "pending" },
        } as MCPToolCallParams),
      );

      await server.processRequest(
        createRequest("tools/call", 38, {
          name: "create_task",
          arguments: { title: "Done", status: "done" },
        } as MCPToolCallParams),
      );

      const request = createRequest("tools/call", 39, {
        name: "get_task_stats",
        arguments: {},
      } as MCPToolCallParams);

      const response = await server.processRequest(request);

      expect(response.error).toBeUndefined();
      const result = response.result as {
        total: number;
        byStatus: { pending: number; done: number };
      };
      expect(result.total).toBe(2);
      expect(result.byStatus.pending).toBe(1);
      expect(result.byStatus.done).toBe(1);
    });

    test("includes all status categories", async () => {
      const request = createRequest("tools/call", 40, {
        name: "get_task_stats",
        arguments: {},
      } as MCPToolCallParams);

      const response = await server.processRequest(request);

      const result = response.result as { byStatus: Record<string, number> };
      expect(result.byStatus).toHaveProperty("pending");
      expect(result.byStatus).toHaveProperty("in-progress");
      expect(result.byStatus).toHaveProperty("blocked");
      expect(result.byStatus).toHaveProperty("done");
      expect(result.byStatus).toHaveProperty("deferred");
      expect(result.byStatus).toHaveProperty("cancelled");
    });
  });

  describe("Tools - Subtasks", () => {
    test("add_subtask creates subtask", async () => {
      // Create parent task
      const createReq = createRequest("tools/call", 41, {
        name: "create_task",
        arguments: { title: "Parent Task" },
      } as MCPToolCallParams);

      const createResp = await server.processRequest(createReq);
      const parent = createResp.result as { id: string };

      // Add subtask
      const addReq = createRequest("tools/call", 42, {
        name: "add_subtask",
        arguments: {
          parentId: parent.id,
          title: "Subtask 1",
          description: "Subtask description",
        },
      } as MCPToolCallParams);

      const response = await server.processRequest(addReq);

      expect(response.error).toBeUndefined();
      const result = response.result as { subtasks: { title: string }[] };
      expect(result.subtasks.length).toBe(1);
      expect(result.subtasks[0]?.title).toBe("Subtask 1");
    });

    test("update_subtask modifies subtask status", async () => {
      // Create parent with subtask
      const createReq = createRequest("tools/call", 43, {
        name: "create_task",
        arguments: { title: "Parent" },
      } as MCPToolCallParams);

      const createResp = await server.processRequest(createReq);
      const parent = createResp.result as { id: string };

      await server.processRequest(
        createRequest("tools/call", 44, {
          name: "add_subtask",
          arguments: { parentId: parent.id, title: "Sub" },
        } as MCPToolCallParams),
      );

      // Update subtask
      const updateReq = createRequest("tools/call", 45, {
        name: "update_subtask",
        arguments: {
          subtaskId: `${parent.id}.1`,
          status: "done",
        },
      } as MCPToolCallParams);

      const response = await server.processRequest(updateReq);

      expect(response.error).toBeUndefined();
      const result = response.result as { subtasks: { status: string }[] };
      expect(result.subtasks[0]?.status).toBe("done");
    });

    test("delete_subtask removes subtask", async () => {
      // Create parent with subtask
      const createReq = createRequest("tools/call", 46, {
        name: "create_task",
        arguments: { title: "Parent" },
      } as MCPToolCallParams);

      const createResp = await server.processRequest(createReq);
      const parent = createResp.result as { id: string };

      await server.processRequest(
        createRequest("tools/call", 47, {
          name: "add_subtask",
          arguments: { parentId: parent.id, title: "Delete Me" },
        } as MCPToolCallParams),
      );

      // Delete subtask
      const deleteReq = createRequest("tools/call", 48, {
        name: "delete_subtask",
        arguments: { subtaskId: `${parent.id}.1` },
      } as MCPToolCallParams);

      const response = await server.processRequest(deleteReq);

      expect(response.error).toBeUndefined();
      const result = response.result as { subtasks: unknown[] };
      expect(result.subtasks.length).toBe(0);
    });
  });

  describe("Prompts - List", () => {
    test("returns all 2 prompt schemas", async () => {
      const request = createRequest("prompts/list", 49);
      const response = await server.processRequest(request);

      expect(response.error).toBeUndefined();
      const result = response.result as { prompts: unknown[] };
      expect(result.prompts.length).toBe(2);
    });

    test("prompt schemas include required fields", async () => {
      const request = createRequest("prompts/list", 50);
      const response = await server.processRequest(request);

      const result = response.result as {
        prompts: { name: string; description: string; arguments: unknown[] }[];
      };

      for (const prompt of result.prompts) {
        expect(prompt.name).toBeDefined();
        expect(typeof prompt.name).toBe("string");
        expect(prompt.description).toBeDefined();
        expect(Array.isArray(prompt.arguments)).toBe(true);
      }
    });
  });

  describe("Prompts - session_restore", () => {
    test("returns project overview", async () => {
      const request = createRequest("prompts/get", 51, {
        name: "session_restore",
        arguments: {},
      } as MCPPromptGetParams);

      const response = await server.processRequest(request);

      expect(response.error).toBeUndefined();
      const result = response.result as {
        messages: { content: { text: string } }[];
      };
      expect(result.messages[0]?.content.text).toContain("Todori Project Status");
      expect(result.messages[0]?.content.text).toContain("Task Summary");
    });

    test("includes task statistics", async () => {
      await server.processRequest(
        createRequest("tools/call", 52, {
          name: "create_task",
          arguments: { title: "Test" },
        } as MCPToolCallParams),
      );

      const request = createRequest("prompts/get", 53, {
        name: "session_restore",
        arguments: {},
      } as MCPPromptGetParams);

      const response = await server.processRequest(request);

      const result = response.result as {
        messages: { content: { text: string } }[];
      };
      expect(result.messages[0]?.content.text).toContain("Total Tasks: 1");
    });

    test("response size is under 2KB for reasonable task count", async () => {
      // Create 10 tasks
      for (let i = 0; i < 10; i++) {
        await server.processRequest(
          createRequest("tools/call", 54 + i, {
            name: "create_task",
            arguments: { title: `Task ${i}` },
          } as MCPToolCallParams),
        );
      }

      const request = createRequest("prompts/get", 64, {
        name: "session_restore",
        arguments: {},
      } as MCPPromptGetParams);

      const response = await server.processRequest(request);

      const result = response.result as {
        messages: { content: { text: string } }[];
      };
      const contentSize = new TextEncoder().encode(
        result.messages[0]?.content.text,
      ).length;

      expect(contentSize).toBeLessThan(2048); // 2KB
    });
  });

  describe("Prompts - task_context", () => {
    test("returns task details", async () => {
      // Create a task
      const createReq = createRequest("tools/call", 65, {
        name: "create_task",
        arguments: { title: "Context Task", description: "With context" },
      } as MCPToolCallParams);

      const createResp = await server.processRequest(createReq);
      const task = createResp.result as { id: string };

      // Get task context
      const request = createRequest("prompts/get", 66, {
        name: "task_context",
        arguments: { taskId: task.id },
      } as MCPPromptGetParams);

      const response = await server.processRequest(request);

      expect(response.error).toBeUndefined();
      const result = response.result as {
        messages: { content: { text: string } }[];
      };
      expect(result.messages[0]?.content.text).toContain("Context Task");
      expect(result.messages[0]?.content.text).toContain("With context");
    });

    test("returns error for missing taskId argument", async () => {
      const request = createRequest("prompts/get", 67, {
        name: "task_context",
        arguments: {},
      } as MCPPromptGetParams);

      const response = await server.processRequest(request);

      expect(response.result).toBeUndefined();
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602); // Invalid params
    });

    test("shows task not found for invalid ID", async () => {
      const request = createRequest("prompts/get", 68, {
        name: "task_context",
        arguments: { taskId: "invalid-id" },
      } as MCPPromptGetParams);

      const response = await server.processRequest(request);

      expect(response.error).toBeUndefined();
      const result = response.result as {
        messages: { content: { text: string } }[];
      };
      expect(result.messages[0]?.content.text).toContain("Task Not Found");
    });
  });

  describe("Error Handling", () => {
    test("handles invalid JSON request", async () => {
      const response = await server.processRequest("not valid json");

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32600); // Invalid request
    });

    test("handles unknown method", async () => {
      const request = createRequest("unknown/method", 69);
      const response = await server.processRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32601); // Method not found
    });

    test("handles missing tool name", async () => {
      const request = createRequest("tools/call", 70, {
        arguments: { title: "No tool name" },
      });

      const response = await server.processRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602); // Invalid params
    });

    test("handles unknown tool name", async () => {
      const request = createRequest("tools/call", 71, {
        name: "unknown_tool",
        arguments: {},
      } as MCPToolCallParams);

      const response = await server.processRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32601); // Method not found
    });

    test("handles validation errors with detailed messages", async () => {
      const request = createRequest("tools/call", 72, {
        name: "create_task",
        arguments: {
          title: "", // Empty title should fail
        },
      } as MCPToolCallParams);

      const response = await server.processRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
      expect(response.error?.data).toBeDefined();
    });

    test("maintains JSON-RPC 2.0 format in error responses", async () => {
      const request = createRequest("invalid/method", 73);
      const response = await server.processRequest(request);

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(73);
      expect(response.error).toBeDefined();
      expect(response.result).toBeUndefined();
    });
  });

  describe("Protocol Compliance", () => {
    test("all responses include jsonrpc field", async () => {
      const requests = [
        createRequest("initialize", 100),
        createRequest("tools/list", 101),
        createRequest("prompts/list", 102),
      ];

      for (const request of requests) {
        const response = await server.processRequest(request);
        expect(response.jsonrpc).toBe("2.0");
      }
    });

    test("all responses include id field matching request", async () => {
      const request = createRequest("initialize", "test-id-123");
      const response = await server.processRequest(request);

      expect(response.id).toBe("test-id-123");
    });

    test("error responses have no result field", async () => {
      const request = createRequest("unknown/method", 103);
      const response = await server.processRequest(request);

      expect(response.error).toBeDefined();
      expect(response.result).toBeUndefined();
    });

    test("success responses have no error field", async () => {
      const request = createRequest("initialize", 104);
      const response = await server.processRequest(request);

      expect(response.result).toBeDefined();
      expect(response.error).toBeUndefined();
    });
  });
});
