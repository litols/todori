/**
 * Atomic file I/O operations for reliable task persistence
 * Implements write-fsync-rename pattern for ACID guarantees
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as lockfile from "proper-lockfile";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import {
  formatSessionInfo,
  getCurrentSession,
  type SessionInfo,
  type SessionLock,
} from "../types/session.js";

/**
 * Custom error types for file I/O operations
 */
export class FileIOError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly filePath?: string,
  ) {
    super(message);
    this.name = "FileIOError";
  }
}

/**
 * Lock timeout in milliseconds
 */
const LOCK_TIMEOUT = 5000;

/**
 * Lock retry configuration
 */
const LOCK_RETRY_CONFIG = {
  retries: 3,
  minTimeout: 100,
  maxTimeout: 1000,
  factor: 2, // Exponential backoff factor
};

/**
 * Session lock file name within .todori directory
 */
const SESSION_LOCK_FILE = "session-lock.yaml";

/**
 * Get the session lock file path for a given tasks file
 */
function getSessionLockPath(tasksFilePath: string): string {
  const dirPath = path.dirname(tasksFilePath);
  return path.join(dirPath, SESSION_LOCK_FILE);
}

/**
 * Write session lock information to file
 */
async function writeSessionLock(tasksFilePath: string, session: SessionInfo): Promise<void> {
  const lockPath = getSessionLockPath(tasksFilePath);
  const now = new Date().toISOString();

  const lockData: SessionLock = {
    session,
    acquiredAt: now,
    lastActiveAt: now,
    lockFile: tasksFilePath,
  };

  const content = yamlStringify(lockData);
  await fs.writeFile(lockPath, content, { encoding: "utf-8" });
}

/**
 * Read current session lock information
 * Returns null if no lock file exists
 */
async function readSessionLock(tasksFilePath: string): Promise<SessionLock | null> {
  const lockPath = getSessionLockPath(tasksFilePath);

  try {
    const content = await fs.readFile(lockPath, { encoding: "utf-8" });
    return yamlParse(content) as SessionLock;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return null;
    }
    // For other errors, return null (best effort)
    return null;
  }
}

/**
 * Remove session lock file
 */
async function removeSessionLock(tasksFilePath: string): Promise<void> {
  const lockPath = getSessionLockPath(tasksFilePath);

  try {
    await fs.unlink(lockPath);
  } catch {
    // Ignore errors - file may not exist
  }
}

/**
 * Acquire a file lock with retry logic
 * Records session information on successful lock acquisition
 *
 * @param filePath - Path to lock
 * @returns Release function
 */
async function acquireLock(filePath: string): Promise<() => Promise<void>> {
  const dirPath = path.dirname(filePath);
  const currentSession = getCurrentSession();

  // Ensure directory exists before locking
  await fs.mkdir(dirPath, { recursive: true });

  // Ensure file exists before locking (proper-lockfile requires this)
  try {
    await fs.access(filePath);
  } catch {
    // File doesn't exist, create empty file
    await fs.writeFile(filePath, "", { encoding: "utf-8" });
  }

  let lastError: Error | undefined;
  let attempt = 0;

  while (attempt <= LOCK_RETRY_CONFIG.retries) {
    try {
      const release = await lockfile.lock(filePath, {
        retries: {
          retries: 0, // We handle retries ourselves
        },
        stale: LOCK_TIMEOUT,
      });

      // Successfully acquired lock - record session info
      await writeSessionLock(filePath, currentSession);

      return release;
    } catch (error) {
      lastError = error as Error;
      attempt++;

      if (attempt <= LOCK_RETRY_CONFIG.retries) {
        // Calculate backoff delay
        const delay = LOCK_RETRY_CONFIG.minTimeout * LOCK_RETRY_CONFIG.factor ** (attempt - 1);
        const cappedDelay = Math.min(delay, LOCK_RETRY_CONFIG.maxTimeout);

        // Log retry with session info if available
        const lockHolder = await readSessionLock(filePath);
        if (lockHolder) {
          console.warn(
            `Lock held by another session, retrying in ${cappedDelay}ms...\n` +
              formatSessionInfo(lockHolder.session) +
              `\n  Locked since: ${lockHolder.acquiredAt}`,
          );
        }

        await new Promise((resolve) => setTimeout(resolve, cappedDelay));
      }
    }
  }

  // Final failure - include lock holder info in error message
  const lockHolder = await readSessionLock(filePath);
  let errorMessage = `Failed to acquire lock after ${LOCK_RETRY_CONFIG.retries} retries`;
  if (lockHolder) {
    errorMessage +=
      `\nFile is locked by another session:\n` +
      formatSessionInfo(lockHolder.session) +
      `\n  Locked since: ${lockHolder.acquiredAt}`;
  } else {
    errorMessage += `: ${lastError?.message}`;
  }

  throw new FileIOError(errorMessage, "ELOCK", filePath);
}

/**
 * Release a file lock safely
 * Also removes the session lock file
 *
 * @param release - Release function from acquireLock
 * @param filePath - File path (for error messages)
 */
async function releaseLock(release: () => Promise<void>, filePath: string): Promise<void> {
  try {
    // Remove session lock file first
    await removeSessionLock(filePath);
    await release();
  } catch (error) {
    // Log but don't throw - releasing lock is best effort
    if (error instanceof Error) {
      console.warn(`Warning: Failed to release lock for ${filePath}: ${error.message}`);
    }
  }
}

/**
 * Atomically write content to a file using temp file + rename pattern
 * Guarantees that the file is never left in a partially written state
 * Uses file locking to prevent concurrent writes
 *
 * @param filePath - Target file path
 * @param content - Content to write
 */
export async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.tmp`;
  const dirPath = path.dirname(filePath);

  // Acquire lock before writing
  const release = await acquireLock(filePath);

  try {
    // Ensure directory exists
    await fs.mkdir(dirPath, { recursive: true });

    // Write to temporary file
    await fs.writeFile(tempPath, content, { encoding: "utf-8" });

    // Fsync to ensure data is persisted to disk
    const fileHandle = await fs.open(tempPath, "r+");
    try {
      await fileHandle.sync();
    } finally {
      await fileHandle.close();
    }

    // Atomically rename temp file to target (POSIX guarantees this is atomic)
    await fs.rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file if it exists
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }

    if (error instanceof Error) {
      const nodeError = error as NodeJS.ErrnoException;
      throw new FileIOError(`Failed to write file: ${error.message}`, nodeError.code, filePath);
    }
    throw error;
  } finally {
    // Always release lock, even on error
    await releaseLock(release, filePath);
  }
}

/**
 * Safely read a file with error handling
 * Returns null if file doesn't exist, throws for other errors
 *
 * @param filePath - File path to read
 * @returns File contents or null if file doesn't exist
 */
export async function safeRead(filePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, { encoding: "utf-8" });
    return content;
  } catch (error) {
    if (error instanceof Error) {
      const nodeError = error as NodeJS.ErrnoException;

      // Return null for missing files (expected case)
      if (nodeError.code === "ENOENT") {
        return null;
      }

      // Throw descriptive errors for other cases
      if (nodeError.code === "EACCES") {
        throw new FileIOError(
          `Permission denied reading file: ${filePath}`,
          nodeError.code,
          filePath,
        );
      }

      throw new FileIOError(`Failed to read file: ${nodeError.message}`, nodeError.code, filePath);
    }
    throw error;
  }
}
