/**
 * Tool Handler Registry
 *
 * Maps tool names to their handler functions for MCP routing.
 */

import {
  handleAddSubtask,
  handleCreateTask,
  handleDeleteSubtask,
  handleDeleteTask,
  handleGetNextTask,
  handleGetTask,
  handleGetTaskStats,
  handleGetTasks,
  handleQueryTasks,
  handleUpdateSubtask,
  handleUpdateTask,
} from "./handlers.js";

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
