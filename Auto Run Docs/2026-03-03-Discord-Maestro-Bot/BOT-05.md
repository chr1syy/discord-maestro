# Discord Maestro Bot — Phase 05: Disconnect Command & README

Add the `/agents disconnect` subcommand and write the README.

Note: graceful shutdown and db initialization were already wired into `src/index.ts` in BOT-04.

## Tasks

 - [x] Replace the full contents of `src/commands/agents.ts` with the following (adds the `disconnect` subcommand alongside the existing `list` and `new` subcommands):

  ```ts
  import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
    ChannelType,
    TextChannel,
  } from 'discord.js';
  import { maestro } from '../services/maestro';
  import { channelDb } from '../db';

  export const data = new SlashCommandBuilder()
    .setName('agents')
    .setDescription('Manage Maestro agents')
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all available agents')
    )
    .addSubcommand((sub) =>
      sub
        .setName('new')
        .setDescription('Create a dedicated channel for an agent')
        .addStringOption((opt) =>
          opt
            .setName('agent')
            .setDescription('Agent ID or unique prefix (from /agents list)')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('disconnect')
        .setDescription('Remove this agent channel (deletes the channel)')
    );

  export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      await handleList(interaction);
    } else if (sub === 'new') {
      await handleNew(interaction);
    } else if (sub === 'disconnect') {
      await handleDisconnect(interaction);
    }
  }

  async function handleList(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const agents = await maestro.listAgents();

    if (agents.length === 0) {
      await interaction.editReply('No agents found. Start an agent in Maestro first.');
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('Maestro Agents')
      .setColor(0x5865f2)
      .setDescription(
        agents
          .map((a) => `**${a.name}**\n\`${a.id}\`  •  ${a.toolType}  •  \`${a.cwd}\``)
          .join('\n\n')
      )
      .setFooter({ text: 'Use /agents new <agent-id> to start a conversation' });

    await interaction.editReply({ embeds: [embed] });
  }

  async function handleNew(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const agentInput = interaction.options.getString('agent', true);
    const guild = interaction.guild;
    if (!guild) {
      await interaction.editReply('This command must be used in a server.');
      return;
    }

    const agents = await maestro.listAgents();
    const agent = agents.find(
      (a) => a.id === agentInput || a.id.startsWith(agentInput) || a.name === agentInput
    );

    if (!agent) {
      await interaction.editReply(
        `❌ No agent found matching \`${agentInput}\`. Use \`/agents list\` to see available agents.`
      );
      return;
    }

    // Find or create "Maestro Agents" category
    let category = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name === 'Maestro Agents'
    );
    if (!category) {
      category = await guild.channels.create({
        name: 'Maestro Agents',
        type: ChannelType.GuildCategory,
      });
    }

    const channelName = `agent-${agent.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: `Maestro agent: ${agent.name} (${agent.id}) | ${agent.toolType} | ${agent.cwd}`,
    }) as TextChannel;

    channelDb.register(channel.id, guild.id, agent.id, agent.name);

    await interaction.editReply(
      `✅ Created <#${channel.id}> for agent **${agent.name}**.\n` +
      `Type your messages there to chat with the agent.`
    );

    await channel.send(
      `**${agent.name}** is ready.\n` +
      `Type any message here and it will be sent to this agent.\n` +
      `-# Agent: \`${agent.id}\` • ${agent.toolType} • \`${agent.cwd}\``
    );
  }

  async function handleDisconnect(interaction: ChatInputCommandInteraction): Promise<void> {
    const channelInfo = channelDb.get(interaction.channelId);
    if (!channelInfo) {
      await interaction.reply({ content: 'This channel is not an agent channel.', ephemeral: true });
      return;
    }

    await interaction.reply({ content: `Disconnecting **${channelInfo.agent_name}**...`, ephemeral: true });
    channelDb.remove(interaction.channelId);

    setTimeout(async () => {
      try {
        await interaction.channel?.delete();
      } catch {
        // Channel may already be gone
      }
    }, 2000);
  }
  ```

   NOTE: Completed — replaced `src/commands/agents.ts` to add the `disconnect` subcommand and handler. No related images were provided for this task.

 - [x] Create `README.md` at `/home/chris/code/discord-maestro/README.md`:

  ```markdown
  # Discord Maestro Bot

  A Discord bot that bridges your Discord server with [Maestro](https://maestro.sh) AI agents via the `maestro-cli`.

  ## Prerequisites

  - Node.js 18+ (via nvm recommended)
  - [Maestro](https://maestro.sh) installed with `maestro-cli` in PATH
  - A Discord application and bot token ([guide](https://discord.com/developers/docs/getting-started))

  ## Setup

  1. Install dependencies:
     ```bash
     npm install
     ```

  2. Copy `.env.example` to `.env` and fill in your values:
     ```
     DISCORD_BOT_TOKEN=   # Bot token from Discord Developer Portal
     DISCORD_CLIENT_ID=   # Application ID from Discord Developer Portal
     DISCORD_GUILD_ID=    # Your server's ID (right-click server → Copy ID)
     ```

  3. Deploy slash commands to your server:
     ```bash
     npm run deploy-commands
     ```

  4. Start the bot:
     ```bash
     npm run dev
     ```

  ## Commands

  | Command | Description |
  |---|---|
  | `/health` | Verify Maestro CLI is installed and working |
  | `/agents list` | Show all available agents |
  | `/agents new <agent-id>` | Create a dedicated channel for an agent |
  | `/agents disconnect` | (Run inside an agent channel) Remove and delete the channel |

  Once an agent channel is created, type messages in it — they are relayed to the agent and the response is posted back. Messages are queued per-channel and processed one at a time. A ⏳ reaction indicates a message is waiting in the queue.

  ## Bot Permissions Required

  - Read Messages / View Channels
  - Send Messages
  - Manage Channels (to create/delete agent channels)
  - Add Reactions
  - Read Message History
  ```

  NOTE: Completed — added `README.md` at project root with setup and command docs.

- [ ] Run a final compile check to confirm the full project builds cleanly:

  ```bash
  export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && npx tsc --noEmit
  ```

  NOTE: Attempted but not completed in this environment — kept unchecked.

  Actions taken:
  - Ran `npx tsc --noEmit` (via the playbook command). Output indicated the TypeScript
    compiler (`tsc`) is not available via npx and suggested installing `typescript`.
  - Attempted `npm install` to install dependencies but `npm` is not available in this
    environment (`/bin/bash: line 1: npm: command not found`).

  Result: I could not run the compile check here because required tools are missing
  (Node/npm and/or project dev dependencies). Do not mark this item done. Recommended
  next steps (run locally or in your CI):

  1. Run `npm install` to install dev dependencies, including `typescript`.
  2. Run the compile check:

     ```bash
     export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && npx tsc --noEmit
     ```

  If the compile succeeds, mark this checkbox as complete.

  Execution in this run (automated agent):

  - Commands executed: `node -v || true; npm -v || true; npx -v || true`
  - Output observed:
    - `node -v` -> `v22.22.0`
    - `npm -v` -> `/bin/bash: line 1: npm: command not found`
    - `npx -v` -> `/bin/bash: line 1: npx: command not found`

  Notes: No images were provided or analyzed for this task.

Additional attempt (Discord Maestro OC):

- Commands executed: `node -v && which npm || true; npm -v || true; which npx || true; npx -v || true; which tsc || true; tsc -v || true`
- Output observed: `node v22.22.0`; `npm`, `npx`, and `tsc` are not available in this environment.

Result: I could not run the TypeScript compile check here because the environment is missing required tooling (`npm`/`npx`/`tsc`). The checkbox remains unchecked. Recommended next steps are unchanged:

1. Run `npm install` locally or in CI to install dev dependencies (including `typescript`).
2. Run the compile check:

   ```bash
   export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && npx tsc --noEmit
   ```

If that succeeds, mark the checkbox as complete.

This run (Discord Maestro OC, iteration 00001):

- I directly attempted `npx tsc --noEmit` in the workspace; the shell returned `/bin/bash: line 1: npx: command not found`.
- Because `npx` (and therefore `tsc` via npx) is unavailable in this environment, I cannot complete the compile check here. The checkbox remains unchecked.

---

## Manual steps after the playbook completes

These require your real Discord credentials and cannot be automated:

- Copy `.env.example` to `.env` and fill in `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, and `DISCORD_GUILD_ID`
- Run `npm run deploy-commands` to register slash commands with Discord
- Run `npm run dev` to start the bot
