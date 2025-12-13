/**
 * Project root detection and initialization
 * Walks up directory tree to find .git or .todori directory
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { TaskStore } from "../storage/task-store.js";

/**
 * Detects the project root by walking up the directory tree
 * Looks for .git or .todori directory markers
 *
 * @param startPath - Starting directory path for detection
 * @returns Project root path or null if not found
 */
export async function detectProjectRoot(startPath: string): Promise<string | null> {
  let currentPath = path.resolve(startPath);

  while (true) {
    try {
      // Check for .git directory
      await fs.access(path.join(currentPath, ".git"));
      return currentPath;
    } catch {
      // .git not found, continue
    }

    try {
      // Check for .todori directory
      await fs.access(path.join(currentPath, ".todori"));
      return currentPath;
    } catch {
      // .todori not found, continue
    }

    // Get parent directory
    const parentPath = path.dirname(currentPath);

    // Check if we've reached the filesystem root
    if (parentPath === currentPath) {
      return null;
    }

    currentPath = parentPath;
  }
}

/**
 * Initializes a project by creating .todori directory and empty tasks file
 *
 * @param projectRoot - Project root directory path
 * @throws Error if initialization fails
 */
export async function initializeProject(projectRoot: string): Promise<void> {
  const storageDir = path.join(projectRoot, ".todori");

  try {
    // Create .todori directory if it doesn't exist
    await fs.mkdir(storageDir, { recursive: true });

    // Initialize TaskStore to create empty tasks.yaml
    const taskStore = new TaskStore(projectRoot);

    // Load tasks (will return empty array if file doesn't exist)
    const tasks = await taskStore.loadTasks();

    // If file didn't exist or is new, save empty task list to create the file
    await taskStore.saveTasks(tasks);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to initialize project at ${projectRoot}: ${error.message}`);
    }
    throw error;
  }
}
