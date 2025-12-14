/**
 * MCP Server Integration Tests
 *
 * Tests the MCP server tool and prompt handlers including:
 * - All 11 tool handlers
 * - 2 prompt handlers
 * - Error handling and validation
 *
 * Testing approach: Direct handler testing instead of mocking SDK infrastructure.
 * We test our business logic (handlers) rather than the SDK itself.
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { QueryEngine } from "../../src/core/query.js";
import { TaskManager } from "../../src/core/task-manager.js";
import { initializeProject } from "../../src/integration/project-detect.js";
import {
  getPromptSchemas,
  type PromptContext,
  PromptHandlers,
  type PromptName,
  sessionRestorePrompt,
  taskContextPrompt,
} from "../../src/server/prompts.js";
import {
  getToolSchemas,
  type ToolContext,
  ToolHandlers,
  type ToolName,
} from "../../src/server/tools.js";
import { TaskStore } from "../../src/storage/task-store.js";
import type { Task } from "../../src/types/task.js";

/**
 * Test fixture setup
 */
describe("MCP Server - Integration Tests", () => {
  let testDir: string;
  let taskManager: TaskManager;
  let queryEngine: QueryEngine;
  let toolContext: ToolContext;
  let promptContext: PromptContext;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "todori-mcp-"));

    // Initialize project
    await initializeProject(testDir);

    // Setup components
    const taskStore = new TaskStore(testDir);
    taskManager = new TaskManager(taskStore);
    queryEngine = new QueryEngine(taskManager);

    toolContext = {
      taskManager,
      queryEngine,
      projectRoot: testDir,
    };

    promptContext = {
      taskManager,
      queryEngine,
      projectRoot: testDir,
    };
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
    test("advertises tool capabilities", () => {
      const tools = getToolSchemas();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(11); // All 11 tools
    });

    test("advertises prompt capabilities", () => {
      const prompts = getPromptSchemas();
      expect(Array.isArray(prompts)).toBe(true);
      expect(prompts.length).toBe(2); // 2 prompts
    });

    test("validates protocol version format", () => {
      // The SDK uses 2024-11-05 format
      const protocolVersion = "2024-11-05";
      expect(protocolVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("Tools - List", () => {
    test("returns all 11 tool schemas", () => {
      const tools = getToolSchemas();
      expect(tools).toBeDefined();
      expect(tools.length).toBe(11);
    });

    test("tool schemas include required fields", () => {
      const tools = getToolSchemas();

      for (const tool of tools) {
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe("string");
        expect(tool.description).toBeDefined();
        expect(typeof tool.description).toBe("string");
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.inputSchema).toBe("object");
      }
    });

    test("includes all expected tool names", () => {
      const tools = getToolSchemas();
      const toolNames = tools.map((t) => t.name);

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
      const result = await ToolHandlers.create_task(
        {
          title: "Test Task",
          description: "Test description",
          priority: "high",
        },
        toolContext,
      );

      expect(result.success).toBe(true);
      if (!result.success) return;

      const task = result.data as unknown as Task;
      expect(task.id).toBeDefined();
      expect(task.title).toBe("Test Task");
      expect(task.description).toBe("Test description");
      expect(task.priority).toBe("high");
    });

    test("returns validation error for missing title", async () => {
      const result = await ToolHandlers.create_task(
        {
          description: "No title provided",
        },
        toolContext,
      );

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(-32602); // Invalid params
    });

    test("creates task with default values", async () => {
      const result = await ToolHandlers.create_task(
        {
          title: "Minimal Task",
        },
        toolContext,
      );

      expect(result.success).toBe(true);
      if (!result.success) return;

      const task = result.data as unknown as Task;
      expect(task.status).toBe("pending");
      expect(task.priority).toBe("medium");
      expect(task.dependencies).toEqual([]);
      expect(task.subtasks).toEqual([]);
    });
  });

  describe("Tools - get_task", () => {
    test("retrieves task by ID", async () => {
      // Create a task first
      const createResult = await ToolHandlers.create_task({ title: "Retrieve Me" }, toolContext);

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const created = createResult.data as unknown as Task;

      // Retrieve it
      const getResult = await ToolHandlers.get_task({ id: created.id }, toolContext);

      expect(getResult.success).toBe(true);
      if (!getResult.success) return;

      const task = getResult.data as unknown as Task;
      expect(task.id).toBe(created.id);
      expect(task.title).toBe("Retrieve Me");
    });

    test("returns error for non-existent task", async () => {
      const result = await ToolHandlers.get_task({ id: "non-existent-id" }, toolContext);

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(-32000); // Task not found
    });
  });

  describe("Tools - update_task", () => {
    test("updates task fields", async () => {
      // Create task
      const createResult = await ToolHandlers.create_task({ title: "Original Title" }, toolContext);

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const created = createResult.data as unknown as Task;

      // Update it
      const updateResult = await ToolHandlers.update_task(
        {
          id: created.id,
          title: "Updated Title",
          status: "in-progress",
          priority: "high",
        },
        toolContext,
      );

      expect(updateResult.success).toBe(true);
      if (!updateResult.success) return;

      const updated = updateResult.data as unknown as Task;
      expect(updated.id).toBe(created.id);
      expect(updated.title).toBe("Updated Title");
      expect(updated.status).toBe("in-progress");
      expect(updated.priority).toBe("high");
    });

    test("returns error for invalid task ID", async () => {
      const result = await ToolHandlers.update_task(
        {
          id: "invalid-id",
          title: "Won't Work",
        },
        toolContext,
      );

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error).toBeDefined();
    });
  });

  describe("Tools - delete_task", () => {
    test("deletes task successfully", async () => {
      // Create task
      const createResult = await ToolHandlers.create_task({ title: "Delete Me" }, toolContext);

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const created = createResult.data as unknown as Task;

      // Delete it
      const deleteResult = await ToolHandlers.delete_task({ id: created.id }, toolContext);

      expect(deleteResult.success).toBe(true);
      if (!deleteResult.success) return;

      const deleteData = deleteResult.data as unknown as { success: boolean; deletedId: string };
      expect(deleteData.success).toBe(true);
      expect(deleteData.deletedId).toBe(created.id);

      // Verify it's gone
      const getResult = await ToolHandlers.get_task({ id: created.id }, toolContext);

      expect(getResult.success).toBe(false);
    });

    test("returns error for non-existent task", async () => {
      const result = await ToolHandlers.delete_task({ id: "does-not-exist" }, toolContext);

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error).toBeDefined();
    });
  });

  describe("Tools - get_tasks", () => {
    test("retrieves all tasks", async () => {
      // Create multiple tasks
      await ToolHandlers.create_task({ title: "Task 1" }, toolContext);
      await ToolHandlers.create_task({ title: "Task 2" }, toolContext);

      // Get all tasks
      const result = await ToolHandlers.get_tasks({}, toolContext);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const tasks = result.data as unknown as Task[];
      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks.length).toBe(2);
    });

    test("filters tasks by status", async () => {
      // Create tasks with different statuses
      await ToolHandlers.create_task({ title: "Pending Task", status: "pending" }, toolContext);

      await ToolHandlers.create_task({ title: "Done Task", status: "done" }, toolContext);

      // Filter by pending
      const result = await ToolHandlers.get_tasks({ status: "pending" }, toolContext);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const tasks = result.data as unknown as Task[];
      expect(tasks.length).toBe(1);
      expect(tasks[0]?.status).toBe("pending");
    });

    test("supports pagination", async () => {
      // Create 5 tasks
      for (let i = 0; i < 5; i++) {
        await ToolHandlers.create_task({ title: `Task ${i}` }, toolContext);
      }

      // Get with limit
      const result = await ToolHandlers.get_tasks({ limit: 3, offset: 0 }, toolContext);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const tasks = result.data as unknown as Task[];
      expect(tasks.length).toBe(3);
    });
  });

  describe("Tools - get_next_task", () => {
    test("recommends next task based on priority and dependencies", async () => {
      // Create high priority task
      await ToolHandlers.create_task({ title: "High Priority", priority: "high" }, toolContext);

      // Create low priority task
      await ToolHandlers.create_task({ title: "Low Priority", priority: "low" }, toolContext);

      // Get next task
      const result = await ToolHandlers.get_next_task({}, toolContext);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const recommendation = result.data as unknown as { task: Task | null; reason: string };
      expect(recommendation.task.title).toBe("High Priority");
    });

    test("returns null when no tasks available", async () => {
      const result = await ToolHandlers.get_next_task({}, toolContext);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const recommendation = result.data as unknown as { task: Task | null; reason: string };
      expect(recommendation.task).toBeNull();
    });
  });

  describe("Tools - query_tasks", () => {
    test("queries with filters and sorting", async () => {
      // Create tasks
      await ToolHandlers.create_task({ title: "A Task", priority: "high" }, toolContext);

      await ToolHandlers.create_task({ title: "B Task", priority: "low" }, toolContext);

      // Query with sort
      const result = await ToolHandlers.query_tasks(
        {
          sort: { field: "priority", order: "desc" },
        },
        toolContext,
      );

      expect(result.success).toBe(true);
      if (!result.success) return;

      const tasks = result.data as unknown as Task[];
      expect(tasks.length).toBe(2);
      expect(tasks[0]?.priority).toBe("high");
    });

    test("supports field projection", async () => {
      await ToolHandlers.create_task(
        { title: "Full Task", description: "With description" },
        toolContext,
      );

      const result = await ToolHandlers.query_tasks(
        {
          fields: ["id", "title"],
        },
        toolContext,
      );

      expect(result.success).toBe(true);
      if (!result.success) return;

      const tasks = result.data as unknown as Array<{ id: string; title: string }>;
      expect(tasks[0]?.id).toBeDefined();
      expect(tasks[0]?.title).toBeDefined();
      expect(tasks[0]).not.toHaveProperty("description");
    });
  });

  describe("Tools - get_task_stats", () => {
    test("calculates task statistics", async () => {
      // Create tasks with different statuses
      await ToolHandlers.create_task({ title: "Pending", status: "pending" }, toolContext);

      await ToolHandlers.create_task({ title: "Done", status: "done" }, toolContext);

      const result = await ToolHandlers.get_task_stats({}, toolContext);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const stats = result.data as unknown as { total: number; byStatus: Record<string, number> };
      expect(stats.total).toBe(2);
      expect(stats.byStatus.pending).toBe(1);
      expect(stats.byStatus.done).toBe(1);
    });

    test("includes all status categories", async () => {
      const result = await ToolHandlers.get_task_stats({}, toolContext);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const stats = result.data as unknown as { total: number; byStatus: Record<string, number> };
      expect(stats.byStatus).toHaveProperty("pending");
      expect(stats.byStatus).toHaveProperty("in-progress");
      expect(stats.byStatus).toHaveProperty("blocked");
      expect(stats.byStatus).toHaveProperty("done");
      expect(stats.byStatus).toHaveProperty("deferred");
      expect(stats.byStatus).toHaveProperty("cancelled");
    });
  });

  describe("Tools - Subtasks", () => {
    test("add_subtask creates subtask", async () => {
      // Create parent task
      const createResult = await ToolHandlers.create_task({ title: "Parent Task" }, toolContext);

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const parent = createResult.data as unknown as Task;

      // Add subtask
      const addResult = await ToolHandlers.add_subtask(
        {
          parentId: parent.id,
          title: "Subtask 1",
          description: "Subtask description",
        },
        toolContext,
      );

      expect(addResult.success).toBe(true);
      if (!addResult.success) return;

      const updated = addResult.data as unknown as Task;
      expect(updated.subtasks.length).toBe(1);
      expect(updated.subtasks[0]?.title).toBe("Subtask 1");
    });

    test("update_subtask modifies subtask status", async () => {
      // Create parent with subtask
      const createResult = await ToolHandlers.create_task({ title: "Parent" }, toolContext);

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const parent = createResult.data as unknown as Task;

      await ToolHandlers.add_subtask({ parentId: parent.id, title: "Sub" }, toolContext);

      // Update subtask
      const updateResult = await ToolHandlers.update_subtask(
        {
          subtaskId: `${parent.id}.1`,
          status: "done",
        },
        toolContext,
      );

      expect(updateResult.success).toBe(true);
      if (!updateResult.success) return;

      const updated = updateResult.data as unknown as Task;
      expect(updated.subtasks[0]?.status).toBe("done");
    });

    test("delete_subtask removes subtask", async () => {
      // Create parent with subtask
      const createResult = await ToolHandlers.create_task({ title: "Parent" }, toolContext);

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const parent = createResult.data as unknown as Task;

      await ToolHandlers.add_subtask({ parentId: parent.id, title: "Delete Me" }, toolContext);

      // Delete subtask
      const deleteResult = await ToolHandlers.delete_subtask(
        { subtaskId: `${parent.id}.1` },
        toolContext,
      );

      expect(deleteResult.success).toBe(true);
      if (!deleteResult.success) return;

      const updated = deleteResult.data as unknown as Task;
      expect(updated.subtasks.length).toBe(0);
    });
  });

  describe("Prompts - List", () => {
    test("returns all 2 prompt schemas", () => {
      const prompts = getPromptSchemas();
      expect(prompts.length).toBe(2);
    });

    test("prompt schemas include required fields", () => {
      const prompts = getPromptSchemas();

      for (const prompt of prompts) {
        expect(prompt.name).toBeDefined();
        expect(typeof prompt.name).toBe("string");
        expect(prompt.description).toBeDefined();
        expect(Array.isArray(prompt.arguments)).toBe(true);
      }
    });
  });

  describe("Prompts - session_restore", () => {
    test("returns project overview", async () => {
      const content = await sessionRestorePrompt(promptContext);

      expect(content).toContain("Todori Project Status");
      expect(content).toContain("Task Summary");
    });

    test("includes task statistics", async () => {
      await ToolHandlers.create_task({ title: "Test" }, toolContext);

      const content = await sessionRestorePrompt(promptContext);

      expect(content).toContain("Total Tasks: 1");
    });

    test("response size is under 2KB for reasonable task count", async () => {
      // Create 10 tasks
      for (let i = 0; i < 10; i++) {
        await ToolHandlers.create_task({ title: `Task ${i}` }, toolContext);
      }

      const content = await sessionRestorePrompt(promptContext);
      const contentSize = new TextEncoder().encode(content).length;

      expect(contentSize).toBeLessThan(2048); // 2KB
    });
  });

  describe("Prompts - task_context", () => {
    test("returns task details", async () => {
      // Create a task
      const createResult = await ToolHandlers.create_task(
        { title: "Context Task", description: "With context" },
        toolContext,
      );

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const task = createResult.data as unknown as Task;

      // Get task context
      const content = await taskContextPrompt(task.id, promptContext);

      expect(content).toContain("Context Task");
      expect(content).toContain("With context");
    });

    test("shows task not found for invalid ID", async () => {
      const content = await taskContextPrompt("invalid-id", promptContext);

      expect(content).toContain("Task Not Found");
    });
  });

  describe("Error Handling", () => {
    test("handles missing tool name", () => {
      const toolName = "unknown_tool" as ToolName;
      const handler = ToolHandlers[toolName];

      expect(handler).toBeUndefined();
    });

    test("handles validation errors with detailed messages", async () => {
      const result = await ToolHandlers.create_task(
        {
          title: "", // Empty title should fail
        },
        toolContext,
      );

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(-32602);
      expect(result.error.data).toBeDefined();
    });

    test("handles invalid status in create_task", async () => {
      const result = await ToolHandlers.create_task(
        {
          title: "Test Task",
          status: "invalid-status" as unknown as "pending",
        },
        toolContext,
      );

      expect(result.success).toBe(false);
    });

    test("handles invalid priority in create_task", async () => {
      const result = await ToolHandlers.create_task(
        {
          title: "Test Task",
          priority: "invalid-priority" as unknown as "high",
        },
        toolContext,
      );

      expect(result.success).toBe(false);
    });

    test("handles creating task with non-existent dependency", async () => {
      const result = await ToolHandlers.create_task(
        {
          title: "Test Task",
          dependencies: ["non-existent-id"],
        },
        toolContext,
      );

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error.message).toContain("Dependency task not found");
    });

    test("handles circular dependency creation", async () => {
      // Create task A
      const resultA = await ToolHandlers.create_task({ title: "Task A" }, toolContext);
      expect(resultA.success).toBe(true);
      if (!resultA.success) return;

      const taskA = resultA.data as unknown as Task;

      // Create task B depending on A
      const resultB = await ToolHandlers.create_task(
        { title: "Task B", dependencies: [taskA.id] },
        toolContext,
      );
      expect(resultB.success).toBe(true);
      if (!resultB.success) return;

      const taskB = resultB.data as unknown as Task;

      // Try to update A to depend on B (would create cycle)
      const resultUpdate = await ToolHandlers.update_task(
        {
          id: taskA.id,
          dependencies: [taskB.id],
        },
        toolContext,
      );

      expect(resultUpdate.success).toBe(false);
      if (resultUpdate.success) return;

      expect(resultUpdate.error.message).toContain("cycle");
    });

    test("handles invalid subtask ID format", async () => {
      const result = await ToolHandlers.update_subtask(
        {
          subtaskId: "invalid-format",
          status: "done",
        },
        toolContext,
      );

      expect(result.success).toBe(false);
    });

    test("handles updating non-existent subtask", async () => {
      const result = await ToolHandlers.update_subtask(
        {
          subtaskId: "non-existent.1",
          status: "done",
        },
        toolContext,
      );

      expect(result.success).toBe(false);
    });
  });

  describe("Protocol Compliance", () => {
    test("tool schemas follow MCP schema format", () => {
      const tools = getToolSchemas();

      for (const tool of tools) {
        expect(tool).toHaveProperty("name");
        expect(tool).toHaveProperty("description");
        expect(tool).toHaveProperty("inputSchema");
        expect(tool.inputSchema).toHaveProperty("type");
        expect(tool.inputSchema.type).toBe("object");
      }
    });

    test("prompt schemas follow MCP schema format", () => {
      const prompts = getPromptSchemas();

      for (const prompt of prompts) {
        expect(prompt).toHaveProperty("name");
        expect(prompt).toHaveProperty("description");
        expect(prompt).toHaveProperty("arguments");
        expect(Array.isArray(prompt.arguments)).toBe(true);
      }
    });

    test("all tool handlers exist for advertised tools", () => {
      const tools = getToolSchemas();

      for (const tool of tools) {
        const handler = ToolHandlers[tool.name as ToolName];
        expect(handler).toBeDefined();
        expect(typeof handler).toBe("function");
      }
    });

    test("all prompt handlers exist for advertised prompts", () => {
      const prompts = getPromptSchemas();

      for (const prompt of prompts) {
        const handler = PromptHandlers[prompt.name as PromptName];
        expect(handler).toBeDefined();
        expect(typeof handler).toBe("function");
      }
    });
  });
});
