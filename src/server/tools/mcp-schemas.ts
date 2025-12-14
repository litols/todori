/**
 * MCP Tool Schema Definitions
 *
 * Generates JSON schemas for the MCP protocol's tool initialization.
 * Used during server handshake to describe available tools to clients.
 */

import type { MCPToolSchema } from "../../types/mcp.js";

/**
 * Get MCP tool schemas for initialization
 */
export function getToolSchemas(): MCPToolSchema[] {
  return [
    {
      name: "get_tasks",
      description:
        "Retrieve tasks with filtering by status, priority, date ranges, and pagination (max 20 tasks). Metadata (created/updated/completedAt) excluded by default to save context.",
      inputSchema: {
        type: "object",
        properties: {
          status: {
            oneOf: [
              {
                type: "string",
                enum: ["pending", "in-progress", "blocked", "done", "deferred", "cancelled"],
              },
              {
                type: "array",
                items: {
                  type: "string",
                  enum: ["pending", "in-progress", "blocked", "done", "deferred", "cancelled"],
                },
              },
            ],
            description: "Filter by status",
          },
          priority: {
            oneOf: [
              { type: "string", enum: ["high", "medium", "low"] },
              { type: "array", items: { type: "string", enum: ["high", "medium", "low"] } },
            ],
            description: "Filter by priority",
          },
          createdAfter: { type: "string", description: "ISO8601 timestamp" },
          createdBefore: { type: "string", description: "ISO8601 timestamp" },
          updatedAfter: { type: "string", description: "ISO8601 timestamp" },
          updatedBefore: { type: "string", description: "ISO8601 timestamp" },
          offset: { type: "number", description: "Pagination offset (default: 0)" },
          limit: { type: "number", description: "Pagination limit (default: 20, max: 20)" },
          includeMetadata: {
            type: "boolean",
            description:
              "Include metadata (created/updated/completedAt) in response (default: false)",
          },
        },
      },
    },
    {
      name: "get_task",
      description:
        "Retrieve a single task by ID with full details including subtasks. Metadata excluded by default to save context.",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "Task UUID" },
          includeMetadata: {
            type: "boolean",
            description:
              "Include metadata (created/updated/completedAt) in response (default: false)",
          },
        },
      },
    },
    {
      name: "create_task",
      description:
        "Create a new task with title, description, priority, and dependencies. Metadata excluded by default to save context. IMPORTANT: Always store title and description in English, regardless of user's input language.",
      inputSchema: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string", description: "Task title in English (required, max 200 chars)" },
          description: { type: "string", description: "Optional task description in English" },
          priority: {
            type: "string",
            enum: ["high", "medium", "low"],
            description: "Priority level (default: medium)",
          },
          dependencies: {
            type: "array",
            items: { type: "string" },
            description: "Array of task IDs this task depends on",
          },
          status: {
            type: "string",
            enum: ["pending", "in-progress", "blocked", "done", "deferred", "cancelled"],
            description: "Initial status (default: pending)",
          },
          includeMetadata: {
            type: "boolean",
            description:
              "Include metadata (created/updated/completedAt) in response (default: false)",
          },
        },
      },
    },
    {
      name: "update_task",
      description:
        "Update task fields (status, priority, description, dependencies). Metadata excluded by default to save context. IMPORTANT: Always store title and description in English, regardless of user's input language.",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "Task UUID" },
          title: { type: "string", description: "New task title in English" },
          description: { type: "string", description: "New task description in English" },
          status: {
            type: "string",
            enum: ["pending", "in-progress", "blocked", "done", "deferred", "cancelled"],
          },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          dependencies: {
            type: "array",
            items: { type: "string" },
            description: "Replace dependencies list",
          },
          includeMetadata: {
            type: "boolean",
            description:
              "Include metadata (created/updated/completedAt) in response (default: false)",
          },
        },
      },
    },
    {
      name: "delete_task",
      description: "Delete a task and remove it from all dependent tasks",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "Task UUID to delete" },
        },
      },
    },
    {
      name: "get_next_task",
      description:
        "Recommend the next task to work on based on dependencies and priority. Metadata excluded by default to save context.",
      inputSchema: {
        type: "object",
        properties: {
          status: {
            oneOf: [
              {
                type: "string",
                enum: ["pending", "in-progress", "blocked", "done", "deferred", "cancelled"],
              },
              {
                type: "array",
                items: {
                  type: "string",
                  enum: ["pending", "in-progress", "blocked", "done", "deferred", "cancelled"],
                },
              },
            ],
            description: "Filter candidates by status (default: pending, in-progress)",
          },
          priority: {
            oneOf: [
              { type: "string", enum: ["high", "medium", "low"] },
              { type: "array", items: { type: "string", enum: ["high", "medium", "low"] } },
            ],
            description: "Filter candidates by priority",
          },
          includeMetadata: {
            type: "boolean",
            description:
              "Include metadata (created/updated/completedAt) in response (default: false)",
          },
        },
      },
    },
    {
      name: "query_tasks",
      description:
        "Advanced query with filtering, sorting, and field projection. Metadata excluded by default to save context.",
      inputSchema: {
        type: "object",
        properties: {
          filters: {
            type: "object",
            description: "Same as get_tasks filters",
            properties: {
              status: {
                oneOf: [
                  {
                    type: "string",
                    enum: ["pending", "in-progress", "blocked", "done", "deferred", "cancelled"],
                  },
                  {
                    type: "array",
                    items: {
                      type: "string",
                      enum: ["pending", "in-progress", "blocked", "done", "deferred", "cancelled"],
                    },
                  },
                ],
              },
              priority: {
                oneOf: [
                  { type: "string", enum: ["high", "medium", "low"] },
                  { type: "array", items: { type: "string", enum: ["high", "medium", "low"] } },
                ],
              },
              createdAfter: { type: "string" },
              createdBefore: { type: "string" },
              updatedAfter: { type: "string" },
              updatedBefore: { type: "string" },
              offset: { type: "number" },
              limit: { type: "number" },
            },
          },
          sort: {
            type: "object",
            properties: {
              field: {
                type: "string",
                enum: ["priority", "created", "updated", "status"],
              },
              order: { type: "string", enum: ["asc", "desc"], default: "asc" },
            },
          },
          fields: {
            type: "array",
            items: { type: "string" },
            description: "Project only these fields: id, title, status, priority, etc.",
          },
          includeMetadata: {
            type: "boolean",
            description:
              "Include metadata (created/updated/completedAt) in response (default: false)",
          },
        },
      },
    },
    {
      name: "get_task_stats",
      description: "Get aggregate statistics about tasks (counts, completion time, blocked tasks)",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "add_subtask",
      description:
        "Add a subtask to an existing task. Returns updated parent task. Metadata excluded by default to save context. IMPORTANT: Always store title and description in English, regardless of user's input language.",
      inputSchema: {
        type: "object",
        required: ["parentId", "title"],
        properties: {
          parentId: { type: "string", description: "Parent task UUID" },
          title: { type: "string", description: "Subtask title in English" },
          description: { type: "string", description: "Optional subtask description in English" },
          includeMetadata: {
            type: "boolean",
            description:
              "Include metadata (created/updated/completedAt) in response (default: false)",
          },
        },
      },
    },
    {
      name: "update_subtask",
      description:
        "Update a subtask's status, title, or description. Returns updated parent task. Metadata excluded by default to save context. IMPORTANT: Always store title and description in English, regardless of user's input language.",
      inputSchema: {
        type: "object",
        required: ["subtaskId"],
        properties: {
          subtaskId: {
            type: "string",
            description: "Subtask ID in format 'parentId.N' (e.g., 'abc123.2')",
          },
          status: {
            type: "string",
            enum: ["pending", "in-progress", "blocked", "done", "deferred", "cancelled"],
          },
          title: { type: "string", description: "Subtask title in English" },
          description: { type: "string", description: "Subtask description in English" },
          includeMetadata: {
            type: "boolean",
            description:
              "Include metadata (created/updated/completedAt) in response (default: false)",
          },
        },
      },
    },
    {
      name: "delete_subtask",
      description:
        "Remove a subtask from its parent. Returns updated parent task. Metadata excluded by default to save context.",
      inputSchema: {
        type: "object",
        required: ["subtaskId"],
        properties: {
          subtaskId: {
            type: "string",
            description: "Subtask ID in format 'parentId.N'",
          },
          includeMetadata: {
            type: "boolean",
            description:
              "Include metadata (created/updated/completedAt) in response (default: false)",
          },
        },
      },
    },
  ];
}
