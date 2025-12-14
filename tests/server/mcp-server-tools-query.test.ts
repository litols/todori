/**
 * MCP Server Query Tool Tests
 *
 * Tests advanced query and statistics tools:
 * - get_next_task
 * - query_tasks
 * - get_task_stats
 */

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { ToolHandlers } from "../../src/server/tools.js";
import type { Task } from "../../src/types/task.js";
import { cleanupTestContext, setupTestContext, type TestContext } from "./helpers.js";

describe("MCP Server - Query Tools", () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await setupTestContext();
  });

  afterEach(async () => {
    await cleanupTestContext(context.testDir);
  });

  describe("Tools - get_next_task", () => {
    test("recommends next task based on priority and dependencies", async () => {
      // Create high priority task
      await ToolHandlers.create_task(
        { title: "High Priority", priority: "high" },
        context.toolContext,
      );

      // Create low priority task
      await ToolHandlers.create_task(
        { title: "Low Priority", priority: "low" },
        context.toolContext,
      );

      // Get next task
      const result = await ToolHandlers.get_next_task({}, context.toolContext);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const recommendation = result.data as unknown as { task: Task | null; reason: string };
      expect(recommendation.task).not.toBeNull();
      expect(recommendation.task?.title).toBe("High Priority");
    });

    test("returns null when no tasks available", async () => {
      const result = await ToolHandlers.get_next_task({}, context.toolContext);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const recommendation = result.data as unknown as { task: Task | null; reason: string };
      expect(recommendation.task).toBeNull();
    });
  });

  describe("Tools - query_tasks", () => {
    test("queries with filters and sorting", async () => {
      // Create tasks
      await ToolHandlers.create_task({ title: "A Task", priority: "high" }, context.toolContext);

      await ToolHandlers.create_task({ title: "B Task", priority: "low" }, context.toolContext);

      // Query with sort
      const result = await ToolHandlers.query_tasks(
        {
          sort: { field: "priority", order: "desc" },
        },
        context.toolContext,
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
        context.toolContext,
      );

      const result = await ToolHandlers.query_tasks(
        {
          fields: ["id", "title"],
        },
        context.toolContext,
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
      await ToolHandlers.create_task({ title: "Pending", status: "pending" }, context.toolContext);

      await ToolHandlers.create_task({ title: "Done", status: "done" }, context.toolContext);

      const result = await ToolHandlers.get_task_stats({}, context.toolContext);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const stats = result.data as unknown as { total: number; byStatus: Record<string, number> };
      expect(stats.total).toBe(2);
      expect(stats.byStatus.pending).toBe(1);
      expect(stats.byStatus.done).toBe(1);
    });

    test("includes all status categories", async () => {
      const result = await ToolHandlers.get_task_stats({}, context.toolContext);

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
});
