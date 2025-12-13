/**
 * QueryEngine - Advanced task filtering and search with dependency-aware recommendations
 */

import type { Task, TaskStatus, Priority } from "../types/task.js";
import type { TaskManager } from "./task-manager.js";
import { DependencyGraph } from "./dependency.js";

/**
 * Query filter options
 */
export interface QueryOptions {
  status?: TaskStatus | TaskStatus[];
  priority?: Priority | Priority[];
  createdAfter?: string;
  createdBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
  fields?: (keyof Task)[];
  offset?: number;
  limit?: number;
}

/**
 * Sort options
 */
export type SortField = "priority" | "created" | "updated" | "status";
export type SortOrder = "asc" | "desc";

export interface SortOptions {
  field: SortField;
  order?: SortOrder;
}

/**
 * Result for getNextTask recommendation
 */
export interface NextTaskRecommendation {
  task: Task | null;
  rationale: string;
}

/**
 * QueryEngine provides advanced filtering and searching capabilities
 */
export class QueryEngine {
  constructor(private readonly taskManager: TaskManager) {}

  /**
   * Query tasks with advanced filtering
   *
   * @param options - Query filter options
   * @returns Filtered tasks
   */
  async queryTasks(options: QueryOptions = {}): Promise<Task[]> {
    let tasks = await this.taskManager.getAllTasks();

    // Filter by status
    if (options.status) {
      const statuses = Array.isArray(options.status)
        ? options.status
        : [options.status];
      tasks = tasks.filter((task) => statuses.includes(task.status));
    }

    // Filter by priority
    if (options.priority) {
      const priorities = Array.isArray(options.priority)
        ? options.priority
        : [options.priority];
      tasks = tasks.filter((task) => priorities.includes(task.priority));
    }

    // Filter by created date range
    if (options.createdAfter) {
      const after = new Date(options.createdAfter);
      tasks = tasks.filter(
        (task) => new Date(task.metadata.created) >= after,
      );
    }
    if (options.createdBefore) {
      const before = new Date(options.createdBefore);
      tasks = tasks.filter(
        (task) => new Date(task.metadata.created) <= before,
      );
    }

    // Filter by updated date range
    if (options.updatedAfter) {
      const after = new Date(options.updatedAfter);
      tasks = tasks.filter(
        (task) => new Date(task.metadata.updated) >= after,
      );
    }
    if (options.updatedBefore) {
      const before = new Date(options.updatedBefore);
      tasks = tasks.filter(
        (task) => new Date(task.metadata.updated) <= before,
      );
    }

    // Apply field selection
    if (options.fields && options.fields.length > 0) {
      tasks = tasks.map((task) => {
        const filtered: any = {};
        for (const field of options.fields!) {
          filtered[field] = task[field];
        }
        return filtered as Task;
      });
    }

    // Apply pagination
    if (options.offset !== undefined || options.limit !== undefined) {
      const offset = options.offset || 0;
      const limit = options.limit || tasks.length;
      tasks = tasks.slice(offset, offset + limit);
    }

    return tasks;
  }

  /**
   * Sort tasks
   *
   * @param tasks - Tasks to sort
   * @param sortOptions - Sort configuration
   * @returns Sorted tasks
   */
  sortTasks(tasks: Task[], sortOptions: SortOptions): Task[] {
    const { field, order = "asc" } = sortOptions;
    const sorted = [...tasks];

    sorted.sort((a, b) => {
      let compareValue = 0;

      switch (field) {
        case "priority": {
          // High > Medium > Low
          const priorityOrder: Record<Priority, number> = {
            high: 3,
            medium: 2,
            low: 1,
          };
          compareValue = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        }
        case "created":
          compareValue =
            new Date(a.metadata.created).getTime() -
            new Date(b.metadata.created).getTime();
          break;
        case "updated":
          compareValue =
            new Date(a.metadata.updated).getTime() -
            new Date(b.metadata.updated).getTime();
          break;
        case "status": {
          // Define status order: pending < in-progress < blocked < done < deferred < cancelled
          const statusOrder: Record<TaskStatus, number> = {
            pending: 1,
            "in-progress": 2,
            blocked: 3,
            done: 4,
            deferred: 5,
            cancelled: 6,
          };
          compareValue = statusOrder[a.status] - statusOrder[b.status];
          break;
        }
      }

      return order === "asc" ? compareValue : -compareValue;
    });

    return sorted;
  }

  /**
   * Get the next recommended task to work on
   *
   * This method uses dependency-aware topological sorting to recommend
   * the highest priority task that has no incomplete dependencies.
   *
   * @param options - Optional filters for task selection
   * @returns NextTaskRecommendation with task and rationale
   */
  async getNextTask(
    options: QueryOptions = {},
  ): Promise<NextTaskRecommendation> {
    // Get all tasks
    const allTasks = await this.taskManager.getAllTasks();

    // Filter to workable tasks (pending or in-progress)
    const workableTasks = allTasks.filter(
      (task) =>
        task.status === "pending" || task.status === ("in-progress" as TaskStatus),
    );

    if (workableTasks.length === 0) {
      return {
        task: null,
        rationale: "No pending or in-progress tasks available",
      };
    }

    // Apply additional filters from options
    let filteredTasks = workableTasks;
    if (options.status) {
      const statuses = Array.isArray(options.status)
        ? options.status
        : [options.status];
      filteredTasks = filteredTasks.filter((task) =>
        statuses.includes(task.status),
      );
    }
    if (options.priority) {
      const priorities = Array.isArray(options.priority)
        ? options.priority
        : [options.priority];
      filteredTasks = filteredTasks.filter((task) =>
        priorities.includes(task.priority),
      );
    }

    if (filteredTasks.length === 0) {
      return {
        task: null,
        rationale: "No tasks match the specified filters",
      };
    }

    // Build dependency graph
    const graph = DependencyGraph.fromTasks(allTasks);

    // Get blocked tasks
    const blockedTaskIds = new Set(graph.getBlockedTasks(allTasks));

    // Filter out blocked tasks
    const unblockedTasks = filteredTasks.filter(
      (task) => !blockedTaskIds.has(task.id),
    );

    if (unblockedTasks.length === 0) {
      return {
        task: null,
        rationale: "All available tasks are blocked by incomplete dependencies",
      };
    }

    // Perform topological sort on unblocked tasks
    const taskIds = unblockedTasks.map((t) => t.id);
    const sortResult = graph.topologicalSort(taskIds);

    // Sort by priority (high > medium > low)
    const priorityOrder: Record<Priority, number> = {
      high: 3,
      medium: 2,
      low: 1,
    };

    const sortedByPriority = unblockedTasks.sort(
      (a, b) => priorityOrder[b.priority] - priorityOrder[a.priority],
    );

    // Find the first task in topological order with highest priority
    let recommendedTask: Task | null = null;
    let rationale = "";

    // Prefer high priority tasks that are topologically first
    for (const task of sortedByPriority) {
      if (sortResult.sorted.includes(task.id)) {
        recommendedTask = task;
        break;
      }
    }

    if (!recommendedTask && sortResult.sorted.length > 0) {
      // Fallback to first in topological order
      const firstId = sortResult.sorted[0];
      recommendedTask = unblockedTasks.find((t) => t.id === firstId) || null;
    }

    if (!recommendedTask) {
      recommendedTask = sortedByPriority[0] || null;
    }

    // Build rationale
    if (recommendedTask) {
      const reasons: string[] = [];

      if (recommendedTask.priority === "high") {
        reasons.push("high priority");
      }

      if (recommendedTask.dependencies.length === 0) {
        reasons.push("no dependencies");
      } else {
        const allDepsDone = recommendedTask.dependencies.every((depId) => {
          const dep = allTasks.find((t) => t.id === depId);
          return dep?.status === "done";
        });
        if (allDepsDone) {
          reasons.push("all dependencies completed");
        }
      }

      if (sortResult.sorted[0] === recommendedTask.id) {
        reasons.push("topologically first");
      }

      rationale = reasons.length > 0
        ? `Recommended: ${reasons.join(", ")}`
        : "Best available task";
    }

    return {
      task: recommendedTask,
      rationale,
    };
  }
}
