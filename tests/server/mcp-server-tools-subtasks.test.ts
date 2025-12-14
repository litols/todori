/**
 * MCP Server Subtask Tool Tests
 *
 * Tests subtask management tools:
 * - add_subtask
 * - update_subtask
 * - delete_subtask
 */

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { ToolHandlers } from "../../src/server/tools.js";
import type { Task } from "../../src/types/task.js";
import { cleanupTestContext, setupTestContext, type TestContext } from "./helpers.js";

describe("MCP Server - Subtask Tools", () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await setupTestContext();
  });

  afterEach(async () => {
    await cleanupTestContext(context.testDir);
  });

  describe("Tools - Subtasks", () => {
    test("add_subtask creates subtask", async () => {
      // Create parent task
      const createResult = await ToolHandlers.create_task(
        { title: "Parent Task" },
        context.toolContext,
      );

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
        context.toolContext,
      );

      expect(addResult.success).toBe(true);
      if (!addResult.success) return;

      const updated = addResult.data as unknown as Task;
      expect(updated.subtasks.length).toBe(1);
      expect(updated.subtasks[0]?.title).toBe("Subtask 1");
    });

    test("update_subtask modifies subtask status", async () => {
      // Create parent with subtask
      const createResult = await ToolHandlers.create_task({ title: "Parent" }, context.toolContext);

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const parent = createResult.data as unknown as Task;

      await ToolHandlers.add_subtask({ parentId: parent.id, title: "Sub" }, context.toolContext);

      // Update subtask
      const updateResult = await ToolHandlers.update_subtask(
        {
          subtaskId: `${parent.id}.1`,
          status: "done",
        },
        context.toolContext,
      );

      expect(updateResult.success).toBe(true);
      if (!updateResult.success) return;

      const updated = updateResult.data as unknown as Task;
      expect(updated.subtasks[0]?.status).toBe("done");
    });

    test("delete_subtask removes subtask", async () => {
      // Create parent with subtask
      const createResult = await ToolHandlers.create_task({ title: "Parent" }, context.toolContext);

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const parent = createResult.data as unknown as Task;

      await ToolHandlers.add_subtask(
        { parentId: parent.id, title: "Delete Me" },
        context.toolContext,
      );

      // Delete subtask
      const deleteResult = await ToolHandlers.delete_subtask(
        { subtaskId: `${parent.id}.1` },
        context.toolContext,
      );

      expect(deleteResult.success).toBe(true);
      if (!deleteResult.success) return;

      const updated = deleteResult.data as unknown as Task;
      expect(updated.subtasks.length).toBe(0);
    });
  });
});
