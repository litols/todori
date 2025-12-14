/**
 * Tests for TaskManager CRUD operations
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { TaskManager } from "../../src/core/task-manager.js";
import { TaskStore } from "../../src/storage/task-store.js";
import { Priority, TaskStatus } from "../../src/types/task.js";

describe("TaskManager - CRUD Operations", () => {
  let testDir: string;
  let taskStore: TaskStore;
  let taskManager: TaskManager;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "todori-test-"));
    taskStore = new TaskStore(testDir);
    taskManager = new TaskManager(taskStore);
  });

  test("createTask generates valid UUID and timestamps", async () => {
    const task = await taskManager.createTask({
      title: "Test Task",
      description: "Test Description",
    });

    expect(task.id).toBeDefined();
    expect(task.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(task.title).toBe("Test Task");
    expect(task.description).toBe("Test Description");
    expect(task.status).toBe(TaskStatus.Pending);
    expect(task.priority).toBe(Priority.Medium);
    expect(task.metadata.created).toBeDefined();
    expect(task.metadata.updated).toBe(task.metadata.created);
    expect(task.subtasks).toEqual([]);
    expect(task.dependencies).toEqual([]);
  });

  test("createTask with custom status and priority", async () => {
    const task = await taskManager.createTask({
      title: "High Priority Task",
      status: TaskStatus.InProgress,
      priority: Priority.High,
    });

    expect(task.status).toBe(TaskStatus.InProgress);
    expect(task.priority).toBe(Priority.High);
  });

  test("getTask returns task by ID", async () => {
    const created = await taskManager.createTask({ title: "Find Me" });
    const found = await taskManager.getTask(created.id);

    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);
    expect(found?.title).toBe("Find Me");
  });

  test("getTask returns null for non-existent ID", async () => {
    const found = await taskManager.getTask("non-existent-id");
    expect(found).toBeNull();
  });

  test("updateTask merges updates and updates timestamp", async () => {
    const created = await taskManager.createTask({
      title: "Original Title",
      description: "Original Description",
    });

    // Wait a bit to ensure timestamp changes
    await new Promise((resolve) => setTimeout(resolve, 10));

    const updated = await taskManager.updateTask(created.id, {
      title: "Updated Title",
    });

    expect(updated).not.toBeNull();
    expect(updated?.title).toBe("Updated Title");
    expect(updated?.description).toBe("Original Description");
    expect(updated?.metadata.updated).not.toBe(created.metadata.created);
  });

  test("updateTask sets completedAt when status changes to done", async () => {
    const task = await taskManager.createTask({ title: "Complete Me" });
    const updated = await taskManager.updateTask(task.id, {
      status: TaskStatus.Done,
    });

    expect(updated).toBeDefined();
    expect(updated?.metadata.completedAt).toBeDefined();
  });

  test("updateTask clears completedAt when status changes from done", async () => {
    const task = await taskManager.createTask({
      title: "Complete Me",
      status: TaskStatus.Done,
    });

    // Manually set completedAt
    await taskManager.updateTask(task.id, { status: TaskStatus.Done });

    const reverted = await taskManager.updateTask(task.id, {
      status: TaskStatus.Pending,
    });

    expect(reverted).toBeDefined();
    expect(reverted?.metadata.completedAt).toBeUndefined();
  });

  test("updateTask returns null for non-existent ID", async () => {
    const updated = await taskManager.updateTask("non-existent-id", {
      title: "New Title",
    });
    expect(updated).toBeNull();
  });

  test("deleteTask removes task", async () => {
    const task = await taskManager.createTask({ title: "Delete Me" });
    const deleted = await taskManager.deleteTask(task.id);

    expect(deleted).toBe(true);

    const found = await taskManager.getTask(task.id);
    expect(found).toBeNull();
  });

  test("deleteTask removes task from dependencies", async () => {
    const task1 = await taskManager.createTask({ title: "Task 1" });
    const task2 = await taskManager.createTask({
      title: "Task 2",
      dependencies: [task1.id],
    });

    await taskManager.deleteTask(task1.id);

    const updated = await taskManager.getTask(task2.id);
    expect(updated?.dependencies).toEqual([]);
  });

  test("deleteTask returns false for non-existent ID", async () => {
    const deleted = await taskManager.deleteTask("non-existent-id");
    expect(deleted).toBe(false);
  });

  describe("getAllTasks", () => {
    test("returns all tasks", async () => {
      await taskManager.createTask({ title: "Task 1" });
      await taskManager.createTask({ title: "Task 2" });
      await taskManager.createTask({ title: "Task 3" });

      const tasks = await taskManager.getAllTasks();
      expect(tasks).toHaveLength(3);
    });

    test("returns empty array for new project", async () => {
      const tasks = await taskManager.getAllTasks();
      expect(tasks).toEqual([]);
    });
  });
});
