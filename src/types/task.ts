/**
 * Task status lifecycle states
 */
export enum TaskStatus {
  Pending = "pending",
  InProgress = "in-progress",
  Blocked = "blocked",
  Done = "done",
  Deferred = "deferred",
  Cancelled = "cancelled",
}

/**
 * Task status type (union of enum values)
 */
export type TaskStatusValue = `${TaskStatus}`;

/**
 * Task priority levels
 */
export enum Priority {
  High = "high",
  Medium = "medium",
  Low = "low",
}

/**
 * Task metadata including timestamps
 */
export interface TaskMetadata {
  created: string;
  updated: string;
  completedAt?: string;
}

/**
 * Subtask representation with hierarchical ID
 */
export interface Subtask {
  id: string;
  title: string;
  status: TaskStatus;
  description?: string;
}

/**
 * Main Task interface with full task data
 */
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  dependencies: string[];
  subtasks: Subtask[];
  metadata: TaskMetadata;
  customFields?: Record<string, unknown>;
}

/**
 * Task response type with optional metadata for MCP responses
 * Used to minimize context window usage by excluding metadata when not needed
 */
export type TaskResponse = Omit<Task, "metadata"> & {
  metadata?: TaskMetadata;
};

/**
 * Convert a Task to TaskResponse, optionally including metadata
 * @param task - The task to convert
 * @param includeMetadata - Whether to include metadata in the response (default: false)
 * @returns TaskResponse with or without metadata
 */
export function toTaskResponse(task: Task, includeMetadata = false): TaskResponse {
  if (includeMetadata) {
    return task;
  }

  const { metadata, ...rest } = task;
  return rest;
}
