---
description: Initialize Todori in the current project
---

# Initialize Todori

Set up Todori task management for the current project.

You should:
1. Check if .todori/ directory already exists
2. If it exists, inform the user Todori is already initialized
3. If not, explain that Todori will:
   - Create a .todori/ directory in the project root
   - Store tasks in .todori/tasks.yaml (human-readable YAML)
   - Track task dependencies and status
4. Ask if the user wants to proceed
5. Once confirmed, create an initial task to get started (or let the user create their first task)

Todori uses YAML for storage, making it:
- Human-readable and editable
- Git-friendly with clean diffs
- Easy to backup and version control
