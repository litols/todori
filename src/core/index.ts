/**
 * Core module - Task lifecycle management, dependency tracking, and query engine
 */

export type { TopologicalSortResult } from "./dependency.js";
export { DependencyGraph } from "./dependency.js";
export type {
  NextTaskRecommendation,
  QueryOptions,
  SortField,
  SortOptions,
  SortOrder,
} from "./query.js";
export { QueryEngine } from "./query.js";
export type {
  CreateTaskOptions,
  UpdateTaskOptions,
} from "./task-manager.js";
export { TaskManager } from "./task-manager.js";
