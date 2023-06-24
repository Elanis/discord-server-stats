import { readdir, readFile } from 'node:fs/promises';
import { ApplicationCommandOptionType, AttachmentBuilder, EmbedBuilder, PermissionsBitField } from 'discord.js';
import ChartJSImage from 'chart.js-image';

import { getDateFromDateTime } from './helpers.js';

import { getTopChannelsForUser, getGlobalMetadataForUser } from './databaseHelpers.js';

export function getUserInfoMessagesPerDayChart(globalMetaData) {
	const chart = ChartJSImage().chart({
		"type": "line",
		"data": {
			"labels": globalMetaData.dates.map(x => getDateFromDateTime(x.date)),
			"datasets": [
				{
					"label": "",
					"borderColor": "rgb(255,+99,+132)",
					"backgroundColor": "rgba(255,+99,+132,+.5)",
					"data": globalMetaData.dates.map(x => x.count),
				}
			]
		},
		"options": {
			"title": {
				"display": false,
				"text": "Messages per day"
			},
			"scales": {
				"xAxes": [
					{
						"scaleLabel": {
							"display": false,
							"labelString": "Day"
						}
					}
				],
				"yAxes": [
					{
						"stacked": true,
						"scaleLabel": {
							"display": true,
							"labelString": "Messages"
						}
					}
				]
			}
		}
	}) // Line chart
	.backgroundColor('white')
	.width(400 + globalMetaData.dates.length * 4)
	.height(300); // 300px

	return chart;
}

export function getUserInfoUserMessagesPerDayChart(topChannels) {
	const colors = ['#1abc9c', '#f1c40f', '#130f40', '#e67e22', '#3498db', '#e74c3c', '#9b59b6', '#34495e', '#95a5a6', '#e84393'];
	
	const chart = ChartJSImage().chart({
		"type": "bar",
		"data": {
			"labels": topChannels[0].dates.map(x => getDateFromDateTime(x.date)),
			"datasets": 
				topChannels.map((channel, index) => ({
					label: channel.name,
					"borderColor": colors[index],
					"backgroundColor": colors[index],
					data: channel.dates.map(x => x.count),
				}))
		},
		"options": {
			"title": {
				"display": false,
				"text": "Messages per day"
			},
			"scales": {
				"xAxes": [
					{
						"scaleLabel": {
							"display": false,
							"labelString": "Day"
						}
					}
				],
				"yAxes": [
					{
						"scaleLabel": {
							"display": true,
							"labelString": "Messages"
						}
					}
				]
			}
		}
	}) // Line chart
	.backgroundColor('white')
	.width(500 + topChannels[0].dates.length * 10)
	.height(500);

	return chart;
}

export async function userInfoCommandHandler(interaction, client, pgClient) {
	await interaction.deferReply();

	const user = interaction.options.getUser('user');

	if(user === null) {
		return await interaction.editReply({ content: 'Invalid user !' });
	}

	const fromStr = interaction.options.getString('from');
	const from = fromStr === null ? new Date(2001, 0, 1) : new Date(interaction.options.getString('from'));

	const toStr = interaction.options.getString('to');
	const to = toStr === null ? new Date(Date.now()) : new Date(interaction.options.getString('to'));

	// Get data
	const globalMetaData = await getGlobalMetadataForUser(pgClient, interaction.guildId, user.id, from, to);
	const top10Channels = await getTopChannelsForUser(pgClient, interaction.guildId, user.id, 10, globalMetaData.min, globalMetaData.max);

	const globalChart = getUserInfoMessagesPerDayChart(globalMetaData);
	const globalFileName = `${interaction.guildId}-${user.id}-global.png`;
	const globalFile = new AttachmentBuilder(await globalChart.toBuffer(), { name: globalFileName });

	const channelsChart = getUserInfoUserMessagesPerDayChart(top10Channels);
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
