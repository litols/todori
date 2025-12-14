# MCP Inspector Guide

The MCP Inspector is a visual testing tool for Model Context Protocol (MCP) servers. It provides an interactive web-based GUI to test and debug your Todori MCP server without writing code.

## What is MCP Inspector?

The MCP Inspector is the official testing tool from the Model Context Protocol project. It consists of:

- **MCP Inspector Client (MCPI)**: A React-based web UI at `http://localhost:6274`
- **MCP Proxy (MCPP)**: A Node.js proxy server that bridges the web UI to your MCP server via stdio

The Inspector allows you to:
- View all available tools and their schemas
- Test tool execution with custom parameters
- View and test prompt templates
- Inspect server resources
- Monitor server logs and notifications in real-time

## Prerequisites

- Node.js 18+ (for running the Inspector proxy)
- Bun 1.3.4+ (recommended runtime for Todori server) OR Node.js 20+ (alternative runtime)
- A built Todori server (`bun run build:dist`)

## Installation

No installation needed. The MCP Inspector runs via `npx` without requiring a global install:

```bash
npx @modelcontextprotocol/inspector
```

## Quick Start

### Option 1: npm script (Recommended)

```bash
# Build the server first if needed
bun run build:dist

# Launch Inspector with Bun runtime (recommended)
bun run inspect

# Or use Node.js runtime
bun run inspect:node
```

### Option 2: Shell Script

```bash
# Build the server first if needed
bun run build:dist

# Run the helper script
bash scripts/inspect.sh        # Uses Bun runtime (default)
bash scripts/inspect.sh node   # Uses Node.js runtime
```

### Option 3: Direct npx Command

```bash
# With Bun (recommended)
npx @modelcontextprotocol/inspector bun dist/server/index.js

# With Node.js
npx @modelcontextprotocol/inspector node dist/server/index.js
```

## Using the Inspector GUI

Once launched, the Inspector will:

1. Start the proxy server on port 6274
2. Launch your Todori MCP server as a subprocess
3. Automatically open `http://localhost:6274` in your browser

### Interface Overview

The Inspector GUI has several main sections:

#### 1. Server Connection Pane (Top)

- **Transport**: Shows the connection type (stdio)
- **Command**: Displays the command used to launch your server
- **Status**: Connection status indicator
- **Environment Variables**: Can add env vars if needed

#### 2. Tools Tab

This is where you'll spend most of your time testing. The Todori server exposes 11 tools:

**Task Retrieval:**
- `get_tasks`: List tasks with filtering (status, priority, date ranges)
- `get_task`: Get a single task by ID with full details
- `get_next_task`: Get recommendation for next task to work on
- `query_tasks`: Advanced queries with sorting and field projection
- `get_task_stats`: Aggregate statistics (counts, completion rates)

**Task Management:**
- `create_task`: Create a new task with title, description, priority
- `update_task`: Modify task fields (status, priority, etc.)
- `delete_task`: Remove a task and clean up dependencies

**Subtask Management:**
- `add_subtask`: Add a subtask to a parent task
- `update_subtask`: Modify subtask status/title/description
- `delete_subtask`: Remove a subtask

**How to test a tool:**
1. Click on a tool name in the list
2. Fill in the JSON parameters in the input field
3. Click "Execute"
4. View the response in the output pane

**Example: Create a task**

```json
{
  "title": "Test task from Inspector",
  "description": "Testing the MCP server",
  "priority": "high",
  "status": "pending"
}
```

**Example: Get all pending tasks**

```json
{
  "status": "pending",
  "limit": 10
}
```

#### 3. Prompts Tab

Todori provides 2 prompt templates for Claude Code:

- **session_restore**: Get project overview with stats and next task
  - No arguments required
  - Returns: Task statistics, recommended next task, recent updates

- **task_context**: Get detailed context for a specific task
  - Argument: `taskId` (string, required)
  - Returns: Task details, dependencies, subtasks, blocking info

**How to test a prompt:**
1. Select a prompt from the list
2. Fill in any required arguments
3. Click "Execute"
4. View the generated prompt content

#### 4. Resources Tab

Resources are read-only data sources. Todori may expose resources in future versions for:
- Task file contents
- Project configuration
- Task statistics as a resource

#### 5. Notifications Pane (Bottom)

Shows real-time server logs and debug information:
- Server startup messages
- Request/response logs
- Error messages
- Debug output from Todori

## Testing Workflow

### 1. Verify Server Connection

After launching, check:
- Connection status shows "Connected"
- All 11 tools are listed in the Tools tab
- Both prompts are listed in the Prompts tab

### 2. Test Basic Operations

**Create a test task:**
```json
{
  "title": "Inspector Test Task",
  "description": "Testing task creation",
  "priority": "medium"
}
```

Note the returned task ID from the response.

**Retrieve the task:**
```json
{
  "id": "<task-id-from-previous-response>"
}
```

**Add a subtask:**
```json
{
  "parentId": "<task-id>",
  "title": "Test subtask",
  "description": "First subtask"
}
```

**Update task status:**
```json
{
  "id": "<task-id>",
  "status": "in-progress"
}
```

### 3. Test Advanced Features

**Query with sorting:**
```json
{
  "filters": {
    "status": ["pending", "in-progress"]
  },
  "sort": {
    "field": "priority",
    "order": "desc"
  },
  "fields": ["id", "title", "status", "priority"]
}
```

**Get statistics:**
```json
{}
```

**Get next task recommendation:**
```json
{
  "status": ["pending"],
  "priority": ["high", "medium"]
}
```

### 4. Test Prompts

**Session restore:**
- No arguments needed
- Returns formatted context for Claude Code

**Task context:**
```json
{
  "taskId": "<task-id>"
}
```

## Debugging Tips

### Server Not Starting

If the Inspector shows connection errors:

1. **Check if server builds:**
   ```bash
   bun run build:dist
   ```

2. **Test server manually:**
   ```bash
   echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}},"id":1}' | bun dist/server/index.js
   ```

   Should output JSON with server info.

3. **Check for port conflicts:**
   The Inspector uses port 6274. Make sure it's not in use:
   ```bash
   lsof -i :6274
   ```

### Tool Execution Fails

1. **Check parameter format:**
   - Parameters must be valid JSON
   - Required fields must be present
   - Enum values must match exactly (e.g., "pending", not "Pending")

2. **Check server logs:**
   - Look at the Notifications pane for error messages
   - Server logs show detailed error information

3. **Validate with schema:**
   - Each tool shows its input schema
   - Make sure your parameters match the expected types

### Data Persistence

The Inspector uses the same `.todori/tasks.yaml` file as production:

- Changes made in Inspector are persisted
- You can edit the YAML file directly and reload
- Test data is mixed with real data (be careful!)

**Tip**: Use a separate test directory for Inspector testing:
```bash
cd /tmp/todori-test
npx @modelcontextprotocol/inspector bun /Users/sirius/workspace/todori/dist/server/index.js
```

## Keyboard Shortcuts

- `Ctrl+C` in terminal: Stop the Inspector server
- Refresh browser: Reconnect to server (server keeps running)

## Best Practices

1. **Always build before testing:**
   ```bash
   bun run build:dist && bun run inspect
   ```

2. **Use Inspector for:**
   - Testing tool schemas and validation
   - Debugging tool implementations
   - Verifying error messages
   - Understanding prompt templates

3. **Don't use Inspector for:**
   - Production task management (use Claude Code instead)
   - Load testing (it's a debugging tool)
   - Concurrent access (single connection only)

## Troubleshooting

### Browser doesn't open automatically

Manually open: `http://localhost:6274`

### "Server disconnected" message

- The server process may have crashed
- Check terminal for error messages
- Try restarting the Inspector

### Changes not reflected

- Make sure you rebuilt: `bun run build:dist`
- Restart the Inspector to pick up new code
- Check that you're editing the right files in `src/`

## Additional Resources

- [MCP Inspector Documentation](https://modelcontextprotocol.io/docs/tools/inspector)
- [MCP Inspector GitHub](https://github.com/modelcontextprotocol/inspector)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/docs/specification)
- [Todori Architecture](https://github.com/litols/todori/blob/main/ARCHITECTURE_MCP.md)

## Security Note

The MCP Inspector is a development tool only. Do not expose it to untrusted networks:
- Runs on localhost by default
- No authentication by default
- Can execute arbitrary tools with any parameters

For production use, integrate Todori with Claude Code or other MCP clients instead.
