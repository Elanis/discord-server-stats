import { ApplicationCommandOptionType, AttachmentBuilder, EmbedBuilder, PermissionsBitField } from 'discord.js';

import { getDateFromDateTime } from './helpers.js';

import { getGlobalMetadataForServer, getTopChannelsForServer, getTopUsersForServer } from './databaseHelpers.js';
import { getBarChart, getChart } from './getChart.js';

const ATTACHMENT_PREFIX = 'attachment://';

export async function serverInfoCommandHandler(interaction, pgClient) {
	await interaction.deferReply();

	const fromStr = interaction.options.getString('from');
	const from = fromStr === null ? new Date(2001, 0, 1) : new Date(interaction.options.getString('from'));

	const toStr = interaction.options.getString('to');
	const to = toStr === null ? new Date(Date.now()) : new Date(interaction.options.getString('to'));

	// Get data
	const globalMetaData = await getGlobalMetadataForServer(pgClient, interaction.guildId, from, to);
	const top10Users = await getTopUsersForServer(pgClient, interaction.guildId, 10, globalMetaData.min, globalMetaData.max);
	const top10Channels = await getTopChannelsForServer(pgClient, interaction.guildId, 10, globalMetaData.min, globalMetaData.max);
	
	// Get charts
	const globalChart = await getChart(
		'line',
		globalMetaData.dates.map((x) => getDateFromDateTime(x.date)),
		[
			{
				"label": "Messages",
				"borderColor": "rgb(255,+99,+132)",
				"backgroundColor": "rgba(255,+99,+132,+.5)",
				"data": globalMetaData.dates.map(x => x.count),
			}
		]
	);
	const globalFileName = `${interaction.guildId}-global.png`;
	const globalFile = new AttachmentBuilder(globalChart, { name: globalFileName });


	const usersChart = await getBarChart(top10Users);
	const usersFileName = `${interaction.guildId}-users.png`;
	const userFile = new AttachmentBuilder(usersChart, { name: usersFileName });

	const channelsChart = await getBarChart(top10Channels);
	const channelsFileName = `${interaction.guildId}-channels.png`;
	const channelsFile = new AttachmentBuilder(channelsChart, { name: channelsFileName });

	const url = `https://discord.com/channels/${interaction.guildId}/${interaction.guildId}`;
	const messageEmbeds = [
		new EmbedBuilder()
			.setURL(url)
			.setColor(0x0099FF)
			.setTitle(interaction.guild.name)
			.setImage(ATTACHMENT_PREFIX + globalFileName)
			.addFields(
				{ name: 'From:', value: getDateFromDateTime(globalMetaData.min) },
				{ name: 'To:', value: getDateFromDateTime(globalMetaData.max) },
			)
			.addFields(
				{ name: 'Messages:', value: globalMetaData.count, inline: true },
				{ name: 'Users', value: globalMetaData.users, inline: true },
				{ name: 'Top Users', value: '```\n' + top10Users.map((x, i) => `#${i + 1} - ${x.name} - ${x.count} messages`).join('\n') + '\n```' },
				{ name: 'Top Channels', value: '```\n' + top10Channels.map((x, i) => `#${i + 1} - ${x.name} - ${x.count} messages`).join('\n') + '\n```' }
			)
			.setTimestamp(),
		new EmbedBuilder()
			.setURL(url)
			.setColor(0x0099FF)
			.setImage(ATTACHMENT_PREFIX + channelsFileName),
		new EmbedBuilder()
			.setURL(url)
			.setColor(0x0099FF)
			.setImage(ATTACHMENT_PREFIX + usersFileName)
	];
	await interaction.editReply({ embeds: messageEmbeds, files: [globalFile, channelsFile, userFile] });
}

export const serverInfoCommand = {
	name: 'serverinfo',
	description: 'Get Server Informations for a specific period',
	options: [
		{
			name: 'from',
			type: ApplicationCommandOptionType.String,
			description: 'From (date)',
		},
		{
			name: 'to',
			type: ApplicationCommandOptionType.String,
			description: 'To (date)',
		}
	],
	defaultMemberPermissions: PermissionsBitField.Flags.Administrator,
};
