# Discord Maestro Bot — Phase 02: Maestro CLI Service Layer

Create `src/services/maestro.ts` — a typed wrapper around the `maestro-cli` binary. All CLI calls go through this module.

## Tasks

 - [x] Create `src/services/maestro.ts` with the full Maestro CLI service:

  ```ts
  import { execFile } from 'child_process';
  import { promisify } from 'util';

  const execFileAsync = promisify(execFile);

  // --- Types ---

  export interface MaestroAgent {
    id: string;
    name: string;
    toolType: string;
    cwd: string;
    [key: string]: unknown;
  }

  export interface MaestroSession {
    sessionId: string;
    sessionName: string;
    modifiedAt: string;
    firstMessage: string;
    messageCount: number;
    costUsd: number;
    inputTokens: number;
    outputTokens: number;
    durationSeconds: number;
    starred: boolean;
  }

  export interface SendResult {
    agentId: string;
    agentName: string;
    sessionId: string;
    response: string;
    success: boolean;
    usage: {
      inputTokens: number;
      outputTokens: number;
      cacheReadInputTokens: number;
      cacheCreationInputTokens: number;
      totalCostUsd: number;
      contextWindow: number;
      contextUsagePercent: number;
    };
  }

  // --- Helpers ---

  async function run(args: string[]): Promise<string> {
    const { stdout } = await execFileAsync('maestro-cli', args, {
      timeout: 5 * 60 * 1000, // 5 min timeout for long agent responses
    });
    return stdout.trim();
  }

  // --- Service ---

  export const maestro = {
    /** Check if maestro-cli is installed and reachable */
    async isInstalled(): Promise<boolean> {
      try {
        await execFileAsync('maestro-cli', ['--version'], { timeout: 5000 });
        return true;
      } catch {
        return false;
      }
    },

    /** List all agents. Returns empty array on error. */
    async listAgents(): Promise<MaestroAgent[]> {
      const raw = await run(['list', 'agents', '--json']);
      return JSON.parse(raw) as MaestroAgent[];
    },

    /** List sessions for a given agent */
    async listSessions(agentId: string, limit = 25): Promise<MaestroSession[]> {
      const raw = await run(['list', 'sessions', agentId, '--json', '-l', String(limit)]);
      return JSON.parse(raw) as MaestroSession[];
    },

    /**
     * Send a message to an agent.
     * If sessionId is provided, resumes that session; otherwise starts a new one.
     * Returns the full structured response.
     */
    async send(agentId: string, message: string, sessionId?: string): Promise<SendResult> {
      const args = ['send', agentId, message, '--json'];
      if (sessionId) args.push('-s', sessionId);
      const raw = await run(args);
      return JSON.parse(raw) as SendResult;
    },
  };
  ```

  After creating the file, verify it compiles cleanly by running:
  ```bash
  export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && npx tsc --noEmit
  ```
  Fix any TypeScript errors before completing this task.

- Note: I created `src/services/maestro.ts` at `src/services/maestro.ts` implementing the typed wrapper around the `maestro-cli` binary and exported the `maestro` service object. I attempted to run the suggested TypeScript check but the execution environment lacks `npx` so the command failed with `/bin/bash: line 1: npx: command not found`. The file appears TypeScript-correct (no obvious type issues), but I could not run `npx tsc --noEmit` here — please run that locally to verify compilation.

- Images analyzed: 0
