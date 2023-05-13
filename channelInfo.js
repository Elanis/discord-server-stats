import { readFile } from 'node:fs/promises';
import { ApplicationCommandOptionType, AttachmentBuilder, EmbedBuilder, PermissionsBitField } from 'discord.js';
import ChartJSImage from 'chart.js-image';

import { getDateFromDateTime, getDatesListFromMessageList, getMinMaxDatesFromMessageList, getTopUsersFromMessages } from './helpers.js';

export function getChannelInfoMessagesPerDayChart(filteredMessages) {
	const dates = getDatesListFromMessageList(filteredMessages);

	const chart = ChartJSImage().chart({
		"type": "line",
		"data": {
			"labels": dates,
			"datasets": [
				{
					"label": "",
					"borderColor": "rgb(255,+99,+132)",
					"backgroundColor": "rgba(255,+99,+132,+.5)",
					"data": dates.map(day => filteredMessages.filter(x => getDateFromDateTime(new Date(x.createdTimestamp)).startsWith(day)).length),
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
	.width(400 + dates.length * 4)
	.height(300); // 300px

	return chart;
}

export function getChannelInfoUserMessagesPerDayChart(filteredMessages, topUsers) {
	const dates = getDatesListFromMessageList(filteredMessages);
	const colors = ['#1abc9c', '#f1c40f', '#130f40', '#e67e22', '#3498db', '#e74c3c', '#9b59b6', '#34495e', '#95a5a6', '#e84393'];
	
	const chart = ChartJSImage().chart({
		"type": "bar",
		"data": {
			"labels": dates,
			"datasets": 
				topUsers.map((user, index) => ({
					label: user.name,
					"borderColor": colors[index],
					"backgroundColor": colors[index],
					data: dates.map(day => 
						filteredMessages.filter(x => x.author === user.id && getDateFromDateTime(new Date(x.createdTimestamp)).startsWith(day)).length
					),
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
	.width(500 + dates.length * 10)
	.height(500);

	return chart;
}

export async function channelInfoCommandHandler(interaction) {
	await interaction.deferReply();

	const channel = interaction.options.getChannel('channel');

	if(channel === null) {
		await interaction.editReply({ content: 'Invalid channel !' });
	}

	const fromStr = interaction.options.getString('from');
	const from = fromStr === null ? new Date(2001, 0, 1) : new Date(interaction.options.getString('from'));

	const toStr = interaction.options.getString('to');
	const to = toStr === null ? new Date(Date.now()) : new Date(interaction.options.getString('to'));

	// Load users cache
	let users = {};
	const userCacheFile = `data/${interaction.guildId}/users.json`;
	try {
		const usersListStr = await readFile(userCacheFile, 'utf-8');
		users = JSON.parse(usersListStr);
	} catch(e) { /* Do not exists: default value */ }

	// Load messages
	let messages = [];
	let messagesCacheFile = `data/${interaction.guildId}/messages-${channel.id}.json`
	try {
		const messagesListStr = await readFile(messagesCacheFile, 'utf-8');
		messages = JSON.parse(messagesListStr);
	} catch(e) { console.error(e); /* Do not exists: default value */ }

	const filteredMessages = messages.filter(x => from.getTime() <= x.createdTimestamp && x.createdTimestamp <= to.getTime());
	if(filteredMessages.length === 0) {
		return await interaction.editReply({ content: `No data for channel "${channel.name}" between ${getDateFromDateTime(from)} and ${getDateFromDateTime(to)}` });
	}

	const topUsers = getTopUsersFromMessages(filteredMessages, users);
	const top10Users = topUsers.filter((x, i) => i < 10);

	const globalChart = getChannelInfoMessagesPerDayChart(filteredMessages);
	const globalFileName = `${interaction.guildId}-${channel.id}-global.png`;
	const globalFile = new AttachmentBuilder(await globalChart.toBuffer(), { name: globalFileName });

	const usersChart = getChannelInfoUserMessagesPerDayChart(filteredMessages, top10Users);
	const usersFileName = `${interaction.guildId}-${channel.id}-users.png`;
	const userFile = new AttachmentBuilder(await usersChart.toBuffer(), { name: usersFileName });

	const { minDate, maxDate } = getMinMaxDatesFromMessageList(filteredMessages);

	const url = `https://discord.com/channels/${interaction.guildId}/${channel.id}`;
	const messageEmbeds = [
		new EmbedBuilder()
			.setURL(url)
			.setColor(0x0099FF)
			.setTitle(`<#${channel.id}>`)
			.setImage('attachment://' + globalFileName)
			.addFields(
				{ name: 'From:', value: getDateFromDateTime(new Date(minDate)) },
				{ name: 'To:', value: getDateFromDateTime(new Date(maxDate)) },
			)
			.addFields(
				{ name: 'Messages:', value: filteredMessages.length.toString(), inline: true },
				{ name: 'Users', value: Array.from(new Set(filteredMessages.map(x => x.author))).length.toString(), inline: true },
				{ name: 'Top Users', value: '```\n' + topUsers.filter((x, i) => i < 10).map((x, i) => `#${i + 1} - ${x.name} - ${x.amount} messages`).join('\n') + '\n```' }
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
