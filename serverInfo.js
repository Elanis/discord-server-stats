import { ApplicationCommandOptionType, AttachmentBuilder, EmbedBuilder, PermissionsBitField } from 'discord.js';
import ChartJSImage from 'chart.js-image';

import { getDateFromDateTime } from './helpers.js';

import { getGlobalMetadataForServer, getTopChannelsForServer, getTopUsersForServer } from './databaseHelpers.js';
import { colors, getChart } from './getChart.js';

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
	const globalChart = getChart(
		'line',
		globalMetaData.dates.map(x => getDateFromDateTime(x.date)),
		[
			{
				"label": "",
				"borderColor": "rgb(255,+99,+132)",
				"backgroundColor": "rgba(255,+99,+132,+.5)",
				"data": globalMetaData.dates.map(x => x.count),
			}
		]
	);
	const globalFileName = `${interaction.guildId}-global.png`;
	const globalFile = new AttachmentBuilder(await globalChart.toBuffer(), { name: globalFileName });


	const usersChart = getChart(
		'bar',
		top10Users[0].dates.map(x => getDateFromDateTime(x.date)),
		top10Users.map((user, index) => ({
			label: user.name,
			borderColor: colors[index],
			backgroundColor: colors[index],
			data: user.dates.map(x => x.count),
		}))
	);
	const usersFileName = `${interaction.guildId}-users.png`;
	const userFile = new AttachmentBuilder(await usersChart.toBuffer(), { name: usersFileName });

	const channelsChart = getChart(
		'bar',
		top10Channels[0].dates.map(x => getDateFromDateTime(x.date)),
		top10Channels.map((channel, index) => ({
			label: channel.name,
			borderColor: colors[index],
			backgroundColor: colors[index],
			data: channel.dates.map(x => x.count),
		}))
	);
	const channelsFileName = `${interaction.guildId}-channels.png`;
	const channelsFile = new AttachmentBuilder(await channelsChart.toBuffer(), { name: channelsFileName });

	const url = `https://discord.com/channels/${interaction.guildId}/${interaction.guildId}`;
	const messageEmbeds = [
		new EmbedBuilder()
			.setURL(url)
			.setColor(0x0099FF)
			.setTitle(interaction.guild.name)
			.setImage('attachment://' + globalFileName)
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
			.setImage('attachment://' + channelsFileName),
		new EmbedBuilder()
			.setURL(url)
			.setColor(0x0099FF)
			.setImage('attachment://' + usersFileName)
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
