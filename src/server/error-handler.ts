/**
 * MCP Server Error Handler
 *
 * Provides standardized error codes and error response creation
 * for JSON-RPC 2.0 protocol compliance.
 */

import type { MCPError } from "../types/mcp.js";

/**
 * JSON-RPC 2.0 Standard Error Codes
 */
export const ErrorCode = {
  // Standard JSON-RPC 2.0 errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,

  // Custom server errors (-32000 to -32099)
  TASK_NOT_FOUND: -32000,
  VALIDATION_ERROR: -32001,
  DEPENDENCY_CYCLE: -32002,
  PROJECT_ROOT_NOT_FOUND: -32003,
  FILE_IO_ERROR: -32004,
} as const;

/**
 * Standard error messages
 */
export const ErrorMessage = {
  [ErrorCode.PARSE_ERROR]: "Parse error",
  [ErrorCode.INVALID_REQUEST]: "Invalid Request",
  [ErrorCode.METHOD_NOT_FOUND]: "Method not found",
  [ErrorCode.INVALID_PARAMS]: "Invalid params",
  [ErrorCode.INTERNAL_ERROR]: "Internal error",
  [ErrorCode.TASK_NOT_FOUND]: "Task not found",
  [ErrorCode.VALIDATION_ERROR]: "Validation error",
  [ErrorCode.DEPENDENCY_CYCLE]: "Dependency cycle detected",
  [ErrorCode.PROJECT_ROOT_NOT_FOUND]: "Project root not found",
  [ErrorCode.FILE_IO_ERROR]: "File I/O error",
} as const;

/**
 * Create a standard MCP error object
 */
export function createError(code: number, message?: string, data?: unknown): MCPError {
  return {
    code,
    message: message || ErrorMessage[code as keyof typeof ErrorMessage] || "Unknown error",
    data,
  };
}

/**
 * Create a parse error (malformed JSON)
 */
export function parseError(data?: unknown): MCPError {
  return createError(ErrorCode.PARSE_ERROR, undefined, data);
}

/**
 * Create an invalid request error
 */
export function invalidRequest(message?: string, data?: unknown): MCPError {
  return createError(ErrorCode.INVALID_REQUEST, message, data);
}

/**
 * Create a method not found error
 */
export function methodNotFound(method: string): MCPError {
  return createError(ErrorCode.METHOD_NOT_FOUND, undefined, { method });
}

/**
 * Create an invalid params error
 */
export function invalidParams(message?: string, data?: unknown): MCPError {
  return createError(ErrorCode.INVALID_PARAMS, message, data);
}

/**
 * Create an internal error
 */
export function internalError(message?: string, data?: unknown): MCPError {
  return createError(ErrorCode.INTERNAL_ERROR, message, data);
}

/**
 * Create a task not found error
 */
export function taskNotFound(taskId: string): MCPError {
  return createError(ErrorCode.TASK_NOT_FOUND, undefined, { taskId });
}

/**
 * Create a validation error
 */
export function validationError(message: string, data?: unknown): MCPError {
  return createError(ErrorCode.VALIDATION_ERROR, message, data);
}

/**
 * Create a dependency cycle error
 */
export function dependencyCycle(data?: unknown): MCPError {
  return createError(ErrorCode.DEPENDENCY_CYCLE, undefined, data);
}

/**
 * Create a project root not found error
 */
export function projectRootNotFound(searchPath?: string): MCPError {
  return createError(
    ErrorCode.PROJECT_ROOT_NOT_FOUND,
    "Could not locate project root. Ensure .git or .todori directory exists.",
    { searchPath },
  );
}

/**
 * Create a file I/O error
 */
export function fileIoError(message: string, data?: unknown): MCPError {
  return createError(ErrorCode.FILE_IO_ERROR, message, data);
}
