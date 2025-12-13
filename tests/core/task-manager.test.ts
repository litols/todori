/**
 * Tests for TaskManager CRUD operations and subtask management
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { TaskManager } from "../../src/core/task-manager.js";
import { TaskStore } from "../../src/storage/task-store.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

describe("TaskManager", () => {
  let testDir: string;
  let taskStore: TaskStore;
  let taskManager: TaskManager;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "todori-test-"));
    taskStore = new TaskStore(testDir);
    taskManager = new TaskManager(taskStore);
  });

  describe("CRUD Operations", () => {
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
      expect(task.status).toBe("pending");
      expect(task.priority).toBe("medium");
      expect(task.metadata.created).toBeDefined();
      expect(task.metadata.updated).toBe(task.metadata.created);
      expect(task.subtasks).toEqual([]);
      expect(task.dependencies).toEqual([]);
    });

    test("createTask with custom status and priority", async () => {
      const task = await taskManager.createTask({
        title: "High Priority Task",
        status: "in-progress" as any,
        priority: "high" as any,
      });

      expect(task.status).toBe("in-progress");
      expect(task.priority).toBe("high");
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
        status: "done" as any,
      });

      expect(updated?.metadata.completedAt).toBeDefined();
    });

    test("updateTask clears completedAt when status changes from done", async () => {
      const task = await taskManager.createTask({
        title: "Complete Me",
        status: "done" as any,
      });

      // Manually set completedAt
      await taskManager.updateTask(task.id, { status: "done" as any });

      const reverted = await taskManager.updateTask(task.id, {
        status: "pending" as any,
      });

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
  });

  describe("Subtask Management", () => {
    test("addSubtask creates subtask with parent.N format", async () => {
      const parent = await taskManager.createTask({ title: "Parent Task" });
      const updated = await taskManager.addSubtask(
        parent.id,
        "Subtask 1",
        "Description",
      );

      expect(updated).not.toBeNull();
      expect(updated?.subtasks).toHaveLength(1);
      expect(updated?.subtasks[0].id).toBe(`${parent.id}.1`);
      expect(updated?.subtasks[0].title).toBe("Subtask 1");
      expect(updated?.subtasks[0].description).toBe("Description");
      expect(updated?.subtasks[0].status).toBe("pending");
    });

    test("addSubtask increments subtask ID", async () => {
      const parent = await taskManager.createTask({ title: "Parent Task" });

      await taskManager.addSubtask(parent.id, "Subtask 1");
      const updated = await taskManager.addSubtask(parent.id, "Subtask 2");

      expect(updated?.subtasks).toHaveLength(2);
      expect(updated?.subtasks[0].id).toBe(`${parent.id}.1`);
      expect(updated?.subtasks[1].id).toBe(`${parent.id}.2`);
    });

    test("addSubtask returns null for non-existent parent", async () => {
      const result = await taskManager.addSubtask(
        "non-existent-id",
        "Subtask",
      );
      expect(result).toBeNull();
    });

    test("getSubtasks returns all subtasks", async () => {
      const parent = await taskManager.createTask({ title: "Parent Task" });
      await taskManager.addSubtask(parent.id, "Subtask 1");
      await taskManager.addSubtask(parent.id, "Subtask 2");

      const subtasks = await taskManager.getSubtasks(parent.id);

      expect(subtasks).toHaveLength(2);
      expect(subtasks?.[0].title).toBe("Subtask 1");
      expect(subtasks?.[1].title).toBe("Subtask 2");
    });

    test("getSubtasks returns null for non-existent parent", async () => {
      const subtasks = await taskManager.getSubtasks("non-existent-id");
      expect(subtasks).toBeNull();
    });

    test("updateSubtask updates subtask fields", async () => {
      const parent = await taskManager.createTask({ title: "Parent Task" });
      await taskManager.addSubtask(parent.id, "Subtask 1");

      const subtaskId = `${parent.id}.1`;
      const updated = await taskManager.updateSubtask(subtaskId, {
        title: "Updated Subtask",
        status: "done" as any,
      });

      expect(updated).not.toBeNull();
      expect(updated?.subtasks[0].title).toBe("Updated Subtask");
      expect(updated?.subtasks[0].status).toBe("done");
    });

    test("updateSubtask returns null for non-existent subtask", async () => {
      const parent = await taskManager.createTask({ title: "Parent Task" });
      const result = await taskManager.updateSubtask(`${parent.id}.999`, {
        title: "Updated",
      });
      expect(result).toBeNull();
    });

    test("deleteSubtask removes subtask", async () => {
      const parent = await taskManager.createTask({ title: "Parent Task" });
      await taskManager.addSubtask(parent.id, "Subtask 1");
      await taskManager.addSubtask(parent.id, "Subtask 2");

      const subtaskId = `${parent.id}.1`;
      const updated = await taskManager.deleteSubtask(subtaskId);

      expect(updated).not.toBeNull();
      expect(updated?.subtasks).toHaveLength(1);
      expect(updated?.subtasks[0].id).toBe(`${parent.id}.2`);
    });

    test("deleteSubtask returns null for non-existent subtask", async () => {
      const parent = await taskManager.createTask({ title: "Parent Task" });
      const result = await taskManager.deleteSubtask(`${parent.id}.999`);
      expect(result).toBeNull();
    });
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
