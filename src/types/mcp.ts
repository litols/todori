/**
 * MCP JSON-RPC 2.0 Request
 */
export interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * MCP JSON-RPC 2.0 Error
 */
export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * MCP JSON-RPC 2.0 Response
 */
export interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: MCPError;
}

/**
 * MCP Tool Schema Definition
 */
export interface MCPToolSchema {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}
