/**
 * MCP Server Prompt Handler Tests
 *
 * Tests prompt handlers:
 * - session_restore
 * - task_context
 */

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  getPromptSchemas,
  sessionRestorePrompt,
  taskContextPrompt,
} from "../../src/server/prompts.js";
import { ToolHandlers } from "../../src/server/tools.js";
import type { Task } from "../../src/types/task.js";
import { cleanupTestContext, setupTestContext, type TestContext } from "./helpers.js";

describe("MCP Server - Prompt Handlers", () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await setupTestContext();
  });

  afterEach(async () => {
    await cleanupTestContext(context.testDir);
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
      const content = await sessionRestorePrompt(context.promptContext);

      expect(content).toContain("Todori Project Status");
      expect(content).toContain("Task Summary");
    });

    test("includes task statistics", async () => {
      await ToolHandlers.create_task({ title: "Test" }, context.toolContext);

      const content = await sessionRestorePrompt(context.promptContext);

      expect(content).toContain("Total Tasks: 1");
    });

    test("response size is under 2KB for reasonable task count", async () => {
      // Create 10 tasks
      for (let i = 0; i < 10; i++) {
        await ToolHandlers.create_task({ title: `Task ${i}` }, context.toolContext);
      }

      const content = await sessionRestorePrompt(context.promptContext);
      const contentSize = new TextEncoder().encode(content).length;

      expect(contentSize).toBeLessThan(2048); // 2KB
    });
  });

  describe("Prompts - task_context", () => {
    test("returns task details", async () => {
      // Create a task
      const createResult = await ToolHandlers.create_task(
        { title: "Context Task", description: "With context" },
        context.toolContext,
      );

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const task = createResult.data as unknown as Task;

      // Get task context
      const content = await taskContextPrompt(task.id, context.promptContext);

      expect(content).toContain("Context Task");
      expect(content).toContain("With context");
    });

    test("shows task not found for invalid ID", async () => {
      const content = await taskContextPrompt("invalid-id", context.promptContext);

      expect(content).toContain("Task Not Found");
    });
  });
});
