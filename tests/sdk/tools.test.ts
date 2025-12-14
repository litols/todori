/**
 * Tests for Todori SDK Tools (get_tasks, get_next_task, update_task_status)
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { createGetNextTaskTool } from "../../src/sdk/tools/get-next-task.js";
import { createGetTasksTool } from "../../src/sdk/tools/get-tasks.js";
import { createTodoWriteTool } from "../../src/sdk/tools/todowrite.js";
import { createUpdateTaskStatusTool } from "../../src/sdk/tools/update-task-status.js";

describe("Todori SDK Tools", () => {
  let testDir: string;
  let todoWriteTool: ReturnType<typeof createTodoWriteTool>;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "todori-sdk-tools-test-"));
    todoWriteTool = createTodoWriteTool(testDir);

    // Create initial tasks
    await todoWriteTool.handler(
      {
        todos: [
          { content: "High Priority Task", status: "pending", activeForm: "Planning high" },
          {
            content: "Medium Priority Task",
            status: "in_progress",
            activeForm: "Working on medium",
          },
          { content: "Completed Task", status: "completed", activeForm: "Done" },
        ],
      },
      {},
    );
  });

  describe("get_tasks tool", () => {
    test("returns all tasks when no filter", async () => {
      const tool = createGetTasksTool(testDir);
      const result = await tool.handler({}, {});

      expect(result.isError).toBeUndefined();

      const content = result.content[0];
      expect(content?.type).toBe("text");

      const data = JSON.parse((content as { type: string; text: string }).text);
      expect(data.total).toBe(3);
    });

    test("filters by status", async () => {
      const tool = createGetTasksTool(testDir);
      const result = await tool.handler({ status: "pending" }, {});

      const data = JSON.parse((result.content[0] as { type: string; text: string }).text);
      expect(data.total).toBe(1);
      expect(data.tasks[0].title).toBe("High Priority Task");
    });

    test("filters in_progress status", async () => {
      const tool = createGetTasksTool(testDir);
      const result = await tool.handler({ status: "in_progress" }, {});

      const data = JSON.parse((result.content[0] as { type: string; text: string }).text);
      expect(data.total).toBe(1);
      expect(data.tasks[0].title).toBe("Medium Priority Task");
    });

    test("respects limit parameter", async () => {
      const tool = createGetTasksTool(testDir);
      const result = await tool.handler({ limit: 2 }, {});

      const data = JSON.parse((result.content[0] as { type: string; text: string }).text);
      expect(data.total).toBe(2);
    });

    test("includes metadata when requested", async () => {
      const tool = createGetTasksTool(testDir);
      const result = await tool.handler({ include_metadata: true, limit: 1 }, {});

      const data = JSON.parse((result.content[0] as { type: string; text: string }).text);
      expect(data.tasks[0].metadata).toBeDefined();
    });
  });

  describe("get_next_task tool", () => {
    test("returns pending task as recommendation", async () => {
      const tool = createGetNextTaskTool(testDir);
      const result = await tool.handler({}, {});

      expect(result.isError).toBeUndefined();

      const data = JSON.parse((result.content[0] as { type: string; text: string }).text);
      expect(data.task).toBeDefined();
      expect(data.rationale).toBeDefined();
    });

    test("returns null when no workable tasks", async () => {
      // Create a directory with only completed tasks
      const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), "todori-empty-test-"));
      const emptyTodoWrite = createTodoWriteTool(emptyDir);

      await emptyTodoWrite.handler(
        {
          todos: [{ content: "Done", status: "completed", activeForm: "Done" }],
        },
        {},
      );

      const tool = createGetNextTaskTool(emptyDir);
      const result = await tool.handler({}, {});

      const data = JSON.parse((result.content[0] as { type: string; text: string }).text);
      expect(data.task).toBeNull();
      expect(data.message).toBeDefined();
    });
  });

  describe("update_task_status tool", () => {
    test("updates task status", async () => {
      // First get the task ID
      const getTasksTool = createGetTasksTool(testDir);
      const tasksResult = await getTasksTool.handler({ status: "pending" }, {});
      const tasksData = JSON.parse((tasksResult.content[0] as { type: string; text: string }).text);
      const taskId = tasksData.tasks[0].id;

      // Update status
      const updateTool = createUpdateTaskStatusTool(testDir);
      const result = await updateTool.handler({ task_id: taskId, status: "in_progress" }, {});

      expect(result.isError).toBeUndefined();
      expect((result.content[0] as { type: string; text: string }).text).toContain(
        "pending -> in_progress",
      );
    });

    test("returns error for non-existent task", async () => {
      const tool = createUpdateTaskStatusTool(testDir);
      const result = await tool.handler({ task_id: "non-existent-id", status: "completed" }, {});

      expect(result.isError).toBe(true);
      expect((result.content[0] as { type: string; text: string }).text).toContain("not found");
    });
  });
});
