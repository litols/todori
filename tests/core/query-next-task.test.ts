/**
 * Tests for QueryEngine - getNextTask recommendation logic
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { QueryEngine } from "../../src/core/query.js";
import { TaskManager } from "../../src/core/task-manager.js";
import { TaskStore } from "../../src/storage/task-store.js";
import { Priority, TaskStatus } from "../../src/types/task.js";

describe("QueryEngine - getNextTask", () => {
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

  test("returns first unblocked task", async () => {
    const taskA = await taskManager.createTask({ title: "Task A" });
    await taskManager.createTask({
      title: "Task B",
      dependencies: [taskA.id],
    });

    const result = await queryEngine.getNextTask();

    expect(result.task).not.toBeNull();
    expect(result.task?.title).toBe("Task A");
    expect(result.rationale).toContain("no dependencies");
  });

  test("respects dependencies - doesn't suggest B if A incomplete", async () => {
    const taskA = await taskManager.createTask({ title: "Task A" });
    const taskB = await taskManager.createTask({
      title: "Task B",
      dependencies: [taskA.id],
    });

    const result = await queryEngine.getNextTask();

    expect(result.task?.id).toBe(taskA.id);
    expect(result.task?.id).not.toBe(taskB.id);
  });

  test("handles no available tasks gracefully", async () => {
    await taskManager.createTask({ title: "Done", status: TaskStatus.Done });

    const result = await queryEngine.getNextTask();

    expect(result.task).toBeNull();
    expect(result.rationale).toContain("No pending or in-progress tasks available");
  });

  test("priority influences recommendation", async () => {
    const _low = await taskManager.createTask({
      title: "Low Priority",
      priority: Priority.Low,
    });
    const _high = await taskManager.createTask({
      title: "High Priority",
      priority: Priority.High,
    });

    const result = await queryEngine.getNextTask();

    expect(result.task?.title).toBe("High Priority");
    expect(result.rationale).toContain("high priority");
  });

  test("returns task when dependencies are complete", async () => {
    const taskA = await taskManager.createTask({
      title: "Task A",
      status: TaskStatus.Done,
    });
    const taskB = await taskManager.createTask({
      title: "Task B",
      dependencies: [taskA.id],
    });

    const result = await queryEngine.getNextTask();

    expect(result.task?.id).toBe(taskB.id);
    expect(result.rationale).toContain("all dependencies completed");
  });

  test("handles all tasks blocked by dependencies", async () => {
    const taskA = await taskManager.createTask({ title: "Task A" });
    const taskB = await taskManager.createTask({
      title: "Task B",
      dependencies: [taskA.id],
    });
    const _taskC = await taskManager.createTask({
      title: "Task C",
      dependencies: [taskB.id],
    });

    // Update A to done, but B is still pending
    await taskManager.updateTask(taskA.id, { status: TaskStatus.Done });

    const result = await queryEngine.getNextTask();

    // Should recommend B since A is done
    expect(result.task?.id).toBe(taskB.id);
  });

  test("respects status filter", async () => {
    await taskManager.createTask({ title: "Pending Task" });
    await taskManager.createTask({
      title: "In Progress",
      status: TaskStatus.InProgress,
    });

    const result = await queryEngine.getNextTask({
      status: TaskStatus.InProgress,
    });

    expect(result.task?.title).toBe("In Progress");
  });

  test("topological ordering with complex dependencies", async () => {
    // A → B → D
    // A → C → D
    const taskA = await taskManager.createTask({
      title: "Task A",
      status: TaskStatus.Done,
    });
    const taskB = await taskManager.createTask({
      title: "Task B",
      dependencies: [taskA.id],
    });
    const taskC = await taskManager.createTask({
      title: "Task C",
      dependencies: [taskA.id],
    });
    const taskD = await taskManager.createTask({
      title: "Task D",
      dependencies: [taskB.id, taskC.id],
    });

    const result = await queryEngine.getNextTask();

    // Should recommend B or C (both unblocked), not D
    expect(result.task).toBeDefined();
    expect(result.task?.id).not.toBe(taskD.id);
    expect([taskB.id, taskC.id]).toContain(result.task?.id || "");
  });

  test("excludes tasks assigned to other sessions when currentSessionId provided", async () => {
    const taskA = await taskManager.createTask({ title: "Task A" });
    const taskB = await taskManager.createTask({ title: "Task B" });

    // Assign Task A to session "feature-1"
    await taskManager.updateTask(taskA.id, {
      assignee: { sessionId: "feature-1", assignedAt: new Date().toISOString() },
    });

    // Query from session "feature-2" - should not see Task A
    const result = await queryEngine.getNextTask({ currentSessionId: "feature-2" });

    expect(result.task).not.toBeNull();
    expect(result.task?.id).toBe(taskB.id);
  });

  test("includes own assigned tasks when currentSessionId matches", async () => {
    const taskA = await taskManager.createTask({ title: "Task A" });
    await taskManager.createTask({ title: "Task B" });

    // Assign Task A to session "feature-1"
    await taskManager.updateTask(taskA.id, {
      assignee: { sessionId: "feature-1", assignedAt: new Date().toISOString() },
    });

    // Query from same session "feature-1" - should see Task A
    const result = await queryEngine.getNextTask({ currentSessionId: "feature-1" });

    expect(result.task).not.toBeNull();
    // Task A should be available (assigned to self)
    expect([taskA.id]).toContain(result.task?.id);
  });

  test("returns all tasks when currentSessionId not provided", async () => {
    const taskA = await taskManager.createTask({ title: "Task A" });
    const _taskB = await taskManager.createTask({ title: "Task B" });

    // Assign Task A to session "feature-1"
    await taskManager.updateTask(taskA.id, {
      assignee: { sessionId: "feature-1", assignedAt: new Date().toISOString() },
    });

    // Query without currentSessionId - should see all tasks
    const result = await queryEngine.getNextTask();

    expect(result.task).not.toBeNull();
  });
});
