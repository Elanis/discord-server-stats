import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { ApplicationCommandOptionType, AttachmentBuilder, ChannelType, Client, EmbedBuilder, Events, GatewayIntentBits, PermissionsBitField } from 'discord.js';
import ChartJSImage from 'chart.js-image';

import { guilds, botToken, minDate } from './config.js';

const client = new Client({ intents: [
	GatewayIntentBits.Guilds,
	GatewayIntentBits.GuildMembers,
	GatewayIntentBits.GuildMessages,
	GatewayIntentBits.MessageContent,
] });

function getDateFromDateTime(date) {
	if(Number.isNaN(date.getFullYear())) {
		return '?';
	}

	return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${(date.getDate()).toString().padStart(2, '0')}`;
}

async function sleep(ms) {
	await new Promise((resolve, reject) => setTimeout(resolve, ms));
}

async function getGuild(id) {
	const oauthGuild = (await client.guilds.fetch(x => x.id === id)).first();
	const guild = await oauthGuild.fetch();

	return { oauthGuild, guild };
}

async function getTextChannelsForGuild(id) {
	const { guild } = await getGuild(id);

	const channels = (await guild.channels.fetch()).filter(x => x.isTextBased());

	return {
		channels,
		threads: Array.from((await channels.first().threads.fetch()).threads.values())
	};
}

function getMinMaxDatesFromMessageList(messages) {
	let minDate = Number.MAX_SAFE_INTEGER;
	let maxDate = Number.MIN_SAFE_INTEGER;
	for(const message of messages) {
		if(minDate > message.createdTimestamp) {
			minDate = message.createdTimestamp
		}

		if(maxDate < message.createdTimestamp) {
			maxDate = message.createdTimestamp
		}
	}

	return { minDate, maxDate };
}

function getDatesListFromMessageList(messages) {
	const { minDate, maxDate } = getMinMaxDatesFromMessageList(messages);
	let dates = [];
	for(let date = minDate; date <= maxDate; date += 24 * 60 * 60 * 1000) {
		dates.push(
			getDateFromDateTime(new Date(date))
		);
	}

	if(dates.length > 45) {
		dates = Array.from(new Set(dates.map(x => {
			const items = x.split('-');
			items.pop();

			return items.join('-')
		})));
	}

	return dates;
}

function getChannelInfoMessagesPerDayChart(filteredMessages) {
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

function getChannelInfoUserMessagesPerDayChart(filteredMessages, topUsers) {
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

function getTopUsersFromMessages(messages, users) {
	const topUsersObj = {};
	for(const message of messages) {
		if(!topUsersObj[message.author]) {
			topUsersObj[message.author] = 0;
		}

		topUsersObj[message.author]++;
	}

	const topUsers = [];
	for(const userId in topUsersObj) {
		topUsers.push({
			id: userId,
			name: users[userId].username + '#' + users[userId].discriminator,
			amount: topUsersObj[userId],
		})
	}

	topUsers.sort((a, b) => b.amount - a.amount);

	return topUsers;
}

const commandsList = [{
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
}];

// START !
client.once(Events.ClientReady, async(c) => {
	console.log(`Ready! Logged in as ${c.user.tag}`);

	try {
		client.application?.commands.set(commandsList)
	} catch(e) {
		console.error(e);
	}

	for(const guildName in guilds) {
		// Create guild specific directory if needed
		const guildDir = `data/${guilds[guildName]}/`;
		try {
			await mkdir(guildDir);
		} catch { /* Already exists */ }

		// Persist channels list
		const { channels, threads } = await getTextChannelsForGuild(guilds[guildName]);
		const reducedChannels = channels.map(x => ({ id: x.id, name: x.name }));
		for(const thread of threads) {
			reducedChannels.push({ id: thread.id, name: thread.name });
		}

		await writeFile(`${guildDir}/channels.json`, JSON.stringify(reducedChannels, null, 4));

		// Load users cache
		let users = {};
		const userCacheFile = `${guildDir}/users.json`;
		try {
			const usersListStr = await readFile(userCacheFile, 'utf-8');
			users = JSON.parse(usersListStr);
		} catch(e) { /* Do not exists: default value */ }

		let channelsList = Array.from(channels.values());

		for(const thread of threads) {
			channelsList.push(thread);
		}

		for(let channel of channelsList) {

			if(!channel.permissionsFor(client.user).has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory])) {
				console.log(`Skipping ${channel.name}, reason: no permissions to read`);
				continue;
			}

			// Load messages cache
			let messages = [];
			let messagesCacheFile = `${guildDir}/messages-${channel.id}.json`
			try {
				const messagesListStr = await readFile(messagesCacheFile, 'utf-8');
				messages = JSON.parse(messagesListStr);
			} catch(e) { /* Do not exists: default value */ }

			async function persist() {
				console.log('Channel: ' + channel.name);
				console.log('Messages: ' + messages.length);
				console.log('From: ' + new Date(messages[messages.length - 1].createdTimestamp));
				console.log('To: ' + new Date(messages[0].createdTimestamp));

				console.log('Users: ' + Object.keys(users).length);

				await writeFile(messagesCacheFile, JSON.stringify(messages, null, 4));
				await writeFile(userCacheFile, JSON.stringify(users, null, 4));
			}

			// Get messages
			let iterator = 0;
			let beforeMode = true;
			let shouldQuit = false;
			while(!shouldQuit) {
				let options = { limit: 100 };

				if(messages.length > 0) {
					if(beforeMode) {
						options['before'] = messages[messages.length - 1].id;
					} else {
						options['after'] = messages[0].id;
					}
				}

				const fetchedMessages = Array.from((await channel.messages.fetch(options)).values());
				if(!beforeMode) {
					fetchedMessages.reverse();
				}

				if(fetchedMessages.length === 0) {
					if(beforeMode) {
						beforeMode = false;
						continue;
					}

					break;
				}

				let added = false;
				for(let message of fetchedMessages) {
					const convertedMessage = {
						id: message.id,
						createdTimestamp: message.createdTimestamp,
						type: message.type,
						content: message.content,
						author: message.author.id,
					};

					if(messages.find(x => x.id === message.id)) {
						continue;
					}

					added = true;

					if(beforeMode) {
						messages.push(convertedMessage);
					} else {
						messages.unshift(convertedMessage);
					}

					if(!users[message.author.id]) {
						users[message.author.id] = {
							bot: message.author.bot,
							system: message.author.system,
							username: message.author.username,
							discriminator: message.author.discriminator,
						};
					}

					if(message.createdTimestamp < minDate.getTime()) {
						beforeMode = false;
						break;
					}
				}

				if(!added && beforeMode) {
					beforeMode = false;
				} else if(!added) {
					shouldQuit = true;
				}

				if(++iterator === 10) {
					await persist();
					iterator = 0;
				}

				await sleep(2000);
			}

			await persist();
		}
	}
});

async function channelInfo(interaction) {
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

client.on('interactionCreate',  async(interaction) => {
	if(interaction.isCommand()) {
		switch(interaction.commandName) {
			case 'channelinfo':
				await channelInfo(interaction);
				break;
		}
	}
});

client.login(botToken);