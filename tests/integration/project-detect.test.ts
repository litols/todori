/**
 * Integration tests for project detection and initialization
 * Tests: detectProjectRoot and initializeProject from project-detect.ts
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { TaskManager } from "../../src/core/task-manager.js";
import {
  detectProjectRoot,
  getMainWorktreeRoot,
  initializeProject,
  isGitWorktree,
  resolveStorageRoot,
} from "../../src/integration/project-detect.js";
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
      // Use a truly invalid path that will fail on mkdir
      // Using a null byte in path which is invalid on all systems
      const invalidPath = "/tmp/invalid\0path";

      await expect(initializeProject(invalidPath)).rejects.toThrow("Failed to initialize project");
    });
  });

  describe("Git Worktree Support", () => {
    let mainRepoDir: string;
    let worktreeDir: string;

    beforeEach(async () => {
      // Create main repository directory structure
      mainRepoDir = await fs.mkdtemp(path.join(os.tmpdir(), "todori-main-repo-"));
      await fs.mkdir(path.join(mainRepoDir, ".git"), { recursive: true });
      await fs.mkdir(path.join(mainRepoDir, ".git", "worktrees"), { recursive: true });

      // Create worktree directory
      worktreeDir = await fs.mkdtemp(path.join(os.tmpdir(), "todori-worktree-"));

      // Create worktree git data directory
      const worktreeGitDir = path.join(mainRepoDir, ".git", "worktrees", "feature-branch");
      await fs.mkdir(worktreeGitDir, { recursive: true });

      // Create .git file in worktree pointing to main repo
      const gitFileContent = `gitdir: ${worktreeGitDir}`;
      await fs.writeFile(path.join(worktreeDir, ".git"), gitFileContent, { encoding: "utf-8" });
    });

    afterEach(async () => {
      // Clean up test directories
      try {
        await fs.rm(mainRepoDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
      try {
        await fs.rm(worktreeDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    describe("isGitWorktree", () => {
      test("returns true for worktree directory", async () => {
        const result = await isGitWorktree(worktreeDir);
        expect(result).toBe(true);
      });

      test("returns false for main repository", async () => {
        const result = await isGitWorktree(mainRepoDir);
        expect(result).toBe(false);
      });

      test("returns false for non-git directory", async () => {
        const nonGitDir = await fs.mkdtemp(path.join(os.tmpdir(), "todori-non-git-"));
        try {
          const result = await isGitWorktree(nonGitDir);
          expect(result).toBe(false);
        } finally {
          await fs.rm(nonGitDir, { recursive: true, force: true });
        }
      });
    });

    describe("getMainWorktreeRoot", () => {
      test("resolves main repository root from worktree", async () => {
        const result = await getMainWorktreeRoot(worktreeDir);
        expect(result).toBe(mainRepoDir);
      });

      test("returns same path for main repository", async () => {
        const result = await getMainWorktreeRoot(mainRepoDir);
        expect(result).toBe(mainRepoDir);
      });

      test("throws error for invalid worktree structure", async () => {
        const invalidWorktree = await fs.mkdtemp(path.join(os.tmpdir(), "todori-invalid-"));
        try {
          // Create .git file with invalid content
          await fs.writeFile(path.join(invalidWorktree, ".git"), "invalid content", {
            encoding: "utf-8",
          });

          await expect(getMainWorktreeRoot(invalidWorktree)).rejects.toThrow(
            /Failed to resolve main repository root/,
          );
        } finally {
          await fs.rm(invalidWorktree, { recursive: true, force: true });
        }
      });
    });

    describe("resolveStorageRoot", () => {
      test("resolves to main repository for worktree", async () => {
        const result = await resolveStorageRoot(worktreeDir);
        expect(result).toBe(mainRepoDir);
      });

      test("returns same path for main repository", async () => {
        const result = await resolveStorageRoot(mainRepoDir);
        expect(result).toBe(mainRepoDir);
      });

      test("returns same path for non-git directory", async () => {
        const nonGitDir = await fs.mkdtemp(path.join(os.tmpdir(), "todori-non-git-"));
        try {
          const result = await resolveStorageRoot(nonGitDir);
          expect(result).toBe(nonGitDir);
        } finally {
          await fs.rm(nonGitDir, { recursive: true, force: true });
        }
      });
    });

    describe("Shared Storage", () => {
      test("worktree and main repository share tasks.yaml", async () => {
        // Initialize project from main repository
        await initializeProject(mainRepoDir);

        // Create a task from main repository
        const mainTaskStore = new TaskStore(mainRepoDir);
        const mainTaskManager = new TaskManager(mainTaskStore);
        const task = await mainTaskManager.createTask({ title: "Shared Task" });

        // Verify task exists in main repository
        const mainTask = await mainTaskManager.getTask(task.id);
        expect(mainTask).not.toBeNull();
        expect(mainTask?.title).toBe("Shared Task");

        // Resolve storage root for worktree (should point to main repo)
        const worktreeStorageRoot = await resolveStorageRoot(worktreeDir);
        expect(worktreeStorageRoot).toBe(mainRepoDir);

        // Access from worktree using resolved storage root
        const worktreeTaskStore = new TaskStore(worktreeStorageRoot);
        const worktreeTaskManager = new TaskManager(worktreeTaskStore);

        // Verify task is accessible from worktree
        const worktreeTask = await worktreeTaskManager.getTask(task.id);
        expect(worktreeTask).not.toBeNull();
        expect(worktreeTask?.title).toBe("Shared Task");

        // Verify both access the same file
        expect(mainTaskStore.getTaskFilePath()).toBe(worktreeTaskStore.getTaskFilePath());
      });

      test("tasks created in worktree are visible in main repository", async () => {
        // Initialize project from main repository
        await initializeProject(mainRepoDir);

        // Create task from worktree
        const worktreeStorageRoot = await resolveStorageRoot(worktreeDir);
        const worktreeTaskStore = new TaskStore(worktreeStorageRoot);
        const worktreeTaskManager = new TaskManager(worktreeTaskStore);
        const task = await worktreeTaskManager.createTask({ title: "Worktree Task" });

        // Verify from main repository
        const mainTaskStore = new TaskStore(mainRepoDir);
        const mainTaskManager = new TaskManager(mainTaskStore);
        const mainTask = await mainTaskManager.getTask(task.id);

        expect(mainTask).not.toBeNull();
        expect(mainTask?.title).toBe("Worktree Task");
      });

      test("worktree does not create its own .todori directory", async () => {
        // Initialize from worktree (should create .todori in main repo)
        await initializeProject(worktreeDir);

        // Check main repo has .todori
        const mainTodoriExists = await fs
          .access(path.join(mainRepoDir, ".todori"))
          .then(() => true)
          .catch(() => false);
        expect(mainTodoriExists).toBe(true);

        // Check worktree does NOT have .todori
        const worktreeTodoriExists = await fs
          .access(path.join(worktreeDir, ".todori"))
          .then(() => true)
          .catch(() => false);
        expect(worktreeTodoriExists).toBe(false);
      });
    });
  });
});
