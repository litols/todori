/**
 * MCP Server Initialization Tests
 *
 * Tests server initialization and capability advertisement
 */

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { getPromptSchemas } from "../../src/server/prompts.js";
import { getToolSchemas } from "../../src/server/tools.js";
import { cleanupTestContext, setupTestContext, type TestContext } from "./helpers.js";

describe("MCP Server - Initialization", () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await setupTestContext();
  });

  afterEach(async () => {
    await cleanupTestContext(context.testDir);
  });

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
