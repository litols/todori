/**
 * get_tasks tool for Claude Agent SDK integration
 *
 * Query tasks with optional filtering
 */

import { tool as createTool } from "@anthropic-ai/claude-agent-sdk";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { QueryEngine } from "../../core/query.js";
import { TaskManager } from "../../core/task-manager.js";
import { TaskStore } from "../../storage/task-store.js";
import { type Priority, type Task, TaskStatus, toTaskResponse } from "../../types/task.js";

/**
 * Zod schema for get_tasks input
 */
const GetTasksInputSchema = {
  status: z
    .enum(["pending", "in_progress", "completed", "all"])
    .optional()
    .describe("Filter by task status. Use 'all' to include all statuses."),
  priority: z.enum(["high", "medium", "low"]).optional().describe("Filter by task priority"),
  limit: z.number().min(1).max(100).optional().describe("Maximum number of tasks to return"),
  include_metadata: z
    .boolean()
    .optional()
    .describe("Include task metadata (created/updated timestamps)"),
};

/**
 * Map SDK status to Todori TaskStatus
 */
function mapStatusToTodori(
  status: "pending" | "in_progress" | "completed" | "all",
): TaskStatus | undefined {
  switch (status) {
    case "pending":
      return TaskStatus.Pending;
    case "in_progress":
      return TaskStatus.InProgress;
    case "completed":
      return TaskStatus.Done;
    case "all":
      return undefined;
  }
}

/**
 * Format task for SDK response (minimal context)
 */
function formatTask(task: Task, includeMetadata: boolean): object {
  const response = toTaskResponse(task, includeMetadata);
  return {
    id: response.id,
    title: response.title,
    description: response.description,
    status: task.status === TaskStatus.InProgress ? "in_progress" : task.status,
    priority: response.priority,
    dependencies: response.dependencies,
    subtasks: response.subtasks.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status === TaskStatus.InProgress ? "in_progress" : s.status,
    })),
    ...(includeMetadata && response.metadata ? { metadata: response.metadata } : {}),
  };
}

/**
 * Create a get_tasks tool instance bound to a specific project root
 *
 * @param projectRoot - The project root directory for task storage
 * @returns Tool definition for use with createSdkMcpServer
 */
export function createGetTasksTool(projectRoot: string) {
  const taskStore = new TaskStore(projectRoot);
  const taskManager = new TaskManager(taskStore);
  const queryEngine = new QueryEngine(taskManager);

  return createTool(
    "get_tasks",
    `Query tasks with optional filtering.

Returns a list of tasks stored in the project's .todori/tasks.yaml file.
Results are optimized for minimal context usage.

Filters:
- status: pending, in_progress, completed, or all
- priority: high, medium, low
- limit: Max number of results (1-100)`,
    GetTasksInputSchema,
    async (args): Promise<CallToolResult> => {
      try {
        const { status, priority, limit, include_metadata } = args;

        // Build query options
        const queryOptions: { status?: TaskStatus; priority?: Priority; limit?: number } = {};

        if (status && status !== "all") {
          queryOptions.status = mapStatusToTodori(status);
        }

        if (priority) {
          queryOptions.priority = priority as Priority;
        }

        if (limit) {
          queryOptions.limit = limit;
        }

        // Execute query
        const tasks = await queryEngine.queryTasks(queryOptions);

        // Format response
        const formattedTasks = tasks.map((t) => formatTask(t, include_metadata ?? false));

        const statusSummary = {
          pending: tasks.filter((t) => t.status === TaskStatus.Pending).length,
          in_progress: tasks.filter((t) => t.status === TaskStatus.InProgress).length,
          completed: tasks.filter((t) => t.status === TaskStatus.Done).length,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  total: tasks.length,
                  summary: statusSummary,
                  tasks: formattedTasks,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Error querying tasks: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
