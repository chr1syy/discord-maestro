# Discord Maestro Bot — Phase 04: Message Relay & Queue

Intercept messages in agent channels, queue them per-channel to handle rapid input, call `maestro-cli send`, and post the response back.

## Queue Strategy

Each agent channel gets its own FIFO queue. When a message arrives:
1. Add to the channel's queue
2. React with ⏳ if another message is already being processed (so the user knows it's queued)
3. Process one at a time: show typing indicator → call CLI → post response → remove ⏳ if present → process next

This avoids interleaved responses and preserves conversation order.

## Tasks

- [x] Create `src/services/queue.ts` — per-channel sequential message processor:

  ```ts
  import { Message, TextChannel } from 'discord.js';
  import { maestro } from './maestro';
  import { channelDb } from '../db';
  import { splitMessage } from '../utils/splitMessage';

  interface QueueEntry {
    message: Message;
  }

  const queues = new Map<string, QueueEntry[]>();
  const processing = new Set<string>();

  export function enqueue(message: Message): void {
    const channelId = message.channel.id;
    if (!queues.has(channelId)) queues.set(channelId, []);
    queues.get(channelId)!.push({ message });

    if (!processing.has(channelId)) {
      processNext(channelId);
    }
  }

  async function processNext(channelId: string): Promise<void> {
    const queue = queues.get(channelId);
    if (!queue || queue.length === 0) {
      processing.delete(channelId);
      return;
    }

    processing.add(channelId);
    const { message } = queue.shift()!;

    const channel = message.channel as TextChannel;
    const channelInfo = channelDb.get(channelId);
    if (!channelInfo) {
      processing.delete(channelId);
      return;
    }

    // React to show we're working
    let reaction: Awaited<ReturnType<Message['react']>> | undefined;
    try {
      reaction = await message.react('⏳');
    } catch {
      // Reaction may fail if message was deleted, continue anyway
    }

    // Show typing indicator while waiting
    const typingInterval = setInterval(() => {
      channel.sendTyping().catch(() => {});
    }, 8000);
    channel.sendTyping().catch(() => {});

    try {
      const result = await maestro.send(
        channelInfo.agent_id,
        message.content,
        channelInfo.session_id ?? undefined
      );

      // Persist session ID from first response
      if (!channelInfo.session_id && result.sessionId) {
        channelDb.updateSession(channelId, result.sessionId);
      }

      clearInterval(typingInterval);

      // Remove the ⏳ reaction
      try {
        await reaction?.remove();
      } catch {
        // Ignore if already removed or no permission
      }

      // Post response, splitting if > 2000 chars
      const parts = splitMessage(result.response);
      for (const part of parts) {
        await channel.send(part);
      }

      // Post usage footer as a subtle follow-up
      const cost = result.usage.totalCostUsd.toFixed(4);
      const ctx = result.usage.contextUsagePercent.toFixed(1);
      await channel.send(
        `-# 💬 ${result.usage.inputTokens + result.usage.outputTokens} tokens • $${cost} • ${ctx}% context`
      );

    } catch (err) {
      clearInterval(typingInterval);
      try {
        await reaction?.remove();
      } catch {}

      const errMsg = err instanceof Error ? err.message : String(err);
      await channel.send(`❌ Failed to get response from agent:\n\`\`\`\n${errMsg}\n\`\`\``);
    }

    // Process the next item in queue
    processNext(channelId);
  }
  ```

- [x] Create `src/utils/splitMessage.ts` — split long responses to respect Discord's 2000-char limit:

  ```ts
  const MAX_LENGTH = 1990; // small buffer below 2000

  /**
   * Split a string into chunks that fit within Discord's message length limit.
   * Tries to split on newlines when possible to preserve formatting.
   */
  export function splitMessage(text: string): string[] {
    if (text.length <= MAX_LENGTH) return [text];

    const parts: string[] = [];
    let remaining = text;

    while (remaining.length > MAX_LENGTH) {
      // Try to find a newline to break on within the limit
      let splitAt = remaining.lastIndexOf('\n', MAX_LENGTH);
      if (splitAt <= 0) splitAt = MAX_LENGTH; // fallback: hard cut

      parts.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt).trimStart();
    }

    if (remaining.length > 0) parts.push(remaining);
    return parts;
  }
  ```

- [x] Create `src/handlers/messageCreate.ts` — filter and enqueue messages in agent channels:

  ```ts
  import { Message } from 'discord.js';
  import { channelDb } from '../db';
  import { enqueue } from '../services/queue';

  export async function handleMessageCreate(message: Message): Promise<void> {
    // Ignore bots (including self) and DMs
    if (message.author.bot) return;
    if (!message.guild) return;

    // Only handle messages in registered agent channels
    const channelInfo = channelDb.get(message.channel.id);
    if (!channelInfo) return;

    // Ignore empty messages (e.g. attachments-only)
    if (!message.content.trim()) return;

    enqueue(message);
  }
  ```

- [x] Wire the message handler into `src/index.ts`:

  Replace the full contents of `src/index.ts` with the following (adds the `messageCreate` listener and db import to the file written in BOT-03):
  ```ts
  import { Client, GatewayIntentBits, Interaction } from 'discord.js';
  import { config } from './config';
  import './db'; // ensure DB is initialized on startup
  import * as health from './commands/health';
  import * as agents from './commands/agents';
  import { handleMessageCreate } from './handlers/messageCreate';

  const commands = new Map([
    [health.data.name, health],
    [agents.data.name, agents],
  ]);

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once('ready', (c) => {
    console.log(`Logged in as ${c.user.tag}`);
  });

  client.on('interactionCreate', async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const cmd = commands.get(interaction.commandName);
    if (!cmd) return;
    try {
      await cmd.execute(interaction);
    } catch (err) {
      console.error('Command error:', err);
      const msg = { content: '❌ An error occurred.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    }
  });

  client.on('messageCreate', handleMessageCreate);

  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    client.destroy();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    client.destroy();
    process.exit(0);
  });

  client.login(config.token);
  ```

  Then verify the project compiles without errors:
  ```bash
  export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && npx tsc --noEmit
  ```
