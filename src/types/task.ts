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
