/**
 * Session identification types for multi-instance coordination
 */

/**
 * Information identifying a Claude Code session
 * Used to track which session holds locks and modifies files
 */
export interface SessionInfo {
  /** Process ID of the Claude Code instance */
  pid: number;
  /** Process start time in ISO8601 format */
  startTime: string;
  /** Optional hostname for multi-machine scenarios */
  hostname?: string;
}

/**
 * Session lock state stored in .todori/session-lock.yaml
 * Tracks which session currently holds the file lock
 */
export interface SessionLock {
  /** Session that holds the lock */
  session: SessionInfo;
  /** When the lock was acquired (ISO8601) */
  acquiredAt: string;
  /** Last activity timestamp for stale lock detection (ISO8601) */
  lastActiveAt: string;
  /** Path to the locked file */
  lockFile: string;
}

/**
 * Get the current session information
 * Uses process.pid and calculates start time from uptime
 */
export function getCurrentSession(): SessionInfo {
  const now = Date.now();
  const uptimeMs = process.uptime() * 1000;
  const startTime = new Date(now - uptimeMs).toISOString();

  return {
    pid: process.pid,
    startTime,
    hostname: process.env.HOSTNAME,
  };
}

/**
 * Format session info for display in error messages
 */
export function formatSessionInfo(session: SessionInfo): string {
  const lines = [`  PID: ${session.pid}`, `  Started: ${session.startTime}`];
  if (session.hostname) {
    lines.push(`  Host: ${session.hostname}`);
  }
  return lines.join("\n");
}
