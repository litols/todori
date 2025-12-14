/**
 * MCP Prompt Handlers - Provides context-rich prompts for Claude Code
 *
 * Implements session_restore and task_context prompts with <2KB responses.
 */

import type { QueryEngine } from "../core/query.js";
import type { TaskManager } from "../core/task-manager.js";
import type { MCPPromptSchema } from "../types/mcp.js";

/**
 * Prompt handler context
 */
export interface PromptContext {
  taskManager: TaskManager;
  queryEngine: QueryEngine;
  projectRoot: string;
}

/**
 * session_restore - Provides project overview on session initialization
 *
 * Returns task statistics, next recommended task, and recent updates.
 * Target: <2KB response
 */
export async function sessionRestorePrompt(context: PromptContext): Promise<string> {
  const allTasks = await context.taskManager.getAllTasks();

  // Calculate statistics
  const stats = {
    total: allTasks.length,
    pending: allTasks.filter((t) => t.status === "pending").length,
    inProgress: allTasks.filter((t) => t.status === "in-progress").length,
    blocked: allTasks.filter((t) => t.status === "blocked").length,
    done: allTasks.filter((t) => t.status === "done").length,
    deferred: allTasks.filter((t) => t.status === "deferred").length,
    cancelled: allTasks.filter((t) => t.status === "cancelled").length,
  };

  // Get next recommended task
  const recommendation = await context.queryEngine.getNextTask();

  // Get 5 most recently updated tasks
  const recentTasks = [...allTasks]
    .sort((a, b) => {
      const aTime = new Date(a.metadata.updated).getTime();
      const bTime = new Date(b.metadata.updated).getTime();
      return bTime - aTime;
    })
    .slice(0, 5);

  // Build markdown response
  let response = `# Todori Project Status\n\n`;
  response += `**Project Root:** ${context.projectRoot}\n\n`;
  response += `## Task Summary\n\n`;
  response += `Total Tasks: ${stats.total}\n`;
  response += `- Pending: ${stats.pending}\n`;
  response += `- In Progress: ${stats.inProgress}\n`;
  response += `- Blocked: ${stats.blocked}\n`;
  response += `- Done: ${stats.done}\n`;
  response += `- Deferred: ${stats.deferred}\n`;
  response += `- Cancelled: ${stats.cancelled}\n\n`;

  // Next task recommendation
  response += `## Next Task to Work On\n\n`;
  if (recommendation.task) {
    const task = recommendation.task;
    response += `**${task.title}** (${task.priority} priority)\n`;
    response += `Status: ${task.status}\n`;
    if (task.description) {
      response += `\n${task.description}\n`;
    }
    response += `\n*${recommendation.rationale}*\n\n`;
  } else {
    response += `No tasks available.\n`;
    response += `*${recommendation.rationale}*\n\n`;
  }

  // Recent updates
  if (recentTasks.length > 0) {
    response += `## Recent Updates\n\n`;
    for (const task of recentTasks) {
      const updated = new Date(task.metadata.updated);
      const dateStr = updated.toISOString().split("T")[0];
      response += `- **${task.title}** (${task.status}) - ${dateStr}\n`;
    }
  }

  return response;
}

/**
 * task_context - Provides detailed context for a specific task
 *
 * Returns task details, dependencies, dependent tasks, and subtasks.
 * Target: <2KB response
 *
 * @param taskId - Task ID to get context for
 */
export async function taskContextPrompt(taskId: string, context: PromptContext): Promise<string> {
  const task = await context.taskManager.getTask(taskId);

  if (!task) {
    return `# Task Not Found\n\nTask ID: ${taskId}\n\nThis task does not exist in the project.`;
  }

  const allTasks = await context.taskManager.getAllTasks();

  // Build markdown response
  let response = `# Task: ${task.title}\n\n`;
  response += `**ID:** ${task.id}\n`;
  response += `**Status:** ${task.status}\n`;
  response += `**Priority:** ${task.priority}\n`;

  const created = new Date(task.metadata.created);
  const updated = new Date(task.metadata.updated);
  response += `**Created:** ${created.toISOString().split("T")[0]}\n`;
  response += `**Updated:** ${updated.toISOString().split("T")[0]}\n`;

  if (task.metadata.completedAt) {
    const completed = new Date(task.metadata.completedAt);
    response += `**Completed:** ${completed.toISOString().split("T")[0]}\n`;
  }

  // Description
  if (task.description) {
    response += `\n## Description\n\n${task.description}\n`;
  }

  // Dependencies
  if (task.dependencies.length > 0) {
    response += `\n## Dependencies (${task.dependencies.length})\n\n`;
    for (const depId of task.dependencies) {
      const dep = allTasks.find((t) => t.id === depId);
      if (dep) {
        const statusIcon = dep.status === "done" ? "✓" : "○";
        response += `- ${statusIcon} **${dep.title}** (${dep.status})\n`;
      } else {
        response += `- ⚠ Unknown dependency: ${depId}\n`;
      }
    }
  } else {
    response += `\n## Dependencies\n\nNo dependencies\n`;
  }

  // Dependent tasks (tasks that depend on this one)
  const dependentTasks = allTasks.filter((t) => t.dependencies.includes(task.id));
  if (dependentTasks.length > 0) {
    response += `\n## Dependent Tasks (${dependentTasks.length})\n\n`;
    response += `*These tasks are blocked by this task:*\n\n`;
    for (const dep of dependentTasks) {
      response += `- **${dep.title}** (${dep.status})\n`;
    }
  }

  // Subtasks
  if (task.subtasks.length > 0) {
    const completedCount = task.subtasks.filter((st) => st.status === "done").length;
    response += `\n## Subtasks (${completedCount}/${task.subtasks.length} complete)\n\n`;
    for (const subtask of task.subtasks) {
      const checkbox = subtask.status === "done" ? "[x]" : "[ ]";
      response += `- ${checkbox} **${subtask.title}** (${subtask.status})\n`;
      if (subtask.description) {
        response += `  *${subtask.description}*\n`;
      }
    }
  }

  return response;
}

/**
 * Prompt handler type definitions
 */
export type PromptHandler =
  | ((context: PromptContext) => Promise<string>)
  | ((taskId: string, context: PromptContext) => Promise<string>);

/**
 * Prompt handler registry
 */
export const PromptHandlers: Record<string, PromptHandler> = {
  session_restore: sessionRestorePrompt,
  task_context: taskContextPrompt,
};

export type PromptName = keyof typeof PromptHandlers;

/**
 * Get MCP prompt schemas for initialization
 */
export function getPromptSchemas(): MCPPromptSchema[] {
  return [
    {
      name: "session_restore",
      description:
        "Get project overview with task statistics, next recommended task, and recent updates",
      arguments: [],
    },
    {
      name: "task_context",
      description:
        "Get detailed context for a specific task including dependencies, dependent tasks, and subtasks",
      arguments: [
        {
          name: "taskId",
          description: "Task ID to get context for",
          required: true,
        },
      ],
    },
  ];
}
