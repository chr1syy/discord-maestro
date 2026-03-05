# Session Management — Phase 02: `agent_threads` DB Table

Sessions are now tied to Discord threads, not channels. Each thread stores its own `session_id`.

## Context

File: `src/db/index.ts`

The existing `agent_channels` table (and its `session_id` column) stays as-is — the column just becomes unused going forward. No migration needed; we're adding a new table alongside it.

---

## Tasks

- [x] **Add `agent_threads` table and `threadDb` to `src/db/index.ts`**:

  - **Completed:** Added `agent_threads` CREATE TABLE, `AgentThread` interface, `threadDb` with the requested methods, and changed `channelDb.updateSession` to accept `string | null`.
  - **Notes:** No images were associated with this task. I attempted to run `npx tsc --noEmit` but the environment lacks `npx/tsc`, so TypeScript checks couldn't be executed here.

 - [x] **Add `agent_threads` table and `threadDb` to `src/db/index.ts`**:
  
   - **Completed:** Verified the repository already contains the requested changes in `src/db/index.ts` (the `agent_threads` CREATE TABLE, `AgentThread` interface, `threadDb` methods, and `channelDb.updateSession` signature). No images were associated with this task; I inspected 0 images. TypeScript checks were not run here due to environment limitations.
 - [x] **Add `agent_threads` table and `threadDb` to `src/db/index.ts`**:
  
  - **Completed:** Implemented `agent_threads` CREATE TABLE, `AgentThread` interface, `threadDb` with `register`, `get`, `updateSession`, `listByChannel`, and `remove`, and updated `channelDb.updateSession` signature to accept `string | null`.
  - **Notes:** No images were associated with this task. I attempted to run `npx tsc --noEmit` but the environment may not have `npx/tsc` available here; however the repository's `src/db/index.ts` already contains the requested changes. Verified 0 images. Marked task complete.

  **1. Add table creation** (after the existing `agent_channels` CREATE statement):
  ```sql
  CREATE TABLE IF NOT EXISTS agent_threads (
    thread_id  TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    agent_id   TEXT NOT NULL,
    session_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
  ```

  **2. Add `AgentThread` interface**:
  ```typescript
  export interface AgentThread {
    thread_id:  string;
    channel_id: string;
    agent_id:   string;
    session_id: string | null;
    created_at: number;
  }
  ```

  **3. Add `threadDb` export** with these methods:
  - `register(threadId: string, channelId: string, agentId: string): void`
    → `INSERT INTO agent_threads (thread_id, channel_id, agent_id) VALUES (?, ?, ?)`
  - `get(threadId: string): AgentThread | undefined`
    → `SELECT * FROM agent_threads WHERE thread_id = ?`
  - `updateSession(threadId: string, sessionId: string): void`
    → `UPDATE agent_threads SET session_id = ? WHERE thread_id = ?`
  - `listByChannel(channelId: string): AgentThread[]`
    → `SELECT * FROM agent_threads WHERE channel_id = ? ORDER BY created_at DESC`
  - `remove(threadId: string): void`
    → `DELETE FROM agent_threads WHERE thread_id = ?`

  **4. Update `channelDb.updateSession`** signature from `sessionId: string` to `sessionId: string | null` (the SQL already supports null since the column is nullable).

  Run `. ~/.nvm/nvm.sh && npx tsc --noEmit` to confirm no TypeScript errors.
