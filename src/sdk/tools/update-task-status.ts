/**
 * update_task_status tool for Claude Agent SDK integration
 *
 * Update the status of a specific task
 */

import { tool as createTool } from "@anthropic-ai/claude-agent-sdk";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { TaskManager } from "../../core/task-manager.js";
import { TaskStore } from "../../storage/task-store.js";
import { TaskStatus } from "../../types/task.js";

/**
 * Zod schema for update_task_status input
 */
const UpdateTaskStatusInputSchema = {
  task_id: z.string().describe("The ID of the task to update"),
  status: z.enum(["pending", "in_progress", "completed"]).describe("The new status for the task"),
};

/**
 * Map SDK status to Todori TaskStatus
 */
function mapStatus(sdkStatus: "pending" | "in_progress" | "completed"): TaskStatus {
  switch (sdkStatus) {
    case "pending":
      return TaskStatus.Pending;
    case "in_progress":
      return TaskStatus.InProgress;
    case "completed":
      return TaskStatus.Done;
  }
}

/**
 * Create an update_task_status tool instance bound to a specific project root
 *
 * @param projectRoot - The project root directory for task storage
 * @returns Tool definition for use with createSdkMcpServer
 */
export function createUpdateTaskStatusTool(projectRoot: string) {
  const taskStore = new TaskStore(projectRoot);
  const taskManager = new TaskManager(taskStore);

  return createTool(
    "update_task_status",
    `Update the status of a specific task.

Changes the status of a task identified by its ID.
Use this to:
- Mark a task as in_progress when starting work
- Mark a task as completed when finished
- Revert a task to pending if needed

Status values:
- pending: Task not yet started
- in_progress: Currently working on
- completed: Task finished`,
    UpdateTaskStatusInputSchema,
    async (args): Promise<CallToolResult> => {
      try {
        const { task_id, status } = args;

        // Get current task to verify it exists
        const existingTask = await taskManager.getTask(task_id);
        if (!existingTask) {
          return {
            content: [
              {
                type: "text",
                text: `Task not found: ${task_id}`,
              },
            ],
            isError: true,
          };
        }

        const previousStatus = existingTask.status;
        const newStatus = mapStatus(status);

        // Update the task
        const updatedTask = await taskManager.updateTask(task_id, {
          status: newStatus,
        });

        if (!updatedTask) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to update task: ${task_id}`,
              },
            ],
            isError: true,
          };
        }

        // Format previous status for display
        const prevStatusDisplay =
          previousStatus === TaskStatus.InProgress
            ? "in_progress"
            : previousStatus === TaskStatus.Done
              ? "completed"
              : previousStatus;

        return {
          content: [
            {
              type: "text",
              text: `Task "${updatedTask.title}" status updated: ${prevStatusDisplay} -> ${status}`,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Error updating task status: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
