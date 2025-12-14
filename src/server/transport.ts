/**
 * MCP Server Stdio Transport Layer
 *
 * Implements JSON-RPC 2.0 protocol over stdin/stdout.
 * Reads line-delimited JSON requests from stdin and writes responses to stdout.
 */

import { createInterface } from "node:readline";
import type { MCPError, MCPRequest, MCPResponse } from "../types/mcp.js";
import { invalidRequest, parseError } from "./error-handler.js";

/**
 * Stdio transport for JSON-RPC 2.0 communication
 */
export class StdioTransport {
  private requestHandler?: (req: MCPRequest) => Promise<MCPResponse>;

  /**
   * Register a request handler
   */
  onRequest(handler: (req: MCPRequest) => Promise<MCPResponse>): void {
    this.requestHandler = handler;
  }

  /**
   * Read a single JSON-RPC message from stdin
   * Returns null if input stream ends
   */
  async readMessage(): Promise<MCPRequest | null> {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    return new Promise((resolve) => {
      rl.once("line", (line: string) => {
        rl.close();
        if (!line.trim()) {
          resolve(null);
          return;
        }

        try {
          const parsed = JSON.parse(line);
          resolve(parsed as MCPRequest);
        } catch (_error) {
          // Return null for parse errors - caller will handle
          resolve(null);
        }
      });

      rl.once("close", () => {
        resolve(null);
      });
    });
  }

  /**
   * Write a JSON-RPC response to stdout
   */
  writeMessage(response: MCPResponse): void {
    const json = JSON.stringify(response);
    process.stdout.write(`${json}\n`);
  }

  /**
   * Write an error response to stdout
   */
  writeError(id: string | number | null, error: MCPError): void {
    const response: MCPResponse = {
      jsonrpc: "2.0",
      id: id ?? 0,
      error,
    };
    this.writeMessage(response);
  }

  /**
   * Validate that a request is a valid JSON-RPC 2.0 request
   */
  private validateRequest(req: unknown): req is MCPRequest {
    if (!req || typeof req !== "object") {
      return false;
    }

    const r = req as Partial<MCPRequest>;
    return (
      r.jsonrpc === "2.0" &&
      (typeof r.id === "string" || typeof r.id === "number") &&
      typeof r.method === "string"
    );
  }

  /**
   * Start listening for requests on stdin
   * Processes each line as a JSON-RPC request and writes responses to stdout
   */
  async listen(): Promise<void> {
    if (!this.requestHandler) {
      throw new Error("No request handler registered. Call onRequest() first.");
    }

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    for await (const line of rl) {
      // Skip empty lines
      if (!line.trim()) {
        continue;
      }

      let request: unknown;
      let requestId: string | number | null = null;

      // Parse JSON
      try {
        request = JSON.parse(line);
      } catch (_error) {
        // Invalid JSON - send parse error
        this.writeError(null, parseError({ raw: line }));
        continue;
      }

      // Validate JSON-RPC 2.0 structure
      if (!this.validateRequest(request)) {
        // Get ID if available for error response
        if (request && typeof request === "object" && "id" in request) {
          requestId = (request as { id: string | number }).id;
        }
        this.writeError(requestId, invalidRequest("Invalid JSON-RPC 2.0 request structure"));
        continue;
      }

      // Process valid request
      try {
        const response = await this.requestHandler(request);
        this.writeMessage(response);
      } catch (error) {
        // Unexpected error during request handling
        const errorData =
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
              }
            : { error: String(error) };

        this.writeError(request.id, {
          code: -32603,
          message: "Internal error during request processing",
          data: errorData,
        });
      }
    }
  }

  /**
   * Process a single request and return response
   * Useful for testing without starting the full event loop
   */
  async processRequest(request: unknown): Promise<MCPResponse> {
    if (!this.requestHandler) {
      throw new Error("No request handler registered");
    }

    if (!this.validateRequest(request)) {
      // Extract ID if available
      const id =
        request && typeof request === "object" && "id" in request
          ? (request as { id: string | number }).id
          : 0;

      return {
        jsonrpc: "2.0",
        id,
        error: invalidRequest("Invalid JSON-RPC 2.0 request structure"),
      };
    }

    return await this.requestHandler(request);
  }
}
