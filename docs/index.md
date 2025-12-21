---
layout: home

hero:
  name: Todori
  text: Claude Code-native Task Management
  tagline: Persistent, structured task management MCP server with minimal context overhead
  actions:
    - theme: brand
      text: Get Started
      link: /guide/installation
    - theme: alt
      text: View on GitHub
      link: https://github.com/litols/todori

features:
  - icon: 🎯
    title: Claude Code Integration First
    details: Uses Claude Code's context understanding rather than direct API calls for AI-driven task expansion
  - icon: 📦
    title: Minimal Context
    details: MCP responses target <2KB average to preserve Claude Code's context window
  - icon: 📝
    title: YAML Storage
    details: Human-readable, git-friendly YAML files for better diff visibility and comment support
  - icon: ⚡
    title: Zero Dependencies
    details: No database dependencies, runs on Bun for maximum performance
---

## What is Todori?

**Todori** is a Model Context Protocol (MCP) server designed specifically for Claude Code that provides persistent, structured task management without consuming your precious context window.

Unlike traditional task management tools, Todori is optimized for AI-driven workflows:

- **Context-Aware**: Leverages Claude Code's understanding of your project
- **Lightweight**: Minimal overhead in MCP responses
- **Git-Friendly**: YAML-based storage that works well with version control
- **Fast**: Built on Bun runtime with zero external database dependencies

## Quick Start

Install Todori as an MCP server:

```bash
claude mcp add todori -- npx -y @litols/todori
```

Then start using it in your Claude Code sessions to:
- Track tasks across sessions
- Manage dependencies between tasks
- Automatically expand complex tasks into subtasks
- Query and filter tasks efficiently

[Get Started →](/guide/installation)
