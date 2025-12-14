/**
 * Tests for DependencyGraph with cycle detection and topological sort
 */

import { beforeEach, describe, expect, test } from "vitest";
import { DependencyGraph } from "../../src/core/dependency.js";
import type { Task } from "../../src/types/task.js";
import { Priority, TaskStatus } from "../../src/types/task.js";

describe("DependencyGraph", () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  describe("addDependency and removeDependency", () => {
    test("addDependency creates dependency edge", () => {
      graph.addDependency("task-b", "task-a");

      const result = graph.topologicalSort(["task-a", "task-b"]);
      expect(result.sorted).toEqual(["task-a", "task-b"]);
      expect(result.hasCycle).toBe(false);
    });

    test("removeDependency removes edge", () => {
      graph.addDependency("task-b", "task-a");
      graph.removeDependency("task-b", "task-a");

      const result = graph.topologicalSort(["task-a", "task-b"]);
      // Without dependency, either order is valid
      expect(result.sorted.length).toBe(2);
      expect(result.hasCycle).toBe(false);
    });
  });

  describe("topologicalSort - Kahn's algorithm", () => {
    test("linear chain A→B→C sorts correctly", () => {
      graph.addDependency("task-b", "task-a");
      graph.addDependency("task-c", "task-b");

      const result = graph.topologicalSort(["task-a", "task-b", "task-c"]);

      expect(result.sorted).toEqual(["task-a", "task-b", "task-c"]);
      expect(result.hasCycle).toBe(false);
    });

    test("circular dependency A→B→C→A detected", () => {
      graph.addDependency("task-b", "task-a");
      graph.addDependency("task-c", "task-b");
      graph.addDependency("task-a", "task-c");

      const result = graph.topologicalSort(["task-a", "task-b", "task-c"]);

      expect(result.hasCycle).toBe(true);
      expect(result.nodesInCycle?.length).toBeGreaterThan(0);
    });

    test("disconnected tasks handled properly", () => {
      graph.addDependency("task-b", "task-a");
      // task-c is independent

      const result = graph.topologicalSort(["task-a", "task-b", "task-c"]);

      expect(result.sorted.length).toBe(3);
      expect(result.hasCycle).toBe(false);
      // task-a must come before task-b
      expect(result.sorted.indexOf("task-a")).toBeLessThan(result.sorted.indexOf("task-b"));
    });

    test("diamond dependency resolves correctly", () => {
      // A → B → D
      // A → C → D
      graph.addDependency("task-b", "task-a");
      graph.addDependency("task-c", "task-a");
      graph.addDependency("task-d", "task-b");
      graph.addDependency("task-d", "task-c");

      const result = graph.topologicalSort(["task-a", "task-b", "task-c", "task-d"]);

      expect(result.hasCycle).toBe(false);
      expect(result.sorted[0]).toBe("task-a");
      expect(result.sorted[3]).toBe("task-d");
    });

    test("self-loop detected as cycle", () => {
      graph.addDependency("task-a", "task-a");

      const result = graph.topologicalSort(["task-a"]);

      expect(result.hasCycle).toBe(true);
    });
  });

  describe("getBlockedTasks", () => {
    const createTask = (id: string, status: TaskStatus, deps: string[] = []): Task => ({
      id,
      title: `Task ${id}`,
      status,
      priority: Priority.Medium,
      dependencies: deps,
      subtasks: [],
      metadata: {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      },
    });

    test("returns tasks with incomplete dependencies", () => {
      const tasks = [
        createTask("task-a", TaskStatus.Done),
        createTask("task-b", TaskStatus.Pending, ["task-a"]),
        createTask("task-c", TaskStatus.Pending, ["task-d"]),
        createTask("task-d", TaskStatus.Pending),
      ];

      graph = DependencyGraph.fromTasks(tasks);
      const blocked = graph.getBlockedTasks(tasks);

      expect(blocked).toContain("task-c");
      expect(blocked).not.toContain("task-b"); // task-a is done
      expect(blocked).not.toContain("task-d"); // no dependencies
    });

    test("completed tasks not included in blocked list", () => {
      const tasks = [
        createTask("task-a", TaskStatus.Pending),
        createTask("task-b", TaskStatus.Done, ["task-a"]),
      ];

      graph = DependencyGraph.fromTasks(tasks);
      const blocked = graph.getBlockedTasks(tasks);

      expect(blocked).not.toContain("task-b");
    });

    test("tasks with no dependencies not blocked", () => {
      const tasks = [
        createTask("task-a", TaskStatus.Pending),
        createTask("task-b", TaskStatus.Pending),
      ];

      graph = DependencyGraph.fromTasks(tasks);
      const blocked = graph.getBlockedTasks(tasks);

      expect(blocked).toEqual([]);
    });
  });

  describe("fromTasks", () => {
    test("builds graph from task array", () => {
      const tasks: Task[] = [
        {
          id: "task-a",
          title: "Task A",
          status: TaskStatus.Pending,
          priority: Priority.Medium,
          dependencies: [],
          subtasks: [],
          metadata: {
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
          },
        },
        {
          id: "task-b",
          title: "Task B",
          status: TaskStatus.Pending,
          priority: Priority.Medium,
          dependencies: ["task-a"],
          subtasks: [],
          metadata: {
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
          },
        },
      ];

      const built = DependencyGraph.fromTasks(tasks);
      const result = built.topologicalSort(["task-a", "task-b"]);

      expect(result.sorted).toEqual(["task-a", "task-b"]);
    });
  });

  describe("wouldCreateCycle", () => {
    test("detects cycle before adding dependency", () => {
      graph.addDependency("task-b", "task-a");
      graph.addDependency("task-c", "task-b");

      const wouldCycle = graph.wouldCreateCycle("task-a", "task-c");
      expect(wouldCycle).toBe(true);
    });

    test("returns false for valid dependency", () => {
      graph.addDependency("task-b", "task-a");

      const wouldCycle = graph.wouldCreateCycle("task-c", "task-b");
      expect(wouldCycle).toBe(false);
    });
  });
});
