import { readdir, readFile } from 'node:fs/promises';
import { ApplicationCommandOptionType, AttachmentBuilder, EmbedBuilder, PermissionsBitField } from 'discord.js';
import ChartJSImage from 'chart.js-image';

import { getDateFromDateTime, getDatesListFromMessageList, getMinMaxDatesFromMessageList, getTextChannelsForGuild } from './helpers.js';

export function getUserInfoMessagesPerDayChart(filteredMessages) {
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

export function getUserInfoUserMessagesPerDayChart(filteredMessages, topChannels) {
	const dates = getDatesListFromMessageList(filteredMessages);
	const colors = ['#1abc9c', '#f1c40f', '#130f40', '#e67e22', '#3498db', '#e74c3c', '#9b59b6', '#34495e', '#95a5a6', '#e84393'];
	
	const chart = ChartJSImage().chart({
		"type": "bar",
		"data": {
			"labels": dates,
			"datasets": 
				topChannels.map((channel, index) => ({
					label: channel.name,
					"borderColor": colors[index],
					"backgroundColor": colors[index],
					data: dates.map(day => 
						filteredMessages.filter(x => x.channel === channel.id && getDateFromDateTime(new Date(x.createdTimestamp)).startsWith(day)).length
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

function getTopChannelsFromMessages(messages, reducedChannels) {
	const topChannelsObj = {};
	for(const message of messages) {
		if(!topChannelsObj[message.channel]) {
			topChannelsObj[message.channel] = 0;
		}

		topChannelsObj[message.channel]++;
	}

	const topChannels = [];
	for(const channelId in topChannelsObj) {
		let channelName = reducedChannels.find(x => x.id === channelId);
		if(channelName) {
			channelName = channelName.name;
		} else {
			channelName = '?';
		}

		topChannels.push({
			id: channelId,
			name: channelName,
			amount: topChannelsObj[channelId],
		})
	}

	topChannels.sort((a, b) => b.amount - a.amount);

	return topChannels;
}

export async function userInfoCommandHandler(interaction, client) {
	await interaction.deferReply();

	const user = interaction.options.getUser('user');

	if(user === null) {
		await interaction.editReply({ content: 'Invalid user !' });
	}

	const fromStr = interaction.options.getString('from');
	const from = fromStr === null ? new Date(2001, 0, 1) : new Date(interaction.options.getString('from'));

	const toStr = interaction.options.getString('to');
	const to = toStr === null ? new Date(Date.now()) : new Date(interaction.options.getString('to'));

	// Load messages
	let filteredMessages = [];
	const guildDir = `data/${interaction.guildId}`;
	const files = await readdir(guildDir);
	for(const file of files) {
		if(!file.startsWith('messages-')) {
			continue;
		}

		const path = `${guildDir}/${file}`;
		const channelId = file.split('-')[1].split('.')[0];

		let messages = [];
		try {
			const messagesListStr = await readFile(path, 'utf-8');
			messages = JSON.parse(messagesListStr);
		} catch(e) { console.error(e); /* Do not exists: default value */ }

		filteredMessages = [
			...filteredMessages,
			...messages.filter(x => 
				from.getTime() <= x.createdTimestamp && x.createdTimestamp <= to.getTime() &&
				x.author === user.id
			).map(x => ({ ...x, channel: channelId }))
		];
	}

	// Get channels list
	const { channels, threads } = await getTextChannelsForGuild(client, interaction.guildId);
	const reducedChannels = channels.map(x => ({ id: x.id, name: x.name }));
	for(const thread of threads) {
		reducedChannels.push({ id: thread.id, name: thread.name });
	}

	// Process messages
	const topChannels = getTopChannelsFromMessages(filteredMessages, reducedChannels);
	const top10Channels = topChannels.filter((x, i) => i < 10);

	const globalChart = getUserInfoMessagesPerDayChart(filteredMessages);
	const globalFileName = `${interaction.guildId}-${user.id}-global.png`;
	const globalFile = new AttachmentBuilder(await globalChart.toBuffer(), { name: globalFileName });

	const channelsChart = getUserInfoUserMessagesPerDayChart(filteredMessages, top10Channels);
	const channelsFileName = `${interaction.guildId}-${user.id}-channels.png`;
	const channelsFile = new AttachmentBuilder(await channelsChart.toBuffer(), { name: channelsFileName });

	const { minDate, maxDate } = getMinMaxDatesFromMessageList(filteredMessages);

	const url = `https://discord.com/users/${user.id}`;
	const messageEmbeds = [
		new EmbedBuilder()
			.setURL(url)
			.setColor(0x0099FF)
			.setTitle(`@${user.username}`)
			.setImage('attachment://' + globalFileName)
			.addFields(
				{ name: 'From:', value: getDateFromDateTime(new Date(minDate)) },
				{ name: 'To:', value: getDateFromDateTime(new Date(maxDate)) },
			)
			.addFields(
				{ name: 'Messages:', value: filteredMessages.length.toString(), inline: true },
				{ name: 'Top Channels', value: '```\n' + topChannels.filter((x, i) => i < 10).map((x, i) => `#${i + 1} - ${x.name} - ${x.amount} messages`).join('\n') + '\n```' }
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
