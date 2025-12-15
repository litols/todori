/**
 * MCP Tool Handler Implementations
 *
 * Implements all 11 Todori MCP tool handlers with input validation,
 * error handling, and <2KB response targets.
 */

import { z } from "zod";
import { DependencyGraph } from "../../core/dependency.js";
import type { QueryEngine } from "../../core/query.js";
import type { TaskManager } from "../../core/task-manager.js";
import {
  type Priority,
  type Subtask,
  type Task,
  type TaskAssignee,
  type TaskResponse,
  type TaskStatus,
  toTaskResponse,
} from "../../types/task.js";
import {
  dependencyCycle,
  internalError,
  invalidParams,
  taskNotFound,
  validationError,
} from "../error-handler.js";
import {
  AddSubtaskSchema,
  CreateTaskSchema,
  DeleteSubtaskSchema,
  DeleteTaskSchema,
  GetNextTaskSchema,
  GetTaskSchema,
  GetTaskStatsSchema,
  GetTasksSchema,
  QueryTasksSchema,
  UpdateSubtaskSchema,
  UpdateTaskSchema,
} from "./schemas.js";

/**
 * Tool handler context
 */
export interface ToolContext {
  taskManager: TaskManager;
  queryEngine: QueryEngine;
  projectRoot: string;
}

/**
 * Tool handler result
 */
export type ToolResult =
  | { success: true; data: unknown }
  | { success: false; error: ReturnType<typeof taskNotFound> };

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate parameters against a Zod schema
 */
function validateParams<T>(
  schema: z.ZodSchema<T>,
  params: unknown,
): { success: true; data: T } | { success: false; error: ReturnType<typeof invalidParams> } {
  try {
    const data = schema.parse(params);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: invalidParams("Invalid parameters", {
          errors: error.issues,
        }),
      };
    }
    return {
      success: false,
      error: invalidParams("Failed to validate parameters"),
    };
  }
}

/**
 * Normalize status/priority filters to arrays
 */
function normalizeFilter<T>(filter: T | T[] | undefined): T[] | undefined {
  if (!filter) return undefined;
  return Array.isArray(filter) ? filter : [filter];
}

/**
 * Project task fields for minimal response size
 */
function projectTaskFields(task: Task | TaskResponse, fields?: string[]): Record<string, unknown> {
  if (!fields || fields.length === 0) {
    return task as Record<string, unknown>;
  }

  const projected: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in task) {
      projected[field] = task[field as keyof Task];
    }
  }
  return projected;
}

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * get_tasks - Retrieve tasks with filtering and pagination
 */
export async function handleGetTasks(params: unknown, context: ToolContext): Promise<ToolResult> {
  const validation = validateParams(GetTasksSchema, params);
  if (!validation.success) {
    return validation;
  }

  const {
    status,
    priority,
    createdAfter,
    createdBefore,
    updatedAfter,
    updatedBefore,
    offset,
    limit,
    includeMetadata,
  } = validation.data;

  try {
    const tasks = await context.queryEngine.queryTasks({
      status: normalizeFilter(status) as TaskStatus[] | undefined,
      priority: normalizeFilter(priority) as Priority[] | undefined,
      createdAfter,
      createdBefore,
      updatedAfter,
      updatedBefore,
      offset: offset || 0,
      limit: Math.min(limit || 20, 20), // Max 20 tasks to stay under 2KB
    });

    const responseTasks = tasks.map((task) => toTaskResponse(task, includeMetadata));
    return { success: true, data: responseTasks };
  } catch (error) {
    return {
      success: false,
      error: internalError("Failed to retrieve tasks", { error: String(error) }),
    };
  }
}

/**
 * get_task - Retrieve a single task by ID
 */
export async function handleGetTask(params: unknown, context: ToolContext): Promise<ToolResult> {
  const validation = validateParams(GetTaskSchema, params);
  if (!validation.success) {
    return validation;
  }

  const { id, includeMetadata } = validation.data;

  try {
    const task = await context.taskManager.getTask(id);
    if (!task) {
      return { success: false, error: taskNotFound(id) };
    }

    return { success: true, data: toTaskResponse(task, includeMetadata) };
  } catch (error) {
    return {
      success: false,
      error: internalError("Failed to retrieve task", { error: String(error) }),
    };
  }
}

/**
 * create_task - Create a new task
 */
export async function handleCreateTask(params: unknown, context: ToolContext): Promise<ToolResult> {
  const validation = validateParams(CreateTaskSchema, params);
  if (!validation.success) {
    return validation;
  }

  const { title, description, priority, dependencies, status, includeMetadata } = validation.data;

  try {
    // Validate dependencies exist
    if (dependencies && dependencies.length > 0) {
      const allTasks = await context.taskManager.getAllTasks();
      const taskIds = new Set(allTasks.map((t) => t.id));

      for (const depId of dependencies) {
        if (!taskIds.has(depId)) {
          return {
            success: false,
            error: validationError(`Dependency task not found: ${depId}`, { depId }),
          };
        }
      }

      // Check for cycles
      const graph = DependencyGraph.fromTasks(allTasks);
      const tempId = "temp-new-task";
      for (const depId of dependencies) {
        if (graph.wouldCreateCycle(tempId, depId)) {
          return {
            success: false,
            error: dependencyCycle({ dependencies }),
          };
        }
      }
    }

    const task = await context.taskManager.createTask({
      title,
      description,
      priority: priority as Priority | undefined,
      dependencies,
      status: status as TaskStatus | undefined,
    });

    return { success: true, data: toTaskResponse(task, includeMetadata) };
  } catch (error) {
    return {
      success: false,
      error: internalError("Failed to create task", { error: String(error) }),
    };
  }
}

/**
 * update_task - Update an existing task
 */
export async function handleUpdateTask(params: unknown, context: ToolContext): Promise<ToolResult> {
  const validation = validateParams(UpdateTaskSchema, params);
  if (!validation.success) {
    return validation;
  }

  const { id, title, description, status, priority, dependencies, assignee, includeMetadata } =
    validation.data;

  try {
    // Check if task exists
    const existingTask = await context.taskManager.getTask(id);
    if (!existingTask) {
      return { success: false, error: taskNotFound(id) };
    }

    // Validate dependencies if provided
    if (dependencies && dependencies.length > 0) {
      const allTasks = await context.taskManager.getAllTasks();
      const taskIds = new Set(allTasks.map((t) => t.id));

      for (const depId of dependencies) {
        if (!taskIds.has(depId)) {
          return {
            success: false,
            error: validationError(`Dependency task not found: ${depId}`, { depId }),
          };
        }
      }

      // Check for cycles
      const graph = DependencyGraph.fromTasks(allTasks);
      // Remove existing dependencies and check with new ones
      for (const depId of existingTask.dependencies) {
        graph.removeDependency(id, depId);
      }
      for (const depId of dependencies) {
        if (graph.wouldCreateCycle(id, depId)) {
          return {
            success: false,
            error: dependencyCycle({ dependencies }),
          };
        }
      }
    }

    // Process assignee - auto-set assignedAt if not provided
    let processedAssignee: TaskAssignee | null | undefined = undefined;
    if (assignee !== undefined) {
      if (assignee === null) {
        processedAssignee = null;
      } else {
        processedAssignee = {
          sessionId: assignee.sessionId,
          assignedAt: assignee.assignedAt || new Date().toISOString(),
        };
      }
    }

    const updatedTask = await context.taskManager.updateTask(id, {
      title,
      description,
      status: status as TaskStatus | undefined,
      priority: priority as Priority | undefined,
      dependencies,
      assignee: processedAssignee,
    });

    if (!updatedTask) {
      return { success: false, error: taskNotFound(id) };
    }

    return { success: true, data: toTaskResponse(updatedTask, includeMetadata) };
  } catch (error) {
    return {
      success: false,
      error: internalError("Failed to update task", { error: String(error) }),
    };
  }
}

/**
 * delete_task - Delete a task
 */
export async function handleDeleteTask(params: unknown, context: ToolContext): Promise<ToolResult> {
  const validation = validateParams(DeleteTaskSchema, params);
  if (!validation.success) {
    return validation;
  }

  const { id } = validation.data;

  try {
    const deleted = await context.taskManager.deleteTask(id);
    if (!deleted) {
      return { success: false, error: taskNotFound(id) };
    }

    return {
      success: true,
      data: {
        success: true,
        deletedId: id,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: internalError("Failed to delete task", { error: String(error) }),
    };
  }
}

/**
 * get_next_task - Get recommendation for next task to work on
 */
export async function handleGetNextTask(
  params: unknown,
  context: ToolContext,
): Promise<ToolResult> {
  const validation = validateParams(GetNextTaskSchema, params);
  if (!validation.success) {
    return validation;
  }

  const { status, priority, currentSessionId, includeMetadata } = validation.data;

  try {
    const recommendation = await context.queryEngine.getNextTask({
      status: normalizeFilter(status) as TaskStatus[] | undefined,
      priority: normalizeFilter(priority) as Priority[] | undefined,
      currentSessionId,
    });

    // If there's a recommended task, apply metadata exclusion
    if (recommendation?.task) {
      return {
        success: true,
        data: {
          ...recommendation,
          task: toTaskResponse(recommendation.task, includeMetadata),
        },
      };
    }

    return { success: true, data: recommendation };
  } catch (error) {
    return {
      success: false,
      error: internalError("Failed to get next task", { error: String(error) }),
    };
  }
}

/**
 * query_tasks - Advanced query with sorting and field projection
 */
export async function handleQueryTasks(params: unknown, context: ToolContext): Promise<ToolResult> {
  const validation = validateParams(QueryTasksSchema, params);
  if (!validation.success) {
    return validation;
  }

  const { filters, sort, fields, includeMetadata } = validation.data;

  try {
    // Apply filters
    let tasks = await context.queryEngine.queryTasks({
      status: filters?.status
        ? (normalizeFilter(filters.status) as TaskStatus[] | undefined)
        : undefined,
      priority: filters?.priority
        ? (normalizeFilter(filters.priority) as Priority[] | undefined)
        : undefined,
      createdAfter: filters?.createdAfter,
      createdBefore: filters?.createdBefore,
      updatedAfter: filters?.updatedAfter,
      updatedBefore: filters?.updatedBefore,
      offset: filters?.offset,
      limit: filters?.limit ? Math.min(filters.limit, 20) : 20,
    });

    // Apply sorting
    if (sort) {
      tasks = context.queryEngine.sortTasks(tasks, {
        field: sort.field,
        order: sort.order,
      });
    }

    // Convert to TaskResponse first (metadata exclusion)
    const responseTasks = tasks.map((task) => toTaskResponse(task, includeMetadata));

    // Apply field projection
    if (fields && fields.length > 0) {
      const projected = responseTasks.map((task) => projectTaskFields(task, fields));
      return { success: true, data: projected };
    }

    return { success: true, data: responseTasks };
  } catch (error) {
    return {
      success: false,
      error: internalError("Failed to query tasks", { error: String(error) }),
    };
  }
}

/**
 * get_task_stats - Get aggregate statistics about tasks
 */
export async function handleGetTaskStats(
  params: unknown,
  context: ToolContext,
): Promise<ToolResult> {
  const validation = validateParams(GetTaskStatsSchema, params);
  if (!validation.success) {
    return validation;
  }

  try {
    const allTasks = await context.taskManager.getAllTasks();

    // Count by status
    const byStatus: Record<string, number> = {
      pending: 0,
      "in-progress": 0,
      blocked: 0,
      done: 0,
      deferred: 0,
      cancelled: 0,
    };

    // Count by priority
    const byPriority: Record<string, number> = {
      high: 0,
      medium: 0,
      low: 0,
    };

    // Track completion times
    const completionTimes: number[] = [];

    // Track dependency stats
    let totalDeps = 0;
    let maxDepth = 0;

    for (const task of allTasks) {
      byStatus[task.status] = (byStatus[task.status] || 0) + 1;
      byPriority[task.priority] = (byPriority[task.priority] || 0) + 1;
      totalDeps += task.dependencies.length;

      // Calculate completion time
      if (task.status === "done" && task.metadata.completedAt) {
        const created = new Date(task.metadata.created).getTime();
        const completed = new Date(task.metadata.completedAt).getTime();
        const days = (completed - created) / (1000 * 60 * 60 * 24);
        completionTimes.push(days);
      }
    }

    // Calculate average completion time
    const avgCompletionDays =
      completionTimes.length > 0
        ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
        : 0;

    // Calculate blocked count
    const graph = DependencyGraph.fromTasks(allTasks);
    const blockedTaskIds = graph.getBlockedTasks(allTasks);

    // Calculate dependency depth (simplified)
    const avgDepsPerTask = allTasks.length > 0 ? totalDeps / allTasks.length : 0;

    // Estimate max depth from tasks
    for (const task of allTasks) {
      if (task.dependencies.length > maxDepth) {
        maxDepth = task.dependencies.length;
      }
    }

    const stats = {
      total: allTasks.length,
      byStatus,
      byPriority,
      blockedCount: blockedTaskIds.length,
      avgCompletionDays: Math.round(avgCompletionDays * 10) / 10,
      dependencyStats: {
        maxDepth,
        averageDepsPerTask: Math.round(avgDepsPerTask * 10) / 10,
      },
    };

    return { success: true, data: stats };
  } catch (error) {
    return {
      success: false,
      error: internalError("Failed to get task stats", { error: String(error) }),
    };
  }
}

/**
 * add_subtask - Add a subtask to a parent task
 */
export async function handleAddSubtask(params: unknown, context: ToolContext): Promise<ToolResult> {
  const validation = validateParams(AddSubtaskSchema, params);
  if (!validation.success) {
    return validation;
  }

  const { parentId, title, description, includeMetadata } = validation.data;

  try {
    const updatedTask = await context.taskManager.addSubtask(parentId, title, description);

    if (!updatedTask) {
      return { success: false, error: taskNotFound(parentId) };
    }

    return { success: true, data: toTaskResponse(updatedTask, includeMetadata) };
  } catch (error) {
    return {
      success: false,
      error: internalError("Failed to add subtask", { error: String(error) }),
    };
  }
}

/**
 * update_subtask - Update a subtask
 */
export async function handleUpdateSubtask(
  params: unknown,
  context: ToolContext,
): Promise<ToolResult> {
  const validation = validateParams(UpdateSubtaskSchema, params);
  if (!validation.success) {
    return validation;
  }

  const { subtaskId, status, title, description, includeMetadata } = validation.data;

  try {
    const updates: Partial<Pick<Subtask, "status" | "title" | "description">> = {};
    if (status !== undefined) updates.status = status as TaskStatus;
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;

    const updatedTask = await context.taskManager.updateSubtask(subtaskId, updates);

    if (!updatedTask) {
      return {
        success: false,
        error: taskNotFound(subtaskId),
      };
    }

    return { success: true, data: toTaskResponse(updatedTask, includeMetadata) };
  } catch (error) {
    return {
      success: false,
      error: internalError("Failed to update subtask", { error: String(error) }),
    };
  }
}

/**
 * delete_subtask - Delete a subtask
 */
export async function handleDeleteSubtask(
  params: unknown,
  context: ToolContext,
): Promise<ToolResult> {
  const validation = validateParams(DeleteSubtaskSchema, params);
  if (!validation.success) {
    return validation;
  }

  const { subtaskId, includeMetadata } = validation.data;

  try {
    const updatedTask = await context.taskManager.deleteSubtask(subtaskId);

    if (!updatedTask) {
      return {
        success: false,
        error: taskNotFound(subtaskId),
      };
    }

    return { success: true, data: toTaskResponse(updatedTask, includeMetadata) };
  } catch (error) {
    return {
      success: false,
      error: internalError("Failed to delete subtask", { error: String(error) }),
    };
  }
}
