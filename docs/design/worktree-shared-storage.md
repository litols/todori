# Git Worktree Shared Storage Design

## Problem Statement

Currently, todori creates independent `.todori/tasks.yaml` files in each git worktree. This prevents task sharing across worktrees working on the same project.

## Git Worktree Structure

```
main-repo/
  .git/                         # Real git directory
    worktrees/
      feature-branch/
  .todori/tasks.yaml            # Main storage location

../worktrees/feature-branch/
  .git                          # File (points to main repo)
  .todori/tasks.yaml            # Currently isolated (problem)
```

## Design Options

### Option 1: Use Main Repository Storage (Recommended)

**Approach:**
- Detect if current directory is a worktree
- If worktree, resolve to main repository root
- Use main repository's `.todori/tasks.yaml` for all worktrees

**Pros:**
- Simple implementation
- Git-friendly (no symlinks in working tree)
- All worktrees naturally share the same storage
- Works with existing locking mechanism

**Cons:**
- Need to resolve main repository path
- Slight path resolution overhead

**Implementation:**
1. Detect worktree using `.git` file vs directory check
2. Use `git rev-parse --git-common-dir` to find main `.git`
3. Resolve main repository root from there
4. Return main root instead of worktree root

### Option 2: Symbolic Links

**Approach:**
- Create symlink from worktree's `.todori/tasks.yaml` to main repository

**Pros:**
- Transparent to application code

**Cons:**
- Windows compatibility issues
- Git might track symlinks
- Requires post-checkout hooks
- More complex maintenance

### Option 3: External Shared Directory

**Approach:**
- Store tasks in `~/.todori/projects/{project-id}/tasks.yaml`

**Pros:**
- Completely independent of repository structure

**Cons:**
- Disconnected from project
- Harder to backup with project
- Multiple projects with same name cause issues

## Recommended Solution: Option 1

Implement worktree detection in `src/integration/project-detect.ts`.

### API Changes

```typescript
// Existing
export async function detectProjectRoot(startPath: string): Promise<string | null>

// New functions
export async function detectGitCommonDir(gitDir: string): Promise<string | null>
export async function isGitWorktree(projectRoot: string): Promise<boolean>
export async function getMainWorktreeRoot(projectRoot: string): Promise<string>
```

### Implementation Details

**Step 1: Detect Worktree**
```typescript
async function isGitWorktree(projectRoot: string): Promise<boolean> {
  const gitPath = path.join(projectRoot, '.git');
  const stat = await fs.stat(gitPath);
  return stat.isFile(); // File = worktree, Directory = main repo
}
```

**Step 2: Resolve Main Repository**
```typescript
async function getMainWorktreeRoot(projectRoot: string): Promise<string> {
  // Execute: git -C {projectRoot} rev-parse --git-common-dir
  // Parse output to get common .git directory
  // Resolve to parent directory (main repository root)
  // Fallback: parse .git file for gitdir: path
}
```

**Step 3: Modify TaskStore Construction**
```typescript
// In TaskStore constructor or factory
const resolvedRoot = await isGitWorktree(projectRoot)
  ? await getMainWorktreeRoot(projectRoot)
  : projectRoot;

return new TaskStore(resolvedRoot);
```

## Migration Path

1. **Phase 1**: Implement detection and resolution (this PR)
   - No breaking changes
   - Worktrees automatically start using main repository storage
   - Existing worktree `.todori/` directories are ignored (can be cleaned up manually)

2. **Phase 2**: Optional cleanup command
   - Add `todori-cleanup-worktrees` command
   - Remove orphaned `.todori/` directories in worktrees

## Testing Strategy

1. Create test with main repository + worktree
2. Verify main repo detection works
3. Verify worktree resolves to main repo storage
4. Test concurrent access from multiple worktrees
5. Verify locking works across worktrees

## Security Considerations

- No new security concerns
- Existing file locking prevents race conditions
- Session tracking still works (identifies which worktree modified tasks)

## Performance Impact

- Minimal: One extra git command execution on initialization
- Cached after first detection
- No impact on read/write operations
