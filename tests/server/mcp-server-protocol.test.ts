/**
 * MCP Server Protocol Compliance Tests
 *
 * Tests MCP protocol compliance:
 * - Tool schema format
 * - Prompt schema format
 * - Handler existence for advertised tools/prompts
 */

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  getPromptSchemas,
  type PromptName,
  PromptHandlers,
} from "../../src/server/prompts.js";
import { getToolSchemas, type ToolName, ToolHandlers } from "../../src/server/tools.js";
import { cleanupTestContext, setupTestContext, type TestContext } from "./helpers.js";

describe("MCP Server - Protocol Compliance", () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await setupTestContext();
  });

  afterEach(async () => {
    await cleanupTestContext(context.testDir);
  });

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
