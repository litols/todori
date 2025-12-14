/**
 * Shared test utilities for MCP server tests
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { QueryEngine } from "../../src/core/query.js";
import { TaskManager } from "../../src/core/task-manager.js";
import { initializeProject } from "../../src/integration/project-detect.js";
import type { PromptContext } from "../../src/server/prompts.js";
import type { ToolContext } from "../../src/server/tools.js";
import { TaskStore } from "../../src/storage/task-store.js";

/**
 * Test context containing all components needed for MCP server tests
 */
export interface TestContext {
  testDir: string;
  taskManager: TaskManager;
  queryEngine: QueryEngine;
  toolContext: ToolContext;
  promptContext: PromptContext;
}

/**
 * Creates a test environment with all necessary components
 */
export async function setupTestContext(): Promise<TestContext> {
  // Create temporary test directory
  const testDir = await fs.mkdtemp(path.join(os.tmpdir(), "todori-mcp-"));

  // Initialize project
  await initializeProject(testDir);

  // Setup components
  const taskStore = new TaskStore(testDir);
  const taskManager = new TaskManager(taskStore);
  const queryEngine = new QueryEngine(taskManager);

  const toolContext: ToolContext = {
    taskManager,
    queryEngine,
    projectRoot: testDir,
  };

  const promptContext: PromptContext = {
    taskManager,
    queryEngine,
    projectRoot: testDir,
  };

  return {
    testDir,
    taskManager,
    queryEngine,
    toolContext,
    promptContext,
  };
}

/**
 * Cleans up test directory after tests
 */
export async function cleanupTestContext(testDir: string): Promise<void> {
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}
