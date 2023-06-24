import { readFile } from 'node:fs/promises';
import { ApplicationCommandOptionType, AttachmentBuilder, EmbedBuilder, PermissionsBitField } from 'discord.js';
import ChartJSImage from 'chart.js-image';

import { getDateFromDateTime } from './helpers.js';

import { getTopUsersForChannel, getGlobalMetadataForChannel } from './databaseHelpers.js';

export function getChannelInfoMessagesPerDayChart(globalMetaData) {
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

export function getChannelInfoUserMessagesPerDayChart(topUsers) {
	const colors = ['#1abc9c', '#f1c40f', '#130f40', '#e67e22', '#3498db', '#e74c3c', '#9b59b6', '#34495e', '#95a5a6', '#e84393'];
	
	const chart = ChartJSImage().chart({
		"type": "bar",
		"data": {
			"labels": topUsers[0].dates.map(x => getDateFromDateTime(x.date)),
			"datasets": 
				topUsers.map((user, index) => ({
					label: user.name,
					"borderColor": colors[index],
					"backgroundColor": colors[index],
					data: user.dates.map(x => x.count),
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
	.width(500 + topUsers[0].dates.length * 10)
	.height(500);

	return chart;
}

export async function channelInfoCommandHandler(interaction, pgClient) {
	await interaction.deferReply();

	const channel = interaction.options.getChannel('channel');

	if(channel === null) {
		return await interaction.editReply({ content: 'Invalid channel !' });
	}

	const fromStr = interaction.options.getString('from');
	const from = fromStr === null ? new Date(2001, 0, 1) : new Date(interaction.options.getString('from'));

	const toStr = interaction.options.getString('to');
	const to = toStr === null ? new Date(Date.now()) : new Date(interaction.options.getString('to'));

	// Get data
	const globalMetaData = await getGlobalMetadataForChannel(pgClient, interaction.guildId, channel.id, from, to);
	const top10Users = await getTopUsersForChannel(pgClient, interaction.guildId, channel.id, 10, globalMetaData.min, globalMetaData.max);
	
	// Get charts
	const globalChart = getChannelInfoMessagesPerDayChart(globalMetaData);
	const globalFileName = `${interaction.guildId}-${channel.id}-global.png`;
	const globalFile = new AttachmentBuilder(await globalChart.toBuffer(), { name: globalFileName });

	const usersChart = getChannelInfoUserMessagesPerDayChart(top10Users);
	const usersFileName = `${interaction.guildId}-${channel.id}-users.png`;
	const userFile = new AttachmentBuilder(await usersChart.toBuffer(), { name: usersFileName });

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
