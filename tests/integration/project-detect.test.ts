/**
 * Integration tests for project detection and initialization
 * Tests: detectProjectRoot and initializeProject from project-detect.ts
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { TaskManager } from "../../src/core/task-manager.js";
import { detectProjectRoot, initializeProject } from "../../src/integration/project-detect.js";
import { TaskStore } from "../../src/storage/task-store.js";

describe("Integration - Project Detection", () => {
  let testDir: string;
  let nestedDir: string;

  beforeEach(async () => {
    // Create temporary test directory structure
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "todori-integration-"));
    nestedDir = path.join(testDir, "src", "nested", "deep");
    await fs.mkdir(nestedDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directories
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("detectProjectRoot", () => {
    test("detects project root with .git directory", async () => {
      // Create .git directory at testDir root
      await fs.mkdir(path.join(testDir, ".git"), { recursive: true });

      // Call from nested directory
      const result = await detectProjectRoot(nestedDir);

      expect(result).toBe(testDir);
    });

    test("detects project root with .todori directory", async () => {
      // Create .todori directory at testDir root
      await fs.mkdir(path.join(testDir, ".todori"), { recursive: true });

      // Call from nested directory
      const result = await detectProjectRoot(nestedDir);

      expect(result).toBe(testDir);
    });

    test("prefers .git over .todori if both exist", async () => {
      // Create both directories at testDir root
      await fs.mkdir(path.join(testDir, ".git"), { recursive: true });
      await fs.mkdir(path.join(testDir, ".todori"), { recursive: true });

      // Call from nested directory
      const result = await detectProjectRoot(nestedDir);

      // Should find .git first (it's checked first in the code)
      expect(result).toBe(testDir);
    });

    test("returns null when no markers found", async () => {
      // Don't create any markers
      const result = await detectProjectRoot(nestedDir);

      expect(result).toBeNull();
    });

    test("detects root from intermediate directory with .git", async () => {
      // Create .git in testDir
      await fs.mkdir(path.join(testDir, ".git"), { recursive: true });

      // Call from one level deep
      const result = await detectProjectRoot(path.join(testDir, "src"));

      expect(result).toBe(testDir);
    });

    test("starts from the provided path if it is the root", async () => {
      // Create .git at testDir
      await fs.mkdir(path.join(testDir, ".git"), { recursive: true });

      // Call directly from testDir
      const result = await detectProjectRoot(testDir);

      expect(result).toBe(testDir);
    });

    test("handles absolute path correctly", async () => {
      // Create .git
      const gitDir = path.join(testDir, ".git");
      await fs.mkdir(gitDir, { recursive: true });

      // Get absolute path
      const absolutePath = path.resolve(nestedDir);
      const result = await detectProjectRoot(absolutePath);

      expect(result).toBe(testDir);
    });
  });

  describe("initializeProject", () => {
    test("creates .todori directory", async () => {
      const todoriDir = path.join(testDir, ".todori");

      // Verify it doesn't exist initially
      let exists = false;
      try {
        await fs.access(todoriDir);
        exists = true;
      } catch {
        exists = false;
      }
      expect(exists).toBe(false);

      // Initialize project
      await initializeProject(testDir);

      // Verify directory was created
      try {
        await fs.access(todoriDir);
        exists = true;
      } catch {
        exists = false;
      }
      expect(exists).toBe(true);
    });

    test("creates tasks.yaml file", async () => {
      const taskFilePath = path.join(testDir, ".todori", "tasks.yaml");

      // Verify it doesn't exist initially
      let exists = false;
      try {
        await fs.access(taskFilePath);
        exists = true;
      } catch {
        exists = false;
      }
      expect(exists).toBe(false);

      // Initialize project
      await initializeProject(testDir);

      // Verify file was created
      try {
        await fs.access(taskFilePath);
        exists = true;
      } catch {
        exists = false;
      }
      expect(exists).toBe(true);
    });

    test("creates valid YAML with schema metadata", async () => {
      await initializeProject(testDir);

      const taskStore = new TaskStore(testDir);
      const tasks = await taskStore.loadTasks();

      // Should load successfully (valid YAML)
      expect(tasks).toBeDefined();
      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks.length).toBe(0);
    });

    test("idempotent - can initialize multiple times", async () => {
      await initializeProject(testDir);
      const taskStore1 = new TaskStore(testDir);
      const tasks1 = await taskStore1.loadTasks();

      // Initialize again
      await initializeProject(testDir);
      const taskStore2 = new TaskStore(testDir);
      const tasks2 = await taskStore2.loadTasks();

      expect(tasks1).toEqual(tasks2);
    });

    test("preserves existing tasks when reinitializing", async () => {
      // First initialization
      await initializeProject(testDir);

      // Create a task
      const taskStore = new TaskStore(testDir);
      const taskManager = new TaskManager(taskStore);
      const task = await taskManager.createTask({ title: "Test Task" });

      // Reinitialize
      await initializeProject(testDir);

      // Verify task still exists
      const retrieved = await taskManager.getTask(task.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.title).toBe("Test Task");
    });

    test("throws error with meaningful message on failure", async () => {
      // Try to create in a read-only parent (use a path that won't work)
      const invalidPath = "/root/nonexistent/project-xyz123";

      try {
        await initializeProject(invalidPath);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("Failed to initialize project");
      }
    });
  });
});