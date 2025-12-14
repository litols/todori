/**
 * Zod Validation Schemas for MCP Tool Inputs
 *
 * Defines input validation schemas for all 11 Todori MCP tools.
 */

import { z } from "zod";

/**
 * Task status enum schema
 */
export const TaskStatusSchema = z.enum([
  "pending",
  "in-progress",
  "blocked",
  "done",
  "deferred",
  "cancelled",
]);

/**
 * Priority enum schema
 */
export const PrioritySchema = z.enum(["high", "medium", "low"]);

/**
 * get_tasks input schema
 */
export const GetTasksSchema = z.object({
  status: z.union([TaskStatusSchema, z.array(TaskStatusSchema)]).optional(),
  priority: z.union([PrioritySchema, z.array(PrioritySchema)]).optional(),
  createdAfter: z.string().optional(),
  createdBefore: z.string().optional(),
  updatedAfter: z.string().optional(),
  updatedBefore: z.string().optional(),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

/**
 * get_task input schema
 */
export const GetTaskSchema = z.object({
  id: z.string().min(1),
});

/**
 * create_task input schema
 */
export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  priority: PrioritySchema.optional(),
  dependencies: z.array(z.string()).optional(),
  status: TaskStatusSchema.optional(),
});

/**
 * update_task input schema
 */
export const UpdateTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: TaskStatusSchema.optional(),
  priority: PrioritySchema.optional(),
  dependencies: z.array(z.string()).optional(),
});

/**
 * delete_task input schema
 */
export const DeleteTaskSchema = z.object({
  id: z.string().min(1),
});

/**
 * get_next_task input schema
 */
export const GetNextTaskSchema = z.object({
  status: z.union([TaskStatusSchema, z.array(TaskStatusSchema)]).optional(),
  priority: z.union([PrioritySchema, z.array(PrioritySchema)]).optional(),
});

/**
 * query_tasks input schema
 */
export const QueryTasksSchema = z.object({
  filters: GetTasksSchema.optional(),
  sort: z
    .object({
      field: z.enum(["priority", "created", "updated", "status"]),
      order: z.enum(["asc", "desc"]).optional(),
    })
    .optional(),
  fields: z.array(z.string()).optional(),
});

/**
 * get_task_stats input schema
 */
export const GetTaskStatsSchema = z.object({});

/**
 * add_subtask input schema
 */
export const AddSubtaskSchema = z.object({
  parentId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
});

/**
 * update_subtask input schema
 */
export const UpdateSubtaskSchema = z.object({
  subtaskId: z.string().regex(/^.+\.\d+$/),
  status: TaskStatusSchema.optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
});

/**
 * delete_subtask input schema
 */
export const DeleteSubtaskSchema = z.object({
  subtaskId: z.string().regex(/^.+\.\d+$/),
});
