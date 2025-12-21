# Installation

## Prerequisites

- Node.js 18 or later (for npx)
- Claude Code CLI or Claude Desktop with MCP support

## Installation via Claude MCP

The easiest way to install Todori is through the Claude MCP command:

```bash
claude mcp add todori -- npx -y @litols/todori
```

This command will:
1. Configure Todori as an MCP server in your Claude configuration
2. Make it available in all your Claude Code sessions
3. Automatically download the latest version when needed

## Installation via Claude Code Plugin

You can also install Todori as a Claude Code plugin, which includes slash commands for quick access:

```bash
# Install the plugin from GitHub
claude plugin add https://github.com/litols/todori
```

After installation, restart Claude Code and use the slash commands:

```
/todori-tasks       # Show all tasks
/todori-next        # Get recommended next task (view only)
/todori-claim       # Claim next task for this session (assigns + starts)
/todori-release     # Release a claimed task
/todori-add         # Add a new task
/todori-done        # Mark task as completed
/todori-status      # Show multi-session task overview
/todori-init        # Initialize Todori in project
```

**next vs claim**: `/todori-next` only shows the recommended task, while `/todori-claim` also assigns it to your session and sets status to "in-progress". Use `claim` for multi-agent workflows with ccmanager.

## Manual Installation

If you prefer to install manually or want to use the development version:

### 1. Clone the Repository

```bash
git clone https://github.com/litols/todori.git
cd todori
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Build the Project

```bash
bun run build:dist
```

### 4. Configure MCP Server

Add Todori to your Claude configuration file:

**For Claude Desktop (macOS):**

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "todori": {
      "command": "npx",
      "args": ["-y", "@litols/todori"]
    }
  }
}
```

**For Claude Code CLI:**

Edit `~/.config/claude/config.json`:

```json
{
  "mcpServers": {
    "todori": {
      "command": "npx",
      "args": ["-y", "@litols/todori"]
    }
  }
}
```

For development, you can also use a local build:

```json
{
  "mcpServers": {
    "todori": {
      "command": "node",
      "args": ["/path/to/todori/dist/server/index.js"]
    }
  }
}
```

## Verification

After installation, verify that Todori is working:

1. Start a new Claude Code session
2. The MCP server should automatically connect
3. Try creating a task:

```
Create a task: Write documentation
```

If the task is created successfully, Todori is properly configured!

## Configuration

### Task Storage Location

By default, Todori stores tasks in `.todori/tasks.yaml` in your project directory. This location is automatically created when you create your first task.

### Project Detection

Todori automatically detects your project root by looking for:
- Git repository (`.git` directory)
- Package manager files (`package.json`, `Cargo.toml`, `go.mod`, etc.)

You can also manually specify the project root in your MCP configuration:

```json
{
  "mcpServers": {
    "todori": {
      "command": "npx",
      "args": ["-y", "@litols/todori"],
      "env": {
        "TODORI_PROJECT_ROOT": "/path/to/your/project"
      }
    }
  }
}
```

## Troubleshooting

### MCP Server Not Connecting

1. Check that Node.js is installed: `node --version`
2. Verify npx is available: `npx --version`
3. Check Claude's logs for error messages

### Tasks Not Persisting

1. Verify write permissions in your project directory
2. Check that `.todori/` directory can be created
3. Ensure you're in a detected project directory

### Permission Issues

On Unix-like systems, ensure the server script is executable:

```bash
chmod +x /path/to/todori/dist/server/index.js
```

## Next Steps

- [Learn how to use Todori](/guide/usage)
- [Explore the API reference](/api/reference)
