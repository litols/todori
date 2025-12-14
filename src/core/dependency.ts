/**
 * DependencyGraph - Dependency tracking with cycle detection using Kahn's algorithm
 */

import type { Task } from "../types/task.js";

/**
 * Result of topological sort
 */
export interface TopologicalSortResult {
  sorted: string[];
  hasCycle: boolean;
  nodesInCycle?: string[];
}

/**
 * DependencyGraph manages task dependency relationships and provides
 * topological sorting with cycle detection
 */
export class DependencyGraph {
  // Adjacency list: task -> tasks that depend on it
  private readonly graph: Map<string, Set<string>>;
  // Reverse adjacency list: task -> tasks it depends on
  private readonly reverseDeps: Map<string, Set<string>>;

  constructor() {
    this.graph = new Map();
    this.reverseDeps = new Map();
  }

  /**
   * Add a dependency edge: taskId depends on dependsOn
   *
   * @param taskId - The task that has a dependency
   * @param dependsOn - The task that taskId depends on
   */
  addDependency(taskId: string, dependsOn: string): void {
    // Add to graph (dependsOn -> taskId)
    if (!this.graph.has(dependsOn)) {
      this.graph.set(dependsOn, new Set());
    }
    this.graph.get(dependsOn)?.add(taskId);

    // Add to reverse dependencies (taskId -> dependsOn)
    if (!this.reverseDeps.has(taskId)) {
      this.reverseDeps.set(taskId, new Set());
    }
    this.reverseDeps.get(taskId)?.add(dependsOn);

    // Ensure nodes exist
    if (!this.graph.has(taskId)) {
      this.graph.set(taskId, new Set());
    }
    if (!this.reverseDeps.has(dependsOn)) {
      this.reverseDeps.set(dependsOn, new Set());
    }
  }

  /**
   * Remove a dependency edge
   *
   * @param taskId - The task that has a dependency
   * @param dependsOn - The task that taskId depends on
   */
  removeDependency(taskId: string, dependsOn: string): void {
    // Remove from graph
    if (this.graph.has(dependsOn)) {
      this.graph.get(dependsOn)?.delete(taskId);
    }

    // Remove from reverse dependencies
    if (this.reverseDeps.has(taskId)) {
      this.reverseDeps.get(taskId)?.delete(dependsOn);
    }
  }

  /**
   * Perform topological sort using Kahn's algorithm
   *
   * @param nodeIds - All node IDs to include in the sort
   * @returns TopologicalSortResult with sorted order and cycle detection
   */
  topologicalSort(nodeIds: string[]): TopologicalSortResult {
    // Calculate in-degrees
    const inDegree = new Map<string, number>();
    const localGraph = new Map<string, Set<string>>();

    // Initialize all nodes
    for (const nodeId of nodeIds) {
      inDegree.set(nodeId, 0);
      localGraph.set(nodeId, new Set());
    }

    // Build local graph and count in-degrees
    for (const nodeId of nodeIds) {
      const deps = this.reverseDeps.get(nodeId);
      if (deps) {
        for (const dep of deps) {
          if (nodeIds.includes(dep)) {
            // Only count dependencies within our node set
            inDegree.set(nodeId, (inDegree.get(nodeId) || 0) + 1);
            localGraph.get(dep)?.add(nodeId);
          }
        }
      }
    }

    // Queue of nodes with 0 in-degree
    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    const sorted: string[] = [];

    // Process nodes with 0 in-degree
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break; // Should never happen, but satisfy type checker
      sorted.push(current);

      // Reduce in-degree of dependent nodes
      const dependents = localGraph.get(current);
      if (dependents) {
        for (const dependent of dependents) {
          const currentDegree = inDegree.get(dependent);
          if (currentDegree === undefined) continue; // Should never happen
          const newDegree = currentDegree - 1;
          inDegree.set(dependent, newDegree);

          if (newDegree === 0) {
            queue.push(dependent);
          }
        }
      }
    }

    // Check for cycles
    const hasCycle = sorted.length !== nodeIds.length;
    const nodesInCycle = hasCycle ? nodeIds.filter((id) => !sorted.includes(id)) : undefined;

    return {
      sorted,
      hasCycle,
      nodesInCycle,
    };
  }

  /**
   * Get tasks that are blocked by incomplete dependencies
   *
   * @param tasks - All tasks
   * @returns Array of task IDs that are blocked
   */
  getBlockedTasks(tasks: Task[]): string[] {
    const blocked: string[] = [];
    const completedTasks = new Set(tasks.filter((t) => t.status === "done").map((t) => t.id));

    for (const task of tasks) {
      // Skip if already done
      if (task.status === "done") {
        continue;
      }

      // Check if any dependency is incomplete
      const hasIncompleteDeps = task.dependencies.some((depId) => !completedTasks.has(depId));

      if (hasIncompleteDeps && task.dependencies.length > 0) {
        blocked.push(task.id);
      }
    }

    return blocked;
  }

  /**
   * Build a dependency graph from tasks
   *
   * @param tasks - Array of tasks
   * @returns A new DependencyGraph instance
   */
  static fromTasks(tasks: Task[]): DependencyGraph {
    const graph = new DependencyGraph();

    for (const task of tasks) {
      for (const depId of task.dependencies) {
        graph.addDependency(task.id, depId);
      }
    }

    return graph;
  }

  /**
   * Check if adding a dependency would create a cycle
   *
   * @param taskId - The task that would have a dependency
   * @param dependsOn - The task that taskId would depend on
   * @returns true if adding this dependency would create a cycle
   */
  wouldCreateCycle(taskId: string, dependsOn: string): boolean {
    // Create a temporary graph with the new dependency
    const tempGraph = new DependencyGraph();

    // Copy existing dependencies
    for (const [node, deps] of this.reverseDeps) {
      for (const dep of deps) {
        tempGraph.addDependency(node, dep);
      }
    }

    // Add the new dependency
    tempGraph.addDependency(taskId, dependsOn);

    // Get all nodes
    const allNodes = new Set<string>();
    for (const node of tempGraph.graph.keys()) {
      allNodes.add(node);
    }
    for (const node of tempGraph.reverseDeps.keys()) {
      allNodes.add(node);
    }

    // Try topological sort
    const result = tempGraph.topologicalSort(Array.from(allNodes));
    return result.hasCycle;
  }
}
