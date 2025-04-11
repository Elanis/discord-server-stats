import { ApplicationCommandOptionType, AttachmentBuilder, EmbedBuilder, PermissionsBitField } from 'discord.js';

import { getDateFromDateTime } from './helpers.js';

import { getGlobalMetadataForChannel, getTopUsersForChannel } from './databaseHelpers.js';
import { getBarChart, getChart } from './getChart.js';

export async function channelInfoCommandHandler(interaction, pgClient) {
	await interaction.deferReply();

	let channel = interaction.options.getChannel('channel');

	if (channel === null) {
		channel = interaction.channel;
	}

	const fromStr = interaction.options.getString('from');
	const from = fromStr === null ? new Date(2001, 0, 1) : new Date(interaction.options.getString('from'));

	const toStr = interaction.options.getString('to');
	const to = toStr === null ? new Date(Date.now()) : new Date(interaction.options.getString('to'));

	// Get data
	const globalMetaData = await getGlobalMetadataForChannel(pgClient, interaction.guildId, channel.id, from, to);
	const top10Users = await getTopUsersForChannel(pgClient, interaction.guildId, channel.id, 10, globalMetaData.min, globalMetaData.max);
	
	// Get charts
	const globalChart = await getChart(
		'line',
		globalMetaData.dates.map((x) => getDateFromDateTime(x.date)),
		[
			{
				fill: 'origin',
				label: "Messages",
				borderColor: "rgb(255,+99,+132)",
				backgroundColor: "rgba(255,+99,+132,+.5)",
				data: globalMetaData.dates.map((x) => x.count),
			}
		]
	);
	const globalFileName = `${interaction.guildId}-${channel.id}-global.png`;
	const globalFile = new AttachmentBuilder(globalChart, { name: globalFileName });

	const usersChart = await getBarChart(top10Users);
	const usersFileName = `${interaction.guildId}-${channel.id}-users.png`;
	const userFile = new AttachmentBuilder(usersChart, { name: usersFileName });

	const url = `https://discord.com/channels/${interaction.guildId}/${channel.id}`;
	const messageEmbeds = [
		new EmbedBuilder()
			.setURL(url)
			.setColor(0x0099FF)
			.setTitle(`<#${channel.id}>`)
			.setImage('attachment://' + globalFileName)
			.addFields(
				{ name: 'From:', value: getDateFromDateTime(globalMetaData.min) },
				{ name: 'To:', value: getDateFromDateTime(globalMetaData.max) },
			)
			.addFields(
				{ name: 'Messages:', value: globalMetaData.count, inline: true },
				{ name: 'Users', value: globalMetaData.users, inline: true },
				{ name: 'Top Users', value: '```\n' + top10Users.map((x, i) => `#${i + 1} - ${x.name} - ${x.count} messages`).join('\n') + '\n```' }
			)
			.setTimestamp(),
		new EmbedBuilder()
			.setURL(url)
			.setColor(0x0099FF)
			.setImage('attachment://' + usersFileName)
	];
	await interaction.editReply({ embeds: messageEmbeds, files: [globalFile, userFile] });
}

export const channelInfoCommand = {
	name: 'channelinfo',
	description: 'Get Channel informations for a specific period',
	options: [
		{
			name: 'channel',
			type: ApplicationCommandOptionType.Channel,
			description: 'Channel',
		},
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
