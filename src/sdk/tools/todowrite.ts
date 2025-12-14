/**
 * TodoWrite tool for Claude Agent SDK integration
 *
 * Maps Claude Code's TodoWrite format to Todori's task model
 */

import { tool as createTool } from "@anthropic-ai/claude-agent-sdk";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { TaskStore } from "../../storage/task-store.js";
import { Priority, type Task, TaskStatus } from "../../types/task.js";

/**
 * Zod schema for TodoWrite input item
 */
const TodoWriteItemSchema = z.object({
  content: z.string().describe("The task content/title"),
  status: z.enum(["pending", "in_progress", "completed"]).describe("Current status of the task"),
  activeForm: z.string().describe("Present continuous form of the task (e.g., 'Running tests')"),
});

/**
 * Zod schema for TodoWrite input
 */
const TodoWriteInputSchema = {
  todos: z.array(TodoWriteItemSchema).describe("The updated todo list"),
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
 * Create a TodoWrite tool instance bound to a specific project root
 *
 * @param projectRoot - The project root directory for task storage
 * @returns Tool definition for use with createSdkMcpServer
 */
export function createTodoWriteTool(projectRoot: string) {
  const taskStore = new TaskStore(projectRoot);

  return createTool(
    "todowrite",
    `Write or update the todo list for task tracking.

This tool manages a persistent task list that survives across sessions.
Tasks are stored in ${projectRoot}/.todori/tasks.yaml.

Use this tool to:
- Create new tasks when starting work
- Update task status as you progress
- Mark tasks as completed when done

Task statuses:
- pending: Task not yet started
- in_progress: Currently working on (limit to ONE at a time)
- completed: Task finished successfully`,
    TodoWriteInputSchema,
    async (args): Promise<CallToolResult> => {
      try {
        const { todos } = args;

        // Load existing tasks to preserve IDs and additional metadata
        const existingTasks = await taskStore.loadTasks();

        // Create a map of existing tasks by content for matching
        const existingByContent = new Map<string, Task>();
        for (const task of existingTasks) {
          existingByContent.set(task.title, task);
        }

        // Build new task list from TodoWrite input
        const now = new Date().toISOString();
        const newTasks: Task[] = [];

        for (const todo of todos) {
          const existing = existingByContent.get(todo.content);

          if (existing) {
            // Update existing task
            const updatedTask: Task = {
              ...existing,
              status: mapStatus(todo.status),
              metadata: {
                ...existing.metadata,
                updated: now,
                completedAt: todo.status === "completed" ? now : existing.metadata.completedAt,
              },
              customFields: {
                ...existing.customFields,
                activeForm: todo.activeForm,
              },
            };
            newTasks.push(updatedTask);
            existingByContent.delete(todo.content);
          } else {
            // Create new task
            const newTask: Task = {
              id: uuidv4(),
              title: todo.content,
              status: mapStatus(todo.status),
              priority: Priority.Medium,
              dependencies: [],
              subtasks: [],
              metadata: {
                created: now,
                updated: now,
                completedAt: todo.status === "completed" ? now : undefined,
              },
              customFields: {
                activeForm: todo.activeForm,
              },
            };
            newTasks.push(newTask);
          }
        }

        // Save updated tasks (tasks not in todos are removed)
        await taskStore.saveTasks(newTasks);

        // Build response summary
        const statusCounts = {
          pending: newTasks.filter((t) => t.status === TaskStatus.Pending).length,
          in_progress: newTasks.filter((t) => t.status === TaskStatus.InProgress).length,
          completed: newTasks.filter((t) => t.status === TaskStatus.Done).length,
        };

        return {
          content: [
            {
              type: "text",
              text: `Todo list updated: ${statusCounts.pending} pending, ${statusCounts.in_progress} in progress, ${statusCounts.completed} completed.`,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Error updating todo list: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
