# Session Management — Phase 01: /session Command

Add session-aware functionality: list, create, and switch sessions per agent channel.

## Context

Each agent channel stores one active `session_id` in SQLite (`agent_channels.session_id`).
Sessions are created lazily on first message. We're adding a `/session` command to give
users full control over which session is active.

**`maestro.listSessions(agentId)`** returns `MaestroSession[]` with fields:
`sessionId`, `sessionName`, `firstMessage`, `modifiedAt`, `messageCount`, `costUsd`, `starred`

---

## Tasks

- [ ] **Update `src/db/index.ts`**: change `updateSession` signature from `sessionId: string` to `sessionId: string | null` so it can clear the session (needed for `/session new`). The SQL `UPDATE` already supports null values since the column is nullable.

- [ ] **Create `src/commands/session.ts`**: implement the `/session` slash command with three subcommands:

  **`/session list`** (ephemeral reply):
  - Defer reply (ephemeral: true)
  - Check current channel is an agent channel via `channelDb.get(interaction.channelId)` — reply with error if not
  - Call `maestro.listSessions(channelInfo.agent_id)` (default limit of 25)
  - If no sessions, reply "No sessions found. Send a message to start one."
  - Build an `EmbedBuilder` (color `0x5865F2`) titled `Sessions — <agent_name>`
  - For each session, show one line:
    - Prefix: `✅` if `s.sessionId === channelInfo.session_id`, else `•`
    - Short ID: first 8 chars in backticks
    - Session name: `s.sessionName` or first 50 chars of `s.firstMessage` or "Unnamed"
    - Stats: `messageCount msgs · $X.XXXX · date`
  - Footer: "Use /session switch <id> to switch. Partial IDs (8+ chars) are supported."
  - `editReply({ embeds: [embed] })`

  **`/session new`** (public reply):
  - Check current channel is an agent channel
  - Call `channelDb.updateSession(interaction.channelId, null)` to clear session
  - Reply (not ephemeral): `🆕 **New session** — Session cleared. Your next message will start a fresh conversation.`

  **`/session switch <session_id: string>`** (ephemeral reply):
  - Defer reply (ephemeral: true)
  - Check current channel is an agent channel
  - Call `maestro.listSessions(channelInfo.agent_id)`
  - Find match: `sessions.find(s => s.sessionId === input || s.sessionId.startsWith(input))`
  - If no match: `editReply('❌ No session found matching \`${input}\`. Use \`/session list\` to see available sessions.')`
  - Call `channelDb.updateSession(interaction.channelId, match.sessionId)`
  - Reply with: `✅ Switched to \`${match.sessionId.slice(0,8)}\` — **<name>** (<date>, <N> msgs)`

  **Command builder** (`SlashCommandBuilder`):
  ```
  name: 'session'
  description: 'Manage sessions for this agent channel'
  subcommand 'list'   — 'List all sessions for this agent'
  subcommand 'new'    — 'Start a new session (clears current session)'
  subcommand 'switch' — 'Switch to an existing session'
    option: session_id (string, required) — 'Session ID or prefix to switch to'
  ```

- [ ] **Wire into `src/index.ts`**:
  - Import `* as session from './commands/session'`
  - Add `[session.data.name, session]` to the `commands` Map

- [ ] **Wire into `src/deploy-commands.ts`**:
  - Import `* as session from './commands/session'`
  - Add `session.data.toJSON()` to the `commands` array

---

## Verification

After implementation, run `npx tsc --noEmit` to confirm no TypeScript errors.

The feature is complete when:
- `/session list` shows sessions with active one marked ✅
- `/session new` clears the session and the next user message creates a fresh one (no `-s` flag passed to CLI)
- `/session switch <id>` updates the DB and subsequent messages resume that session
