/**
 * Integration tests for Phase 3 integration modules
 * Tests: project-detect.ts and session-restore.ts
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { TaskManager } from "../../src/core/task-manager.js";
import { detectProjectRoot, initializeProject } from "../../src/integration/project-detect.js";
import { restoreSession } from "../../src/integration/session-restore.js";
import { TaskStore } from "../../src/storage/task-store.js";
import type { Task } from "../../src/types/task.js";
import { TaskStatus } from "../../src/types/task.js";

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

describe("Integration - Session Restoration", () => {
  let testDir: string;
  let taskStore: TaskStore;
  let taskManager: TaskManager;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "todori-session-"));

    // Initialize project
    await initializeProject(testDir);

    // Set up managers
    taskStore = new TaskStore(testDir);
    taskManager = new TaskManager(taskStore);
  });

  afterEach(async () => {
    // Clean up test directories
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("restoreSession", () => {
    test("returns valid SessionContext structure", async () => {
      const context = await restoreSession(testDir);

      expect(context).toHaveProperty("statistics");
      expect(context).toHaveProperty("nextTask");
      expect(context).toHaveProperty("recentTasks");
      expect(context).toHaveProperty("totalTasks");
      expect(typeof context.statistics).toBe("object");
      expect(Array.isArray(context.recentTasks)).toBe(true);
      expect(typeof context.totalTasks).toBe("number");
    });

    test("returns empty context for new project", async () => {
      const context = await restoreSession(testDir);

      expect(context.totalTasks).toBe(0);
      expect(context.statistics.pending).toBe(0);
      expect(context.statistics["in-progress"]).toBe(0);
      expect(context.statistics.blocked).toBe(0);
      expect(context.statistics.done).toBe(0);
      expect(context.nextTask).toBeNull();
      expect(context.recentTasks).toHaveLength(0);
    });

    test("calculates statistics correctly", async () => {
      // Create tasks with different statuses
      await taskManager.createTask({
        title: "Pending 1",
        status: TaskStatus.Pending,
      });
      await taskManager.createTask({
        title: "Pending 2",
        status: TaskStatus.Pending,
      });
      await taskManager.createTask({
        title: "In Progress",
        status: TaskStatus.InProgress,
      });
      await taskManager.createTask({
        title: "Done 1",
        status: TaskStatus.Done,
      });
      await taskManager.createTask({
        title: "Done 2",
        status: TaskStatus.Done,
      });
      await taskManager.createTask({
        title: "Blocked",
        status: TaskStatus.Blocked,
      });
      await taskManager.createTask({
        title: "Deferred",
        status: TaskStatus.Deferred,
      });

      const context = await restoreSession(testDir);

      expect(context.statistics.pending).toBe(2);
      expect(context.statistics["in-progress"]).toBe(1);
      expect(context.statistics.blocked).toBe(1);
      expect(context.statistics.done).toBe(2);
      expect(context.statistics.deferred).toBe(1);
      expect(context.statistics.cancelled).toBe(0);
      expect(context.totalTasks).toBe(7);
    });

    test("includes all status keys in statistics", async () => {
      const context = await restoreSession(testDir);

      expect(context.statistics).toHaveProperty("pending");
      expect(context.statistics).toHaveProperty("in-progress");
      expect(context.statistics).toHaveProperty("blocked");
      expect(context.statistics).toHaveProperty("done");
      expect(context.statistics).toHaveProperty("deferred");
      expect(context.statistics).toHaveProperty("cancelled");
    });
  });

  describe("restoreSession - recentTasks", () => {
    test("sorts tasks by updated timestamp in descending order", async () => {
      // Create tasks with different timestamps
      const task1 = await taskManager.createTask({ title: "Task 1" });

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50));

      const task2 = await taskManager.createTask({ title: "Task 2" });

      // Wait a bit more
      await new Promise((resolve) => setTimeout(resolve, 50));

      const task3 = await taskManager.createTask({ title: "Task 3" });

      const context = await restoreSession(testDir);

      expect(context.recentTasks).toHaveLength(3);
      // Most recent first
      expect(context.recentTasks[0]?.id).toBe(task3.id);
      expect(context.recentTasks[1]?.id).toBe(task2.id);
      expect(context.recentTasks[2]?.id).toBe(task1.id);
    });

    test("limits recentTasks to 5 items", async () => {
      // Create 10 tasks
      const tasks: Task[] = [];
      for (let i = 0; i < 10; i++) {
        const task = await taskManager.createTask({ title: `Task ${i}` });
        tasks.push(task);
        // Small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      const context = await restoreSession(testDir);

      expect(context.recentTasks).toHaveLength(5);
      // Should be the 5 most recent
      const recentTasks = context.recentTasks;
      const id0 = (recentTasks[0] as unknown as Task)?.id || "";
      const id1 = (recentTasks[1] as unknown as Task)?.id || "";
      const id4 = (recentTasks[4] as unknown as Task)?.id || "";
      expect(id0).toBe((tasks[9] as unknown as Task)?.id || "");
      expect(id1).toBe((tasks[8] as unknown as Task)?.id || "");
      expect(id4).toBe((tasks[5] as unknown as Task)?.id || "");
    });

    test("recentTasks empty when no tasks exist", async () => {
      const context = await restoreSession(testDir);

      expect(context.recentTasks).toHaveLength(0);
    });

    test("recentTasks includes correct task data", async () => {
      const task = await taskManager.createTask({
        title: "Test Task",
        description: "Test Description",
        status: TaskStatus.InProgress,
      });

      const context = await restoreSession(testDir);

      expect(context.recentTasks).toHaveLength(1);
      expect(context.recentTasks[0]?.id).toBe(task.id);
      expect(context.recentTasks[0]?.title).toBe("Test Task");
      expect(context.recentTasks[0]?.description).toBe("Test Description");
      expect(context.recentTasks[0]?.status).toBe(TaskStatus.InProgress);
    });
  });

  describe("restoreSession - nextTask", () => {
    test("returns null when no pending or in-progress tasks", async () => {
      // Create only done and deferred tasks
      await taskManager.createTask({
        title: "Done Task",
        status: TaskStatus.Done,
      });
      await taskManager.createTask({
        title: "Deferred Task",
        status: TaskStatus.Deferred,
      });

      const context = await restoreSession(testDir);

      expect(context.nextTask).toBeNull();
    });

    test("recommends pending task when available", async () => {
      const pending = await taskManager.createTask({
        title: "Do This",
        status: TaskStatus.Pending,
      });
      await taskManager.createTask({
        title: "Done Already",
        status: TaskStatus.Done,
      });

      const context = await restoreSession(testDir);

      expect(context.nextTask).not.toBeNull();
      expect(context.nextTask?.id).toBe(pending.id);
    });

    test("recommends in-progress task", async () => {
      const inProgress = await taskManager.createTask({
        title: "Work In Progress",
        status: TaskStatus.InProgress,
      });

      const context = await restoreSession(testDir);

      expect(context.nextTask).not.toBeNull();
      expect(context.nextTask?.id).toBe(inProgress.id);
    });

    test("prefers high priority task", async () => {
      const _lowPriority = await taskManager.createTask({
        title: "Low Priority",
        status: TaskStatus.Pending,
        priority: "low" as unknown as "low",
      });

      const highPriority = await taskManager.createTask({
        title: "High Priority",
        status: TaskStatus.Pending,
        priority: "high" as unknown as "high",
      });

      const context = await restoreSession(testDir);

      expect(context.nextTask?.id).toBe(highPriority.id);
    });

    test("respects task dependencies", async () => {
      const blocker = await taskManager.createTask({
        title: "Must Do First",
        status: TaskStatus.Pending,
      });

      const _blocked = await taskManager.createTask({
        title: "Depends on Blocker",
        status: TaskStatus.Pending,
        dependencies: [blocker.id],
      });

      const context = await restoreSession(testDir);

      // Should recommend the blocker, not the blocked task
      expect(context.nextTask?.id).toBe(blocker.id);
    });

    test("recommends task with completed dependencies", async () => {
      const completed = await taskManager.createTask({
        title: "Already Done",
        status: TaskStatus.Done,
      });

      const ready = await taskManager.createTask({
        title: "Ready to Work",
        status: TaskStatus.Pending,
        dependencies: [completed.id],
      });

      const context = await restoreSession(testDir);

      expect(context.nextTask?.id).toBe(ready.id);
    });

    test("avoids blocked tasks with incomplete dependencies", async () => {
      const blocker = await taskManager.createTask({
        title: "Not Done",
        status: TaskStatus.Pending,
      });

      const waiting = await taskManager.createTask({
        title: "Waiting",
        status: TaskStatus.Pending,
        dependencies: [blocker.id],
      });

      const free = await taskManager.createTask({
        title: "No Dependencies",
        status: TaskStatus.Pending,
      });

      const context = await restoreSession(testDir);

      // Should recommend an unblocked task (either blocker or free, but NOT waiting)
      expect(context.nextTask?.id).not.toBe(waiting.id);
      // When priorities are equal, either blocker or free is valid, but not waiting
      const recommendedId = context.nextTask?.id;
      expect([blocker.id, free.id]).toContain(recommendedId);
    });

    test("handles complex dependency chains", async () => {
      const task1 = await taskManager.createTask({
        title: "Task 1",
        status: TaskStatus.Pending,
      });

      const task2 = await taskManager.createTask({
        title: "Task 2",
        status: TaskStatus.Pending,
        dependencies: [task1.id],
      });

      const _task3 = await taskManager.createTask({
        title: "Task 3",
        status: TaskStatus.Pending,
        dependencies: [task2.id],
      });

      const context = await restoreSession(testDir);

      // Should recommend task1 (first in chain)
      expect(context.nextTask?.id).toBe(task1.id);
    });
  });

  describe("restoreSession - integration scenarios", () => {
    test("complete workflow scenario", async () => {
      // Set up a realistic task structure
      const design = await taskManager.createTask({
        title: "Design System",
        status: TaskStatus.Done,
      });

      const setupUI = await taskManager.createTask({
        title: "Setup UI Framework",
        status: TaskStatus.Done,
        dependencies: [design.id],
      });

      const createButton = await taskManager.createTask({
        title: "Create Button Component",
        status: TaskStatus.InProgress,
        priority: "high" as unknown as "high",
        dependencies: [setupUI.id],
      });

      const createForm = await taskManager.createTask({
        title: "Create Form Component",
        status: TaskStatus.Pending,
        priority: "high" as unknown as "high",
        dependencies: [setupUI.id],
      });

      const _writeTests = await taskManager.createTask({
        title: "Write Tests",
        status: TaskStatus.Pending,
        priority: "medium" as unknown as "medium",
        dependencies: [createButton.id, createForm.id],
      });

      const context = await restoreSession(testDir);

      // Verify statistics
      expect(context.statistics.done).toBe(2);
      expect(context.statistics["in-progress"]).toBe(1);
      expect(context.statistics.pending).toBe(2);
      expect(context.totalTasks).toBe(5);

      // Verify next task recommendation
      expect(context.nextTask).not.toBeNull();
      expect(context.nextTask?.id).toBe(createButton.id);

      // Verify recent tasks includes all
      expect(context.recentTasks).toHaveLength(5);
    });

    test("handles empty project with no tasks", async () => {
      const context = await restoreSession(testDir);

      expect(context.totalTasks).toBe(0);
      expect(context.nextTask).toBeNull();
      expect(context.recentTasks).toHaveLength(0);
      expect(Object.values(context.statistics).reduce((a, b) => a + b, 0)).toBe(0);
    });

    test("session context is valid after project initialization", async () => {
      // Fresh initialization
      const newTestDir = await fs.mkdtemp(path.join(os.tmpdir(), "todori-fresh-"));

      try {
        await initializeProject(newTestDir);
        const context = await restoreSession(newTestDir);

        expect(context).toBeDefined();
        expect(context.totalTasks).toBe(0);
      } finally {
        await fs.rm(newTestDir, { recursive: true, force: true });
      }
    });
  });
});
