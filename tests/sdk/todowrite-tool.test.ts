/**
 * Tests for TodoWrite SDK tool
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { createTodoWriteTool } from "../../src/sdk/tools/todowrite.js";
import { TaskStore } from "../../src/storage/task-store.js";
import { TaskStatus } from "../../src/types/task.js";

describe("TodoWrite SDK Tool", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "todori-sdk-test-"));
  });

  test("creates tasks from todo list", async () => {
    const tool = createTodoWriteTool(testDir);

    const result = await tool.handler(
      {
        todos: [
          { content: "Task 1", status: "pending", activeForm: "Creating Task 1" },
          { content: "Task 2", status: "in_progress", activeForm: "Working on Task 2" },
          { content: "Task 3", status: "completed", activeForm: "Completing Task 3" },
        ],
      },
      {},
    );

    expect(result.isError).toBeUndefined();
    expect(result.content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("1 pending"),
    });

    // Verify tasks were persisted
    const taskStore = new TaskStore(testDir);
    const tasks = await taskStore.loadTasks();

    expect(tasks).toHaveLength(3);
    expect(tasks.find((t) => t.title === "Task 1")?.status).toBe(TaskStatus.Pending);
    expect(tasks.find((t) => t.title === "Task 2")?.status).toBe(TaskStatus.InProgress);
    expect(tasks.find((t) => t.title === "Task 3")?.status).toBe(TaskStatus.Done);
  });

  test("updates existing tasks by content match", async () => {
    const tool = createTodoWriteTool(testDir);

    // Create initial task
    await tool.handler(
      {
        todos: [{ content: "My Task", status: "pending", activeForm: "Planning" }],
      },
      {},
    );

    // Update the task
    await tool.handler(
      {
        todos: [{ content: "My Task", status: "in_progress", activeForm: "Working" }],
      },
      {},
    );

    const taskStore = new TaskStore(testDir);
    const tasks = await taskStore.loadTasks();

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.status).toBe(TaskStatus.InProgress);
  });

  test("removes tasks not in todo list", async () => {
    const tool = createTodoWriteTool(testDir);

    // Create two tasks
    await tool.handler(
      {
        todos: [
          { content: "Keep Me", status: "pending", activeForm: "Keeping" },
          { content: "Remove Me", status: "pending", activeForm: "Removing" },
        ],
      },
      {},
    );

    // Update with only one task
    await tool.handler(
      {
        todos: [{ content: "Keep Me", status: "completed", activeForm: "Completed" }],
      },
      {},
    );

    const taskStore = new TaskStore(testDir);
    const tasks = await taskStore.loadTasks();

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.title).toBe("Keep Me");
  });

  test("stores activeForm in customFields", async () => {
    const tool = createTodoWriteTool(testDir);

    await tool.handler(
      {
        todos: [{ content: "Task", status: "in_progress", activeForm: "Running tests" }],
      },
      {},
    );

    const taskStore = new TaskStore(testDir);
    const tasks = await taskStore.loadTasks();

    expect(tasks[0]?.customFields?.activeForm).toBe("Running tests");
  });

  test("sets completedAt for completed tasks", async () => {
    const tool = createTodoWriteTool(testDir);

    await tool.handler(
      {
        todos: [{ content: "Done Task", status: "completed", activeForm: "Finishing" }],
      },
      {},
    );

    const taskStore = new TaskStore(testDir);
    const tasks = await taskStore.loadTasks();

    expect(tasks[0]?.metadata.completedAt).toBeDefined();
  });
});
