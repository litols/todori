/**
 * YAML schema validation for task files using Zod
 */

import { z } from "zod";
import { Priority, TaskStatus } from "../types/task.js";

/**
 * Schema version for compatibility checking
 */
export const CURRENT_SCHEMA_VERSION = "1.0.0";

/**
 * Zod schema for TaskStatus enum
 */
const TaskStatusSchema = z.nativeEnum(TaskStatus);

/**
 * Zod schema for Priority enum
 */
const PrioritySchema = z.nativeEnum(Priority);

/**
 * Zod schema for TaskMetadata
 */
const TaskMetadataSchema = z.object({
  created: z.string().datetime(),
  updated: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});

/**
 * Zod schema for Subtask
 */
const SubtaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: TaskStatusSchema,
  description: z.string().optional(),
});

/**
 * Zod schema for Task
 */
const TaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: TaskStatusSchema,
  priority: PrioritySchema,
  dependencies: z.array(z.string().uuid()),
  subtasks: z.array(SubtaskSchema),
  metadata: TaskMetadataSchema,
  customFields: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Zod schema for session info (lastModifiedBy)
 */
const SessionInfoSchema = z.object({
  pid: z.number(),
  startTime: z.string().datetime(),
  hostname: z.string().optional(),
});

/**
 * Zod schema for YAML file format
 */
const TaskFileSchema = z.object({
  version: z.string(),
  projectRoot: z.string().min(1),
  metadata: z.object({
    created: z.string().datetime(),
    updated: z.string().datetime(),
    lastModifiedBy: SessionInfoSchema.optional(),
  }),
  tasks: z.array(TaskSchema),
});

/**
 * Type inference from Zod schemas
 */
export type TaskFile = z.infer<typeof TaskFileSchema>;

/**
 * Validates a parsed YAML task file
 *
 * @param data - Parsed YAML data
 * @returns Validated task file data
 * @throws ZodError with detailed validation errors
 */
export function validateTaskFile(data: unknown): TaskFile {
  return TaskFileSchema.parse(data);
}

/**
 * Checks if the schema version is compatible
 *
 * @param version - Version string from task file
 * @returns true if compatible, false otherwise
 */
export function isCompatibleVersion(version: string): boolean {
  // For now, only exact version match is supported
  // Future: implement semver compatibility checking
  return version === CURRENT_SCHEMA_VERSION;
}

/**
 * Creates an empty task file structure
 *
 * @param projectRoot - Project root directory path
 * @returns Empty task file
 */
export function createEmptyTaskFile(projectRoot: string): TaskFile {
  const now = new Date().toISOString();
  return {
    version: CURRENT_SCHEMA_VERSION,
    projectRoot,
    metadata: {
      created: now,
      updated: now,
    },
    tasks: [],
  };
}
