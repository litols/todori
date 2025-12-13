/**
 * Core module - Task lifecycle management, dependency tracking, and query engine
 */

export { TaskManager } from "./task-manager.js";
export type {
  CreateTaskOptions,
  UpdateTaskOptions,
} from "./task-manager.js";

export { DependencyGraph } from "./dependency.js";
export type { TopologicalSortResult } from "./dependency.js";

export { QueryEngine } from "./query.js";
export type {
  QueryOptions,
  SortField,
  SortOrder,
  SortOptions,
  NextTaskRecommendation,
} from "./query.js";
