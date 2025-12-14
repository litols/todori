/**
 * MCP Server CRUD Tool Tests
 *
 * Tests basic CRUD operations:
 * - create_task
 * - get_task
 * - update_task
 * - delete_task
 * - get_tasks
 */

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { getToolSchemas, ToolHandlers } from "../../src/server/tools.js";
import type { Task } from "../../src/types/task.js";
import { cleanupTestContext, setupTestContext, type TestContext } from "./helpers.js";

describe("MCP Server - CRUD Tools", () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await setupTestContext();
  });

  afterEach(async () => {
    await cleanupTestContext(context.testDir);
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
        context.toolContext,
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
        context.toolContext,
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
        context.toolContext,
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
      const createResult = await ToolHandlers.create_task(
        { title: "Retrieve Me" },
        context.toolContext,
      );

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const created = createResult.data as unknown as Task;

      // Retrieve it
      const getResult = await ToolHandlers.get_task({ id: created.id }, context.toolContext);

      expect(getResult.success).toBe(true);
      if (!getResult.success) return;

      const task = getResult.data as unknown as Task;
      expect(task.id).toBe(created.id);
      expect(task.title).toBe("Retrieve Me");
    });

    test("returns error for non-existent task", async () => {
      const result = await ToolHandlers.get_task({ id: "non-existent-id" }, context.toolContext);

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(-32000); // Task not found
    });
  });

  describe("Tools - update_task", () => {
    test("updates task fields", async () => {
      // Create task
      const createResult = await ToolHandlers.create_task(
        { title: "Original Title" },
        context.toolContext,
      );

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
        context.toolContext,
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
        context.toolContext,
      );

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error).toBeDefined();
    });
  });

  describe("Tools - delete_task", () => {
    test("deletes task successfully", async () => {
      // Create task
      const createResult = await ToolHandlers.create_task(
        { title: "Delete Me" },
        context.toolContext,
      );

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const created = createResult.data as unknown as Task;

      // Delete it
      const deleteResult = await ToolHandlers.delete_task({ id: created.id }, context.toolContext);

      expect(deleteResult.success).toBe(true);
      if (!deleteResult.success) return;

      const deleteData = deleteResult.data as unknown as { success: boolean; deletedId: string };
      expect(deleteData.success).toBe(true);
      expect(deleteData.deletedId).toBe(created.id);

      // Verify it's gone
      const getResult = await ToolHandlers.get_task({ id: created.id }, context.toolContext);

      expect(getResult.success).toBe(false);
    });

    test("returns error for non-existent task", async () => {
      const result = await ToolHandlers.delete_task({ id: "does-not-exist" }, context.toolContext);

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error).toBeDefined();
    });
  });

  describe("Tools - get_tasks", () => {
    test("retrieves all tasks", async () => {
      // Create multiple tasks
      await ToolHandlers.create_task({ title: "Task 1" }, context.toolContext);
      await ToolHandlers.create_task({ title: "Task 2" }, context.toolContext);

      // Get all tasks
      const result = await ToolHandlers.get_tasks({}, context.toolContext);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const tasks = result.data as unknown as Task[];
      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks.length).toBe(2);
    });

    test("filters tasks by status", async () => {
      // Create tasks with different statuses
      await ToolHandlers.create_task(
        { title: "Pending Task", status: "pending" },
        context.toolContext,
      );

      await ToolHandlers.create_task({ title: "Done Task", status: "done" }, context.toolContext);

      // Filter by pending
      const result = await ToolHandlers.get_tasks({ status: "pending" }, context.toolContext);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const tasks = result.data as unknown as Task[];
      expect(tasks.length).toBe(1);
      expect(tasks[0]?.status).toBe("pending");
    });

    test("supports pagination", async () => {
      // Create 5 tasks
      for (let i = 0; i < 5; i++) {
        await ToolHandlers.create_task({ title: `Task ${i}` }, context.toolContext);
      }

      // Get with limit
      const result = await ToolHandlers.get_tasks({ limit: 3, offset: 0 }, context.toolContext);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const tasks = result.data as unknown as Task[];
      expect(tasks.length).toBe(3);
    });
  });
});
