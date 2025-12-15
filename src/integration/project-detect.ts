/**
 * Project root detection and initialization
 * Walks up directory tree to find .git or .todori directory
 * Supports git worktree by detecting main repository root
 */

import { exec } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { promisify } from "node:util";
import { TaskStore } from "../storage/task-store.js";

const execAsync = promisify(exec);

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
 * Check if a project root is a git worktree (not the main repository)
 *
 * @param projectRoot - Project root path
 * @returns true if this is a git worktree, false if main repository or not git
 */
export async function isGitWorktree(projectRoot: string): Promise<boolean> {
  const gitPath = path.join(projectRoot, ".git");

  try {
    const stat = await fs.stat(gitPath);
    // If .git is a file, this is a worktree (worktrees have .git file with gitdir: reference)
    return stat.isFile();
  } catch {
    // No .git found, not a git repository
    return false;
  }
}

/**
 * Get the main repository root for a git worktree
 * If the project is already the main repository, returns the same path
 *
 * @param projectRoot - Worktree project root path
 * @returns Main repository root path
 * @throws Error if unable to resolve main repository
 */
export async function getMainWorktreeRoot(projectRoot: string): Promise<string> {
  // First check if this is actually a worktree
  if (!(await isGitWorktree(projectRoot))) {
    // Already the main repository
    return projectRoot;
  }

  try {
    // Use git to find the common git directory (main repository's .git)
    const { stdout } = await execAsync("git rev-parse --git-common-dir", {
      cwd: projectRoot,
      encoding: "utf-8",
    });

    const gitCommonDir = stdout.trim();

    // If the result is relative (e.g., ".git"), it's already the main repo
    if (gitCommonDir === ".git") {
      return projectRoot;
    }

    // Resolve to absolute path and get parent directory (repository root)
    const absoluteGitDir = path.resolve(projectRoot, gitCommonDir);
    const mainRepoRoot = path.dirname(absoluteGitDir);

    return mainRepoRoot;
  } catch (error) {
    // Fallback: parse .git file manually
    try {
      const gitFilePath = path.join(projectRoot, ".git");
      const gitFileContent = await fs.readFile(gitFilePath, { encoding: "utf-8" });

      // Parse "gitdir: /path/to/main/.git/worktrees/name"
      const match = gitFileContent.match(/^gitdir:\s*(.+)$/m);
      if (match?.[1]) {
        const gitWorktreeDir = match[1].trim();
        // Remove /worktrees/name to get main .git directory
        const gitMainDir = path.resolve(gitWorktreeDir, "../..");
        return path.dirname(gitMainDir);
      }
    } catch {
      // Fallback failed
    }

    throw new Error(
      `Failed to resolve main repository root for worktree at ${projectRoot}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Resolve the storage root for a project
 * For git worktrees, returns the main repository root
 * For regular projects, returns the project root itself
 *
 * @param projectRoot - Project root path
 * @returns Storage root path (main repository root for worktrees)
 */
export async function resolveStorageRoot(projectRoot: string): Promise<string> {
  if (await isGitWorktree(projectRoot)) {
    return await getMainWorktreeRoot(projectRoot);
  }
  return projectRoot;
}

/**
 * Initializes a project by creating .todori directory and empty tasks file
 *
 * @param projectRoot - Project root directory path
 * @throws Error if initialization fails
 */
export async function initializeProject(projectRoot: string): Promise<void> {
  // Resolve storage root (use main repository for worktrees)
  const storageRoot = await resolveStorageRoot(projectRoot);
  const storageDir = path.join(storageRoot, ".todori");

  try {
    // Create .todori directory if it doesn't exist
    await fs.mkdir(storageDir, { recursive: true });

    // Initialize TaskStore with storage root (not project root for worktrees)
    const taskStore = new TaskStore(storageRoot);

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
