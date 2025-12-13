/**
 * TaskStore - High-level storage interface for task persistence
 */

import * as path from "node:path";
import * as YAML from "yaml";
import type { Task } from "../types/task.js";
import { atomicWrite, safeRead } from "./file-io.js";
import {
  createEmptyTaskFile,
  isCompatibleVersion,
  type TaskFile,
  validateTaskFile,
} from "./schema.js";

/**
 * Storage directory name within project root
 */
const STORAGE_DIR = ".todori";

/**
 * Task file name
 */
const TASK_FILE = "tasks.yaml";

/**
 * Error thrown when schema version is incompatible
 */
export class SchemaVersionError extends Error {
  constructor(
    message: string,
    public readonly fileVersion: string,
  ) {
    super(message);
    this.name = "SchemaVersionError";
  }
}

/**
 * TaskStore manages task persistence using YAML files
 */
export class TaskStore {
  private readonly storageDir: string;
  private readonly taskFilePath: string;

  constructor(private readonly projectRoot: string) {
    this.storageDir = path.join(projectRoot, STORAGE_DIR);
    this.taskFilePath = path.join(this.storageDir, TASK_FILE);
  }

  /**
   * Load tasks from disk
   *
   * @returns Array of tasks (empty array for new projects)
   * @throws SchemaVersionError if version is incompatible
   * @throws Error for validation or parsing errors
   */
  async loadTasks(): Promise<Task[]> {
    const content = await safeRead(this.taskFilePath);

    // Handle missing file (new project)
    if (content === null) {
      return [];
    }

    // Parse YAML
    const parsed = YAML.parse(content);

    // Validate schema
    const taskFile = validateTaskFile(parsed);

    // Check version compatibility
    if (!isCompatibleVersion(taskFile.version)) {
      throw new SchemaVersionError(
        `Incompatible schema version: ${taskFile.version}. Expected: ${taskFile.version}`,
        taskFile.version,
      );
    }

    return taskFile.tasks;
  }

  /**
   * Save tasks to disk
   *
   * @param tasks - Array of tasks to save
   */
  async saveTasks(tasks: Task[]): Promise<void> {
    // Create task file structure
    const taskFile: TaskFile = {
      ...createEmptyTaskFile(this.projectRoot),
      tasks,
      metadata: {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      },
    };

    // Validate before saving
    validateTaskFile(taskFile);

    // Convert to YAML with readable formatting
    const yamlContent = YAML.stringify(taskFile);

    // Write atomically
    await atomicWrite(this.taskFilePath, yamlContent);
  }

  /**
   * Get the storage directory path
   */
  getStorageDir(): string {
    return this.storageDir;
  }

  /**
   * Get the task file path
   */
  getTaskFilePath(): string {
    return this.taskFilePath;
  }
}
