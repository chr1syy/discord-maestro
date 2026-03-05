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
  .addSubcommand((sub) => sub.setName('list').setDescription('List all available agents'))
  .addSubcommand((sub) =>
    sub
      .setName('connect')
      .setDescription('Connect a Maestro agent to a dedicated Discord channel')
      .addStringOption((opt) =>
        opt
          .setName('agent')
          .setDescription('Agent ID or unique prefix (from /agents list)')
          .setRequired(true)
      )
  )
  .addSubcommand((sub) => sub.setName('disconnect').setDescription('Remove this agent channel (deletes the channel)'));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === 'list') {
    await handleList(interaction);
  } else if (sub === 'connect') {
    await handleConnect(interaction);
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
    .setFooter({ text: 'Use /agents connect <agent-id> to create an agent channel' });

  await interaction.editReply({ embeds: [embed] });
}

async function handleConnect(interaction: ChatInputCommandInteraction): Promise<void> {
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
  const channel = (await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `Maestro agent: ${agent.name} (${agent.id}) | ${agent.toolType} | ${agent.cwd}`,
  })) as TextChannel;

  channelDb.register(channel.id, guild.id, agent.id, agent.name);

  await interaction.editReply(
    `✅ Created <#${channel.id}> for agent **${agent.name}**.`
  );

  await channel.send(
    `**${agent.name}** is connected.\n` +
      `Use \`/session new\` to start a session thread, then chat inside that thread.\n` +
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
