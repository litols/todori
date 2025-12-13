/**
 * Atomic file I/O operations for reliable task persistence
 * Implements write-fsync-rename pattern for ACID guarantees
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as lockfile from "proper-lockfile";

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
 * Acquire a file lock with retry logic
 *
 * @param filePath - Path to lock
 * @returns Release function
 */
async function acquireLock(filePath: string): Promise<() => Promise<void>> {
  const dirPath = path.dirname(filePath);

  // Ensure directory exists before locking
  await fs.mkdir(dirPath, { recursive: true });

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
      return release;
    } catch (error) {
      lastError = error as Error;
      attempt++;

      if (attempt <= LOCK_RETRY_CONFIG.retries) {
        // Calculate backoff delay
        const delay = LOCK_RETRY_CONFIG.minTimeout * LOCK_RETRY_CONFIG.factor ** (attempt - 1);
        const cappedDelay = Math.min(delay, LOCK_RETRY_CONFIG.maxTimeout);

        await new Promise((resolve) => setTimeout(resolve, cappedDelay));
      }
    }
  }

  throw new FileIOError(
    `Failed to acquire lock after ${LOCK_RETRY_CONFIG.retries} retries: ${lastError?.message}`,
    "ELOCK",
    filePath,
  );
}

/**
 * Release a file lock safely
 *
 * @param release - Release function from acquireLock
 * @param filePath - File path (for error messages)
 */
async function releaseLock(release: () => Promise<void>, filePath: string): Promise<void> {
  try {
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
