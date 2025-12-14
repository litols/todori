/**
 * MCP Server Error Handling Tests
 *
 * Tests error handling and validation:
 * - Missing tool names
 * - Validation errors
 * - Invalid status/priority values
 * - Dependency errors (non-existent, circular)
 * - Subtask ID format errors
 */

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { type ToolName, ToolHandlers } from "../../src/server/tools.js";
import type { Task } from "../../src/types/task.js";
import { cleanupTestContext, setupTestContext, type TestContext } from "./helpers.js";

describe("MCP Server - Error Handling", () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await setupTestContext();
  });

  afterEach(async () => {
    await cleanupTestContext(context.testDir);
  });

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
      context.toolContext,
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
      context.toolContext,
    );

    expect(result.success).toBe(false);
  });

  test("handles invalid priority in create_task", async () => {
    const result = await ToolHandlers.create_task(
      {
        title: "Test Task",
        priority: "invalid-priority" as unknown as "high",
      },
      context.toolContext,
    );

    expect(result.success).toBe(false);
  });

  test("handles creating task with non-existent dependency", async () => {
    const result = await ToolHandlers.create_task(
      {
        title: "Test Task",
        dependencies: ["non-existent-id"],
      },
      context.toolContext,
    );

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.message).toContain("Dependency task not found");
  });

  test("handles circular dependency creation", async () => {
    // Create task A
    const resultA = await ToolHandlers.create_task({ title: "Task A" }, context.toolContext);
    expect(resultA.success).toBe(true);
    if (!resultA.success) return;

    const taskA = resultA.data as unknown as Task;

    // Create task B depending on A
    const resultB = await ToolHandlers.create_task(
      { title: "Task B", dependencies: [taskA.id] },
      context.toolContext,
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
      context.toolContext,
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
      context.toolContext,
    );

    expect(result.success).toBe(false);
  });

  test("handles updating non-existent subtask", async () => {
    const result = await ToolHandlers.update_subtask(
      {
        subtaskId: "non-existent.1",
        status: "done",
      },
      context.toolContext,
    );

    expect(result.success).toBe(false);
  });
});
