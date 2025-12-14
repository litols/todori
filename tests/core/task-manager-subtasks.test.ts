/**
 * Tests for TaskManager subtask management
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { TaskManager } from "../../src/core/task-manager.js";
import { TaskStore } from "../../src/storage/task-store.js";
import { TaskStatus } from "../../src/types/task.js";

describe("TaskManager - Subtask Management", () => {
  let testDir: string;
  let taskStore: TaskStore;
  let taskManager: TaskManager;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "todori-test-"));
    taskStore = new TaskStore(testDir);
    taskManager = new TaskManager(taskStore);
  });

  test("addSubtask creates subtask with parent.N format", async () => {
    const parent = await taskManager.createTask({ title: "Parent Task" });
    const updated = await taskManager.addSubtask(parent.id, "Subtask 1", "Description");

    expect(updated).not.toBeNull();
    expect(updated?.subtasks).toHaveLength(1);
    expect(updated?.subtasks[0]?.id).toBe(`${parent.id}.1`);
    expect(updated?.subtasks[0]?.title).toBe("Subtask 1");
    expect(updated?.subtasks[0]?.description).toBe("Description");
    expect(updated?.subtasks[0]?.status).toBe(TaskStatus.Pending);
  });

  test("addSubtask increments subtask ID", async () => {
    const parent = await taskManager.createTask({ title: "Parent Task" });

    await taskManager.addSubtask(parent.id, "Subtask 1");
    const updated = await taskManager.addSubtask(parent.id, "Subtask 2");

    expect(updated).toBeDefined();
    expect(updated?.subtasks).toHaveLength(2);
    expect(updated?.subtasks[0]?.id).toBe(`${parent.id}.1`);
    expect(updated?.subtasks[1]?.id).toBe(`${parent.id}.2`);
  });

  test("addSubtask returns null for non-existent parent", async () => {
    const result = await taskManager.addSubtask("non-existent-id", "Subtask");
    expect(result).toBeNull();
  });

  test("getSubtasks returns all subtasks", async () => {
    const parent = await taskManager.createTask({ title: "Parent Task" });
    await taskManager.addSubtask(parent.id, "Subtask 1");
    await taskManager.addSubtask(parent.id, "Subtask 2");

    const subtasks = await taskManager.getSubtasks(parent.id);

    expect(subtasks).toBeDefined();
    expect(subtasks).toHaveLength(2);
    expect(subtasks?.[0]?.title).toBe("Subtask 1");
    expect(subtasks?.[1]?.title).toBe("Subtask 2");
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
      status: TaskStatus.Done,
    });

    expect(updated).not.toBeNull();
    expect(updated?.subtasks[0]?.title).toBe("Updated Subtask");
    expect(updated?.subtasks[0]?.status).toBe(TaskStatus.Done);
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
    expect(updated?.subtasks[0]?.id).toBe(`${parent.id}.2`);
  });

  test("deleteSubtask returns null for non-existent subtask", async () => {
    const parent = await taskManager.createTask({ title: "Parent Task" });
    const result = await taskManager.deleteSubtask(`${parent.id}.999`);
    expect(result).toBeNull();
  });
});
