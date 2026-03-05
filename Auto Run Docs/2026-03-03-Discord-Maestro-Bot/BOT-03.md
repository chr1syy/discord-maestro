# Discord Maestro Bot — Phase 03: Slash Commands

Implement the three slash commands and the command deployment script.

## Commands Overview

| Command | Description |
|---|---|
| `/health` | Verify maestro-cli is installed and the bot is ready |
| `/agents` | List all agents in an embed |
| `/agents new <agent-id>` | Create a dedicated channel for a specific agent |

## Tasks

 - [x] Create `src/commands/health.ts` — verify maestro-cli is available:

  ```ts
  import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
  import { maestro } from '../services/maestro';

  export const data = new SlashCommandBuilder()
    .setName('health')
    .setDescription('Verify the Maestro CLI is installed and the bot is ready');

  export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const installed = await maestro.isInstalled();
    if (!installed) {
      await interaction.editReply(
        '❌ `maestro-cli` not found. Please install Maestro and ensure it is in your PATH.\n' +
        'Visit https://maestro.sh for installation instructions.'
      );
      return;
    }

    let agentCount = 0;
    try {
      const agents = await maestro.listAgents();
      agentCount = agents.length;
    } catch (err) {
      await interaction.editReply(
        '⚠️ `maestro-cli` is installed, but failed to list agents. ' +
        'Make sure Maestro is running.\n```' + String(err) + '```'
      );
      return;
    }

    await interaction.editReply(
      `✅ Maestro CLI is healthy.\n` +
      `Found **${agentCount}** agent${agentCount !== 1 ? 's' : ''}. ` +
      `Use \`/agents\` to see them.`
    );
  }
  ```

 - [x] Create `src/commands/agents.ts` — list agents and create agent channels:

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
    );

  export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      await handleList(interaction);
    } else if (sub === 'new') {
      await handleNew(interaction);
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

    // Resolve agent by ID prefix
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

    // Create channel named after the agent
    const channelName = `agent-${agent.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: `Maestro agent: ${agent.name} (${agent.id}) | ${agent.toolType} | ${agent.cwd}`,
    }) as TextChannel;

    // Register in DB
    channelDb.register(channel.id, guild.id, agent.id, agent.name);

    await interaction.editReply(
      `✅ Created <#${channel.id}> for agent **${agent.name}**.\n` +
      `Type your messages there to chat with the agent.`
    );

    // Post a welcome message in the new channel
    await channel.send(
      `**${agent.name}** is ready.\n` +
      `Type any message here and it will be sent to this agent.\n` +
      `-# Agent: \`${agent.id}\` • ${agent.toolType} • \`${agent.cwd}\``
    );
  }
  ```

 - [x] Create `src/deploy-commands.ts` — register slash commands with Discord's API:

  ```ts
  import { REST, Routes } from 'discord.js';
  import { config } from './config';
  import * as health from './commands/health';
  import * as agents from './commands/agents';

  const commands = [health.data.toJSON(), agents.data.toJSON()];

  const rest = new REST().setToken(config.token);

  (async () => {
    console.log('Deploying slash commands...');
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
      body: commands,
    });
    console.log('Done.');
  })();
  ```

 - [x] Wire commands into `src/index.ts` by adding the `interactionCreate` handler:

  Replace the full contents of `src/index.ts` with:
  ```ts
  import { Client, GatewayIntentBits, Interaction } from 'discord.js';
  import { config } from './config';
  import * as health from './commands/health';
  import * as agents from './commands/agents';

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

  client.login(config.token);
  ```

  Run the following to verify the project compiles cleanly:
  ```bash
  export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && npx tsc --noEmit
  ```
