/**
 * MCP Tool Handlers - Implements all 11 Todori MCP tools
 *
 * Provides CRUD operations, query capabilities, and subtask management
 * with input validation, error handling, and <2KB response targets.
 */

import { z } from "zod";
import type { TaskManager } from "../core/task-manager.js";
import type { QueryEngine } from "../core/query.js";
import type { MCPToolSchema } from "../types/mcp.js";
import type { Task, Priority, TaskStatus } from "../types/task.js";
import { DependencyGraph } from "../core/dependency.js";
import {
  taskNotFound,
  validationError,
  dependencyCycle,
  invalidParams,
  internalError,
} from "./error-handler.js";

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
// Input Validation Schemas (Zod)
// ============================================================================

const TaskStatusSchema = z.enum([
  "pending",
  "in-progress",
  "blocked",
  "done",
  "deferred",
  "cancelled",
]);

const PrioritySchema = z.enum(["high", "medium", "low"]);

const GetTasksSchema = z.object({
  status: z.union([TaskStatusSchema, z.array(TaskStatusSchema)]).optional(),
  priority: z.union([PrioritySchema, z.array(PrioritySchema)]).optional(),
  createdAfter: z.string().optional(),
  createdBefore: z.string().optional(),
  updatedAfter: z.string().optional(),
  updatedBefore: z.string().optional(),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

const GetTaskSchema = z.object({
  id: z.string().min(1),
});

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  priority: PrioritySchema.optional(),
  dependencies: z.array(z.string()).optional(),
  status: TaskStatusSchema.optional(),
});

const UpdateTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: TaskStatusSchema.optional(),
  priority: PrioritySchema.optional(),
  dependencies: z.array(z.string()).optional(),
});

const DeleteTaskSchema = z.object({
  id: z.string().min(1),
});

const GetNextTaskSchema = z.object({
  status: z.union([TaskStatusSchema, z.array(TaskStatusSchema)]).optional(),
  priority: z.union([PrioritySchema, z.array(PrioritySchema)]).optional(),
});

const QueryTasksSchema = z.object({
  filters: GetTasksSchema.optional(),
  sort: z
    .object({
      field: z.enum(["priority", "created", "updated", "status"]),
      order: z.enum(["asc", "desc"]).optional(),
    })
    .optional(),
  fields: z.array(z.string()).optional(),
});

const GetTaskStatsSchema = z.object({});

const AddSubtaskSchema = z.object({
  parentId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
});

const UpdateSubtaskSchema = z.object({
  subtaskId: z.string().regex(/^.+\.\d+$/),
  status: TaskStatusSchema.optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
});

const DeleteSubtaskSchema = z.object({
  subtaskId: z.string().regex(/^.+\.\d+$/),
});

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
function normalizeFilter<T>(
  filter: T | T[] | undefined,
): T[] | undefined {
  if (!filter) return undefined;
  return Array.isArray(filter) ? filter : [filter];
}

/**
 * Project task fields for minimal response size
 */
function projectTaskFields(task: Task, fields?: string[]): Partial<Task> {
  if (!fields || fields.length === 0) {
    return task;
  }

  const projected: any = {};
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
export async function handleGetTasks(
  params: unknown,
  context: ToolContext,
): Promise<ToolResult> {
  const validation = validateParams(GetTasksSchema, params);
  if (!validation.success) {
    return validation;
  }

  const { status, priority, createdAfter, createdBefore, updatedAfter, updatedBefore, offset, limit } = validation.data;

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

    return { success: true, data: tasks };
  } catch (error) {
    return { success: false, error: internalError("Failed to retrieve tasks", { error: String(error) }) };
  }
}

/**
 * get_task - Retrieve a single task by ID
 */
export async function handleGetTask(
  params: unknown,
  context: ToolContext,
): Promise<ToolResult> {
  const validation = validateParams(GetTaskSchema, params);
  if (!validation.success) {
    return validation;
  }

  const { id } = validation.data;

  try {
    const task = await context.taskManager.getTask(id);
    if (!task) {
      return { success: false, error: taskNotFound(id) };
    }

    return { success: true, data: task };
  } catch (error) {
    return { success: false, error: internalError("Failed to retrieve task", { error: String(error) }) };
  }
}

/**
 * create_task - Create a new task
 */
export async function handleCreateTask(
  params: unknown,
  context: ToolContext,
): Promise<ToolResult> {
  const validation = validateParams(CreateTaskSchema, params);
  if (!validation.success) {
    return validation;
  }

  const { title, description, priority, dependencies, status } = validation.data;

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

    return { success: true, data: task };
  } catch (error) {
    return { success: false, error: internalError("Failed to create task", { error: String(error) }) };
  }
}

/**
 * update_task - Update an existing task
 */
export async function handleUpdateTask(
  params: unknown,
  context: ToolContext,
): Promise<ToolResult> {
  const validation = validateParams(UpdateTaskSchema, params);
  if (!validation.success) {
    return validation;
  }

  const { id, title, description, status, priority, dependencies } = validation.data;

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

    const updatedTask = await context.taskManager.updateTask(id, {
      title,
      description,
      status: status as TaskStatus | undefined,
      priority: priority as Priority | undefined,
      dependencies,
    });

    if (!updatedTask) {
      return { success: false, error: taskNotFound(id) };
    }

    return { success: true, data: updatedTask };
  } catch (error) {
    return { success: false, error: internalError("Failed to update task", { error: String(error) }) };
  }
}

/**
 * delete_task - Delete a task
 */
export async function handleDeleteTask(
  params: unknown,
  context: ToolContext,
): Promise<ToolResult> {
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
    return { success: false, error: internalError("Failed to delete task", { error: String(error) }) };
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

  const { status, priority } = validation.data;

  try {
    const recommendation = await context.queryEngine.getNextTask({
      status: normalizeFilter(status) as TaskStatus[] | undefined,
      priority: normalizeFilter(priority) as Priority[] | undefined,
    });

    return { success: true, data: recommendation };
  } catch (error) {
    return { success: false, error: internalError("Failed to get next task", { error: String(error) }) };
  }
}

/**
 * query_tasks - Advanced query with sorting and field projection
 */
export async function handleQueryTasks(
  params: unknown,
  context: ToolContext,
): Promise<ToolResult> {
  const validation = validateParams(QueryTasksSchema, params);
  if (!validation.success) {
    return validation;
  }

  const { filters, sort, fields } = validation.data;

  try {
    // Apply filters
    let tasks = await context.queryEngine.queryTasks({
      status: filters?.status
        ? normalizeFilter(filters.status) as TaskStatus[] | undefined
        : undefined,
      priority: filters?.priority
        ? normalizeFilter(filters.priority) as Priority[] | undefined
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

    // Apply field projection
    if (fields && fields.length > 0) {
      const projected = tasks.map((task) => projectTaskFields(task, fields));
      return { success: true, data: projected };
    }

    return { success: true, data: tasks };
  } catch (error) {
    return { success: false, error: internalError("Failed to query tasks", { error: String(error) }) };
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
    return { success: false, error: internalError("Failed to get task stats", { error: String(error) }) };
  }
}

/**
 * add_subtask - Add a subtask to a parent task
 */
export async function handleAddSubtask(
  params: unknown,
  context: ToolContext,
): Promise<ToolResult> {
  const validation = validateParams(AddSubtaskSchema, params);
  if (!validation.success) {
    return validation;
  }

  const { parentId, title, description } = validation.data;

  try {
    const updatedTask = await context.taskManager.addSubtask(
      parentId,
      title,
      description,
    );

    if (!updatedTask) {
      return { success: false, error: taskNotFound(parentId) };
    }

    return { success: true, data: updatedTask };
  } catch (error) {
    return { success: false, error: internalError("Failed to add subtask", { error: String(error) }) };
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

  const { subtaskId, status, title, description } = validation.data;

  try {
    const updates: any = {};
    if (status !== undefined) updates.status = status as TaskStatus;
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;

    const updatedTask = await context.taskManager.updateSubtask(
      subtaskId,
      updates,
    );

    if (!updatedTask) {
      return {
        success: false,
        error: taskNotFound(subtaskId),
      };
    }

    return { success: true, data: updatedTask };
  } catch (error) {
    return { success: false, error: internalError("Failed to update subtask", { error: String(error) }) };
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

  const { subtaskId } = validation.data;

  try {
    const updatedTask = await context.taskManager.deleteSubtask(subtaskId);

    if (!updatedTask) {
      return {
        success: false,
        error: taskNotFound(subtaskId),
      };
    }

    return { success: true, data: updatedTask };
  } catch (error) {
    return { success: false, error: internalError("Failed to delete subtask", { error: String(error) }) };
  }
}

// ============================================================================
// Tool Handler Registry
// ============================================================================

/**
 * Map of tool names to handler functions
 */
export const ToolHandlers = {
  get_tasks: handleGetTasks,
  get_task: handleGetTask,
  create_task: handleCreateTask,
  update_task: handleUpdateTask,
  delete_task: handleDeleteTask,
  get_next_task: handleGetNextTask,
  query_tasks: handleQueryTasks,
  get_task_stats: handleGetTaskStats,
  add_subtask: handleAddSubtask,
  update_subtask: handleUpdateSubtask,
  delete_subtask: handleDeleteSubtask,
} as const;

export type ToolName = keyof typeof ToolHandlers;

// ============================================================================
// MCP Tool Schema Definitions
// ============================================================================

/**
 * Get MCP tool schemas for initialization
 */
export function getToolSchemas(): MCPToolSchema[] {
  return [
    {
      name: "get_tasks",
      description:
        "Retrieve tasks with filtering by status, priority, date ranges, and pagination (max 20 tasks)",
      inputSchema: {
        type: "object",
        properties: {
          status: {
            oneOf: [
              {
                type: "string",
                enum: ["pending", "in-progress", "blocked", "done", "deferred", "cancelled"],
              },
              {
                type: "array",
                items: {
                  type: "string",
                  enum: ["pending", "in-progress", "blocked", "done", "deferred", "cancelled"],
                },
              },
            ],
            description: "Filter by status",
          },
          priority: {
            oneOf: [
              { type: "string", enum: ["high", "medium", "low"] },
              { type: "array", items: { type: "string", enum: ["high", "medium", "low"] } },
            ],
            description: "Filter by priority",
          },
          createdAfter: { type: "string", description: "ISO8601 timestamp" },
          createdBefore: { type: "string", description: "ISO8601 timestamp" },
          updatedAfter: { type: "string", description: "ISO8601 timestamp" },
          updatedBefore: { type: "string", description: "ISO8601 timestamp" },
          offset: { type: "number", description: "Pagination offset (default: 0)" },
          limit: { type: "number", description: "Pagination limit (default: 20, max: 20)" },
        },
      },
    },
    {
      name: "get_task",
      description: "Retrieve a single task by ID with full details including subtasks",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "Task UUID" },
        },
      },
    },
    {
      name: "create_task",
      description: "Create a new task with title, description, priority, and dependencies",
      inputSchema: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string", description: "Task title (required, max 200 chars)" },
          description: { type: "string", description: "Optional task description" },
          priority: {
            type: "string",
            enum: ["high", "medium", "low"],
            description: "Priority level (default: medium)",
          },
          dependencies: {
            type: "array",
            items: { type: "string" },
            description: "Array of task IDs this task depends on",
          },
          status: {
            type: "string",
            enum: ["pending", "in-progress", "blocked", "done", "deferred", "cancelled"],
            description: "Initial status (default: pending)",
          },
        },
      },
    },
    {
      name: "update_task",
      description: "Update task fields (status, priority, description, dependencies)",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "Task UUID" },
          title: { type: "string", description: "New task title" },
          description: { type: "string", description: "New task description" },
          status: {
            type: "string",
            enum: ["pending", "in-progress", "blocked", "done", "deferred", "cancelled"],
          },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          dependencies: {
            type: "array",
            items: { type: "string" },
            description: "Replace dependencies list",
          },
        },
      },
    },
    {
      name: "delete_task",
      description: "Delete a task and remove it from all dependent tasks",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "Task UUID to delete" },
        },
      },
    },
    {
      name: "get_next_task",
      description:
        "Recommend the next task to work on based on dependencies and priority",
      inputSchema: {
        type: "object",
        properties: {
          status: {
            oneOf: [
              {
                type: "string",
                enum: ["pending", "in-progress", "blocked", "done", "deferred", "cancelled"],
              },
              {
                type: "array",
                items: {
                  type: "string",
                  enum: ["pending", "in-progress", "blocked", "done", "deferred", "cancelled"],
                },
              },
            ],
            description: "Filter candidates by status (default: pending, in-progress)",
          },
          priority: {
            oneOf: [
              { type: "string", enum: ["high", "medium", "low"] },
              { type: "array", items: { type: "string", enum: ["high", "medium", "low"] } },
            ],
            description: "Filter candidates by priority",
          },
        },
      },
    },
    {
      name: "query_tasks",
      description: "Advanced query with filtering, sorting, and field projection",
      inputSchema: {
        type: "object",
        properties: {
          filters: {
            type: "object",
            description: "Same as get_tasks filters",
            properties: {
              status: {
                oneOf: [
                  {
                    type: "string",
                    enum: ["pending", "in-progress", "blocked", "done", "deferred", "cancelled"],
                  },
                  {
                    type: "array",
                    items: {
                      type: "string",
                      enum: ["pending", "in-progress", "blocked", "done", "deferred", "cancelled"],
                    },
                  },
                ],
              },
              priority: {
                oneOf: [
                  { type: "string", enum: ["high", "medium", "low"] },
                  { type: "array", items: { type: "string", enum: ["high", "medium", "low"] } },
                ],
              },
              createdAfter: { type: "string" },
              createdBefore: { type: "string" },
              updatedAfter: { type: "string" },
              updatedBefore: { type: "string" },
              offset: { type: "number" },
              limit: { type: "number" },
            },
          },
          sort: {
            type: "object",
            properties: {
              field: {
                type: "string",
                enum: ["priority", "created", "updated", "status"],
              },
              order: { type: "string", enum: ["asc", "desc"], default: "asc" },
            },
          },
          fields: {
            type: "array",
            items: { type: "string" },
            description: "Project only these fields: id, title, status, priority, etc.",
          },
        },
      },
    },
    {
      name: "get_task_stats",
      description: "Get aggregate statistics about tasks (counts, completion time, blocked tasks)",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "add_subtask",
      description: "Add a subtask to an existing task",
      inputSchema: {
        type: "object",
        required: ["parentId", "title"],
        properties: {
          parentId: { type: "string", description: "Parent task UUID" },
          title: { type: "string", description: "Subtask title" },
          description: { type: "string", description: "Optional subtask description" },
        },
      },
    },
    {
      name: "update_subtask",
      description: "Update a subtask's status, title, or description",
      inputSchema: {
        type: "object",
        required: ["subtaskId"],
        properties: {
          subtaskId: {
            type: "string",
            description: "Subtask ID in format 'parentId.N' (e.g., 'abc123.2')",
          },
          status: {
            type: "string",
            enum: ["pending", "in-progress", "blocked", "done", "deferred", "cancelled"],
          },
          title: { type: "string" },
          description: { type: "string" },
        },
      },
    },
    {
      name: "delete_subtask",
      description: "Remove a subtask from its parent",
      inputSchema: {
        type: "object",
        required: ["subtaskId"],
        properties: {
          subtaskId: {
            type: "string",
            description: "Subtask ID in format 'parentId.N'",
          },
        },
      },
    },
  ];
}
