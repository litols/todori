# Todori

**Claude Code-native task management MCP server with minimal context overhead**

[![CI](https://github.com/litols/todori/workflows/CI/badge.svg)](https://github.com/litols/todori/actions)

Todori is a Model Context Protocol (MCP) server designed specifically for Claude Code that provides persistent, structured task management without consuming your precious context window.

## ✨ Features

- 🎯 **Claude Code Integration First**: Uses Claude Code's context understanding for AI-driven task expansion
- 📦 **Minimal Context**: MCP responses target <2KB average to preserve Claude Code's context window
- 📝 **YAML Storage**: Human-readable, git-friendly YAML files for better diff visibility and comment support
- ⚡ **Zero Dependencies**: No database dependencies, runs on Bun for maximum performance
- 🔄 **Session Persistence**: Tasks persist across Claude Code sessions
- 📊 **Dependency Management**: Automatic priority calculation with topological sorting
- 🔍 **Advanced Querying**: Filter, sort, and search tasks efficiently

## 🚀 Quick Start

Install Todori via the Claude MCP registry:

```bash
claude mcp add todori
```

Then start using it in your Claude Code sessions:

```
Create a task: Implement user authentication
Show me all my tasks
Expand task: Implement user authentication
```

## 📚 Documentation

Full documentation is available at **[https://litols.github.io/todori](https://litols.github.io/todori)**

- [Installation Guide](https://litols.github.io/todori/guide/installation)
- [Usage Guide](https://litols.github.io/todori/guide/usage)
- [API Reference](https://litols.github.io/todori/api/reference)

## 🏗️ Architecture

Todori follows the **RPG (Repository Planning Graph) methodology** with explicit dependency ordering:

```
src/
├── server/          # MCP server (stdio transport)
├── storage/         # YAML-based persistence with atomic writes
├── core/            # Task CRUD, dependency graph, query engine
├── expand/          # Claude Code-driven task breakdown
├── commands/        # Claude Code custom commands
└── integration/     # Project detection, session restore
```

See [CLAUDE.md](./CLAUDE.md) for detailed architecture information.

## 🛠️ Development

### Prerequisites

- [Bun](https://bun.sh) 1.3.4 or later
- [mise](https://mise.jdx.dev/) (optional, for version management)

### Setup

```bash
# Install Bun via mise (recommended)
mise install

# Or install Bun directly
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install

# Build the project
bun run build:dist

# Run tests
bun test

# Run linter
bun run lint
```

### Available Scripts

- `bun run build` - Type check
- `bun run build:dist` - Build distribution
- `bun run test` - Run tests in watch mode
- `bun run test:run` - Run tests once
- `bun run lint` - Run Biome linter
- `bun run format` - Format code with Biome
- `bun run check` - Run all checks (build, lint, test)
- `bun run docs:dev` - Start VitePress dev server
- `bun run docs:build` - Build documentation
- `bun run docs:preview` - Preview built documentation

### Manual MCP Configuration

To use the development version, add to your Claude configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Linux/Windows**: `~/.config/claude/config.json`

```json
{
  "mcpServers": {
    "todori": {
      "command": "bun",
      "args": ["/path/to/todori/dist/server/index.js"]
    }
  }
}
```

## 📖 Usage Examples

### Basic Task Management

```
# Create tasks
Create a task: Implement OAuth2 authentication
Create task: Write integration tests with priority 80

# List and filter
Show all tasks
Show pending tasks with priority > 70

# Update tasks
Mark task "Implement OAuth2" as in-progress
Complete task "Write integration tests"
```

### Task Dependencies

```
Create task: Deploy to production
Add dependency: "Deploy to production" depends on "Run integration tests"

# Todori automatically:
# - Validates against circular dependencies
# - Calculates priorities based on dependency graph
# - Shows dependency tree when listing tasks
```

### AI-Driven Task Expansion

```
Create and expand task: Refactor database layer

# Claude Code will:
# 1. Analyze your codebase
# 2. Understand current implementation
# 3. Break down into concrete subtasks
# 4. Create dependency relationships
```

## 🗂️ Task Storage

Tasks are stored in `.todori/tasks.yaml` at your project root:

```yaml
tasks:
  - id: 550e8400-e29b-41d4-a716-446655440000
    title: Implement user authentication
    description: Add JWT-based authentication system
    status: in-progress
    priority: 80
    dependencies: []
    subtasks:
      - id: 6ba7b810-9dad-11d1-80b4-00c04fd430c8
        title: Create user model
        completed: true
    metadata:
      created: 2025-12-14T09:00:00Z
      updated: 2025-12-14T10:30:00Z
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Run checks (`bun run check`)
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## 🙏 Acknowledgments

- Built with the [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk)
- Powered by [Bun](https://bun.sh)
- Documentation built with [VitePress](https://vitepress.dev)

## 📮 Support

- [Documentation](https://litols.github.io/todori)
- [Issue Tracker](https://github.com/litols/todori/issues)
- [Discussions](https://github.com/litols/todori/discussions)

---

Made with ❤️ for Claude Code users
