/**
 * TaskManager - Core task lifecycle management with CRUD operations
 */

import { v4 as uuidv4 } from "uuid";
import type { TaskStore } from "../storage/task-store.js";
import type { Priority, Subtask, Task, TaskAssignee } from "../types/task.js";
import { TaskStatus } from "../types/task.js";

/**
 * Options for creating a new task
 */
export interface CreateTaskOptions {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  dependencies?: string[];
  customFields?: Record<string, unknown>;
}

/**
 * Options for updating a task
 */
export interface UpdateTaskOptions {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  dependencies?: string[];
  assignee?: TaskAssignee | null;  // null to clear assignee
  customFields?: Record<string, unknown>;
}

/**
 * TaskManager provides CRUD operations for task lifecycle management
 */
export class TaskManager {
  constructor(private readonly storage: TaskStore) {}

  /**
   * Create a new task
   *
   * @param options - Task creation options
   * @returns The created task
   */
  async createTask(options: CreateTaskOptions): Promise<Task> {
    const tasks = await this.storage.loadTasks();

    const now = new Date().toISOString();
    const task: Task = {
      id: uuidv4(),
      title: options.title,
      description: options.description,
      status: options.status || ("pending" as TaskStatus),
      priority: options.priority || ("medium" as Priority),
      dependencies: options.dependencies || [],
      subtasks: [],
      metadata: {
        created: now,
        updated: now,
      },
      customFields: options.customFields,
    };

    tasks.push(task);
    await this.storage.saveTasks(tasks);

    return task;
  }

  /**
   * Get a task by ID
   *
   * @param id - Task ID
   * @returns The task or null if not found
   */
  async getTask(id: string): Promise<Task | null> {
    const tasks = await this.storage.loadTasks();
    return tasks.find((task) => task.id === id) || null;
  }

  /**
   * Update a task
   *
   * @param id - Task ID
   * @param updates - Fields to update
   * @returns The updated task or null if not found
   */
  async updateTask(id: string, updates: UpdateTaskOptions): Promise<Task | null> {
    const tasks = await this.storage.loadTasks();
    const taskIndex = tasks.findIndex((task) => task.id === id);

    if (taskIndex === -1) {
      return null;
    }

    const task = tasks[taskIndex];
    if (!task) {
      return null;
    }

    const now = new Date().toISOString();

    // Determine assignee value
    let assignee = task.assignee;
    if (updates.assignee !== undefined) {
      assignee = updates.assignee === null ? undefined : updates.assignee;
    }

    // Merge updates with existing task
    const updatedTask: Task = {
      id: task.id,
      title: updates.title !== undefined ? updates.title : task.title,
      description: updates.description !== undefined ? updates.description : task.description,
      status: updates.status !== undefined ? updates.status : task.status,
      priority: updates.priority !== undefined ? updates.priority : task.priority,
      dependencies: updates.dependencies !== undefined ? updates.dependencies : task.dependencies,
      subtasks: task.subtasks,
      assignee,
      customFields: updates.customFields !== undefined ? updates.customFields : task.customFields,
      metadata: {
        created: task.metadata.created,
        updated: now,
        // Set completedAt if status is being changed to 'done'
        completedAt:
          updates.status === TaskStatus.Done
            ? now
            : updates.status !== undefined && (updates.status as TaskStatus) !== TaskStatus.Done
              ? undefined
              : task.metadata.completedAt,
      },
    };

    tasks[taskIndex] = updatedTask;
    await this.storage.saveTasks(tasks);
    return updatedTask;
  }

  /**
   * Delete a task
   *
   * @param id - Task ID
   * @returns true if deleted, false if not found
   */
  async deleteTask(id: string): Promise<boolean> {
    const tasks = await this.storage.loadTasks();
    const initialLength = tasks.length;
    const filteredTasks = tasks.filter((task) => task.id !== id);

    if (filteredTasks.length === initialLength) {
      return false;
    }

    // Remove this task from dependencies of other tasks
    for (const task of filteredTasks) {
      task.dependencies = task.dependencies.filter((depId) => depId !== id);
    }

    await this.storage.saveTasks(filteredTasks);
    return true;
  }

  /**
   * Add a subtask to a parent task
   *
   * @param parentId - Parent task ID
   * @param title - Subtask title
   * @param description - Optional subtask description
   * @returns The updated parent task or null if not found
   */
  async addSubtask(parentId: string, title: string, description?: string): Promise<Task | null> {
    const tasks = await this.storage.loadTasks();
    const taskIndex = tasks.findIndex((task) => task.id === parentId);

    if (taskIndex === -1) {
      return null;
    }

    const task = tasks[taskIndex];
    if (!task) {
      return null;
    }

    const nextSubtaskId = `${parentId}.${task.subtasks.length + 1}`;

    const subtask: Subtask = {
      id: nextSubtaskId,
      title,
      description,
      status: "pending" as TaskStatus,
    };

    task.subtasks.push(subtask);
    task.metadata.updated = new Date().toISOString();

    await this.storage.saveTasks(tasks);
    return task;
  }

  /**
   * Get all subtasks for a parent task
   *
   * @param parentId - Parent task ID
   * @returns Array of subtasks or null if parent not found
   */
  async getSubtasks(parentId: string): Promise<Subtask[] | null> {
    const task = await this.getTask(parentId);
    return task ? task.subtasks : null;
  }

  /**
   * Update a subtask
   *
   * @param subtaskId - Subtask ID in format "parentId.N"
   * @param updates - Fields to update
   * @returns The updated parent task or null if not found
   */
  async updateSubtask(
    subtaskId: string,
    updates: Partial<Omit<Subtask, "id">>,
  ): Promise<Task | null> {
    const tasks = await this.storage.loadTasks();

    // Parse subtask ID to find parent
    const parentId = subtaskId.substring(0, subtaskId.lastIndexOf("."));
    const taskIndex = tasks.findIndex((task) => task.id === parentId);

    if (taskIndex === -1) {
      return null;
    }

    const task = tasks[taskIndex];
    if (!task) {
      return null;
    }

    const subtaskIndex = task.subtasks.findIndex((st) => st.id === subtaskId);

    if (subtaskIndex === -1) {
      return null;
    }

    const existingSubtask = task.subtasks[subtaskIndex];
    if (!existingSubtask) {
      return null;
    }

    // Merge updates
    task.subtasks[subtaskIndex] = {
      ...existingSubtask,
      ...updates,
    };

    task.metadata.updated = new Date().toISOString();
    await this.storage.saveTasks(tasks);

    return task;
  }

  /**
   * Delete a subtask
   *
   * @param subtaskId - Subtask ID in format "parentId.N"
   * @returns The updated parent task or null if not found
   */
  async deleteSubtask(subtaskId: string): Promise<Task | null> {
    const tasks = await this.storage.loadTasks();

    // Parse subtask ID to find parent
    const parentId = subtaskId.substring(0, subtaskId.lastIndexOf("."));
    const taskIndex = tasks.findIndex((task) => task.id === parentId);

    if (taskIndex === -1) {
      return null;
    }

    const task = tasks[taskIndex];
    if (!task) {
      return null;
    }

    const initialLength = task.subtasks.length;
    task.subtasks = task.subtasks.filter((st) => st.id !== subtaskId);

    // Return null if subtask wasn't found
    if (task.subtasks.length === initialLength) {
      return null;
    }

    task.metadata.updated = new Date().toISOString();

    await this.storage.saveTasks(tasks);
    return task;
  }

  /**
   * Get all tasks
   *
   * @returns Array of all tasks
   */
  async getAllTasks(): Promise<Task[]> {
    return await this.storage.loadTasks();
  }
}
