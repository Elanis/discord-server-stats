import { ApplicationCommandOptionType, AttachmentBuilder, EmbedBuilder, PermissionsBitField } from 'discord.js';

import { getDateFromDateTime } from './helpers.js';

import { getTopChannelsForUser, getGlobalMetadataForUser } from './databaseHelpers.js';
import { colors, getChart } from './getChart.js';

export async function userInfoCommandHandler(interaction, _client, pgClient) {
	await interaction.deferReply();

	let user = interaction.options.getUser('user');

	if(user === null) {
		user = interaction.user;
	}

	const fromStr = interaction.options.getString('from');
	const from = fromStr === null ? new Date(2001, 0, 1) : new Date(interaction.options.getString('from'));

	const toStr = interaction.options.getString('to');
	const to = toStr === null ? new Date(Date.now()) : new Date(interaction.options.getString('to'));

	// Get data
	const globalMetaData = await getGlobalMetadataForUser(pgClient, interaction.guildId, user.id, from, to);
	const top10Channels = await getTopChannelsForUser(pgClient, interaction.guildId, user.id, 10, globalMetaData.min, globalMetaData.max);

	const globalChart = getChart(
		'line',
		globalMetaData.dates.map((x) => getDateFromDateTime(x.date)),
		[
			{
				label: "",
				borderColor: "rgb(255,+99,+132)",
				backgroundColor: "rgba(255,+99,+132,+.5)",
				data: globalMetaData.dates.map((x) => x.count),
			}
		]
	);
	const globalFileName = `${interaction.guildId}-${user.id}-global.png`;
	const globalFile = new AttachmentBuilder(await globalChart.toBuffer(), { name: globalFileName });

	const channelsChart = getChart(
		'bar',
		top10Channels[0].dates.map((x) => getDateFromDateTime(x.date)),
		top10Channels.map((channel, index) => ({
			label: channel.name,
			borderColor: colors[index],
			backgroundColor: colors[index],
			data: channel.dates.map((x) => x.count),
		}))
	);
	const channelsFileName = `${interaction.guildId}-${user.id}-channels.png`;
	const channelsFile = new AttachmentBuilder(await channelsChart.toBuffer(), { name: channelsFileName });

	const url = `https://discord.com/users/${user.id}`;
	const messageEmbeds = [
		new EmbedBuilder()
			.setURL(url)
			.setColor(0x0099FF)
			.setTitle(`@${user.username}`)
			.setImage('attachment://' + globalFileName)
			.addFields(
				{ name: 'From:', value: getDateFromDateTime(globalMetaData.min) },
				{ name: 'To:', value: getDateFromDateTime(globalMetaData.max) },
			)
			.addFields(
				{ name: 'Messages:', value: globalMetaData.count, inline: true },
				{ name: 'Top Channels', value: '```\n' + top10Channels.map((x, i) => `#${i + 1} - ${x.name} - ${x.count} messages`).join('\n') + '\n```' }
			)
			.setTimestamp(),
		new EmbedBuilder()
			.setURL(url)
			.setColor(0x0099FF)
			.setImage('attachment://' + channelsFileName)
	];
	await interaction.editReply({ embeds: messageEmbeds, files: [globalFile, channelsFile] });
}

export const userInfoCommand = {
	name: 'userinfo',
	description: 'Get User informations for a specific period',
	options: [
		{
			name: 'user',
			type: ApplicationCommandOptionType.User,
			description: 'User',
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
