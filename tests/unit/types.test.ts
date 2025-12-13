import { describe, expect, it } from "vitest";
import type { CommandArg, CustomCommand } from "../../src/types/command.ts";
import type { MCPError, MCPRequest, MCPResponse } from "../../src/types/mcp.ts";
import type { Subtask, Task, TaskMetadata } from "../../src/types/task.ts";
import { Priority, TaskStatus } from "../../src/types/task.ts";

describe("Type Definitions", () => {
  describe("Task Types", () => {
    it("should accept valid Task object", () => {
      const metadata: TaskMetadata = {
        created: "2025-01-01T00:00:00Z",
        updated: "2025-01-01T00:00:00Z",
      };

      const subtask: Subtask = {
        id: "1.1",
        title: "Test subtask",
        status: TaskStatus.Pending,
      };

      const task: Task = {
        id: "1",
        title: "Test task",
        description: "Test description",
        status: TaskStatus.Pending,
        priority: Priority.High,
        dependencies: [],
        subtasks: [subtask],
        metadata,
      };

      expect(task.id).toBe("1");
      expect(task.status).toBe(TaskStatus.Pending);
      expect(task.priority).toBe(Priority.High);
    });

    it("should have all TaskStatus enum values", () => {
      expect(TaskStatus.Pending).toBe("pending");
      expect(TaskStatus.InProgress).toBe("in-progress");
      expect(TaskStatus.Blocked).toBe("blocked");
      expect(TaskStatus.Done).toBe("done");
      expect(TaskStatus.Deferred).toBe("deferred");
      expect(TaskStatus.Cancelled).toBe("cancelled");
    });

    it("should have all Priority enum values", () => {
      expect(Priority.High).toBe("high");
      expect(Priority.Medium).toBe("medium");
      expect(Priority.Low).toBe("low");
    });
  });

  describe("MCP Types", () => {
    it("should accept valid MCPRequest", () => {
      const request: MCPRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "test",
        params: { key: "value" },
      };

      expect(request.jsonrpc).toBe("2.0");
      expect(request.method).toBe("test");
    });

    it("should accept valid MCPResponse with result", () => {
      const response: MCPResponse = {
        jsonrpc: "2.0",
        id: 1,
        result: { data: "success" },
      };

      expect(response.result).toEqual({ data: "success" });
    });

    it("should accept valid MCPResponse with error", () => {
      const error: MCPError = {
        code: -32600,
        message: "Invalid request",
      };

      const response: MCPResponse = {
        jsonrpc: "2.0",
        id: 1,
        error,
      };

      expect(response.error?.code).toBe(-32600);
    });
  });

  describe("Command Types", () => {
    it("should accept valid CommandArg", () => {
      const arg: CommandArg = {
        name: "taskId",
        type: "string",
        required: true,
        description: "ID of the task",
      };

      expect(arg.name).toBe("taskId");
      expect(arg.required).toBe(true);
    });

    it("should accept valid CustomCommand", () => {
      const command: CustomCommand = {
        name: "test-command",
        description: "Test command",
        handler: async () => {
          // Test handler
        },
      };

      expect(command.name).toBe("test-command");
      expect(typeof command.handler).toBe("function");
    });
  });
});
