/**
 * Session restoration - loads task context for session continuation
 * Provides statistics, next task recommendation, and recent tasks
 */

import { TaskStore } from "../storage/task-store.js";
import { TaskManager, QueryEngine } from "../core/index.js";
import type { Task, TaskStatus } from "../types/task.js";

/**
 * Session context containing task statistics and recommendations
 */
export interface SessionContext {
  statistics: Record<string, number>;
  nextTask: Task | null;
  recentTasks: Task[];
  totalTasks: number;
}

/**
 * Restores session context for a project
 *
 * @param projectRoot - Project root directory path
 * @returns SessionContext with statistics and recommendations
 */
export async function restoreSession(
  projectRoot: string,
): Promise<SessionContext> {
  // Initialize storage and core managers
  const taskStore = new TaskStore(projectRoot);
  const taskManager = new TaskManager(taskStore);
  const queryEngine = new QueryEngine(taskManager);

  // Load all tasks
  const allTasks = await taskManager.getAllTasks();

  // Calculate statistics by status
  const statistics: Record<string, number> = {
    pending: 0,
    "in-progress": 0,
    blocked: 0,
    done: 0,
    deferred: 0,
    cancelled: 0,
  };

  for (const task of allTasks) {
    statistics[task.status] = (statistics[task.status] || 0) + 1;
  }

  // Get next recommended task
  const nextTaskResult = await queryEngine.getNextTask();
  const nextTask = nextTaskResult.task;

  // Get 5 most recently updated tasks
  const recentTasks = allTasks
    .sort((a, b) => {
      return (
        new Date(b.metadata.updated).getTime() -
        new Date(a.metadata.updated).getTime()
      );
    })
    .slice(0, 5);

  return {
    statistics,
    nextTask,
    recentTasks,
    totalTasks: allTasks.length,
  };
}
