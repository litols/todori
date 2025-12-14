/**
 * get_next_task tool for Claude Agent SDK integration
 *
 * Get dependency-aware next task recommendation
 */

import { tool as createTool } from "@anthropic-ai/claude-agent-sdk";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { QueryEngine } from "../../core/query.js";
import { TaskManager } from "../../core/task-manager.js";
import { TaskStore } from "../../storage/task-store.js";
import { type Priority, TaskStatus } from "../../types/task.js";

/**
 * Zod schema for get_next_task input
 */
const GetNextTaskInputSchema = {
  priority: z
    .enum(["high", "medium", "low"])
    .optional()
    .describe("Filter to only consider tasks of this priority"),
};

/**
 * Create a get_next_task tool instance bound to a specific project root
 *
 * @param projectRoot - The project root directory for task storage
 * @returns Tool definition for use with createSdkMcpServer
 */
export function createGetNextTaskTool(projectRoot: string) {
  const taskStore = new TaskStore(projectRoot);
  const taskManager = new TaskManager(taskStore);
  const queryEngine = new QueryEngine(taskManager);

  return createTool(
    "get_next_task",
    `Get the recommended next task to work on.

Uses dependency-aware analysis to recommend a task that:
1. Has no incomplete dependencies
2. Is not blocked
3. Has the highest priority among eligible tasks

Returns the task with rationale explaining why it was recommended.`,
    GetNextTaskInputSchema,
    async (args): Promise<CallToolResult> => {
      try {
        const { priority } = args;

        // Build query options
        const queryOptions: { priority?: Priority } = {};

        if (priority) {
          queryOptions.priority = priority as Priority;
        }

        // Get next task recommendation
        const recommendation = await queryEngine.getNextTask(queryOptions);

        if (!recommendation.task) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    task: null,
                    rationale: recommendation.rationale,
                    message: "No tasks available to work on.",
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        const task = recommendation.task;

        // Map status for SDK compatibility
        const sdkStatus =
          task.status === TaskStatus.InProgress
            ? "in_progress"
            : task.status === TaskStatus.Done
              ? "completed"
              : task.status;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  task: {
                    id: task.id,
                    title: task.title,
                    description: task.description,
                    status: sdkStatus,
                    priority: task.priority,
                    dependencies: task.dependencies,
                  },
                  rationale: recommendation.rationale,
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
              text: `Error getting next task: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
