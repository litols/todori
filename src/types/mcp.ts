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

/**
 * MCP Initialize Request Parameters
 */
export interface MCPInitializeParams {
  protocolVersion: string;
  capabilities: Record<string, unknown>;
  clientInfo: {
    name: string;
    version: string;
  };
}

/**
 * MCP Initialize Result
 */
export interface MCPInitializeResult {
  protocolVersion: string;
  capabilities: {
    tools?: MCPToolSchema[];
    prompts?: MCPPromptSchema[];
  };
  serverInfo: {
    name: string;
    version: string;
  };
}

/**
 * MCP Prompt Schema Definition
 */
export interface MCPPromptSchema {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
}

/**
 * MCP Tool Call Parameters
 */
export interface MCPToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

/**
 * MCP Prompt Get Parameters
 */
export interface MCPPromptGetParams {
  name: string;
  arguments?: Record<string, unknown>;
}
