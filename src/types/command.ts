/**
 * Command argument definition
 */
export interface CommandArg {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

/**
 * Custom command definition for Claude Code integration
 */
export interface CustomCommand {
  name: string;
  description: string;
  args?: CommandArg[];
  handler: (args: Record<string, unknown>) => Promise<void> | void;
}
