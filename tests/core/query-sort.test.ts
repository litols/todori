/**
 * Tests for QueryEngine - sortTasks functionality
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { QueryEngine } from "../../src/core/query.js";
import { TaskManager } from "../../src/core/task-manager.js";
import { TaskStore } from "../../src/storage/task-store.js";
import { Priority, TaskStatus } from "../../src/types/task.js";

describe("QueryEngine - sortTasks", () => {
  let testDir: string;
  let taskStore: TaskStore;
  let taskManager: TaskManager;
  let queryEngine: QueryEngine;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "todori-test-"));
    taskStore = new TaskStore(testDir);
    taskManager = new TaskManager(taskStore);
    queryEngine = new QueryEngine(taskManager);
  });

  test("sorts by priority descending", async () => {
    const _low = await taskManager.createTask({
      title: "Low",
      priority: Priority.Low,
    });
    const _high = await taskManager.createTask({
      title: "High",
      priority: Priority.High,
    });
    const _medium = await taskManager.createTask({
      title: "Medium",
      priority: Priority.Medium,
    });

    const tasks = await taskManager.getAllTasks();
    const sorted = queryEngine.sortTasks(tasks, {
      field: "priority",
      order: "desc",
    });

    expect(sorted[0]?.title).toBe("High");
    expect(sorted[1]?.title).toBe("Medium");
    expect(sorted[2]?.title).toBe("Low");
  });

  test("sorts by created date ascending", async () => {
    const _task1 = await taskManager.createTask({ title: "First" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const _task2 = await taskManager.createTask({ title: "Second" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const _task3 = await taskManager.createTask({ title: "Third" });

    const tasks = await taskManager.getAllTasks();
    const sorted = queryEngine.sortTasks(tasks, {
      field: "created",
      order: "asc",
    });

    expect(sorted[0]?.title).toBe("First");
    expect(sorted[1]?.title).toBe("Second");
    expect(sorted[2]?.title).toBe("Third");
  });

  test("sorts by status", async () => {
    await taskManager.createTask({ title: "Done", status: TaskStatus.Done });
    await taskManager.createTask({ title: "Pending" });
    await taskManager.createTask({
      title: "In Progress",
      status: TaskStatus.InProgress,
    });

    const tasks = await taskManager.getAllTasks();
    const sorted = queryEngine.sortTasks(tasks, {
      field: "status",
      order: "asc",
    });

    expect(sorted[0]?.status).toBe(TaskStatus.Pending);
    expect(sorted[1]?.status).toBe(TaskStatus.InProgress);
    expect(sorted[2]?.status).toBe(TaskStatus.Done);
  });
});
