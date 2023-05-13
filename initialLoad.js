import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { PermissionsBitField } from 'discord.js';
import ChartJSImage from 'chart.js-image';

import { guilds, minDate } from './config.js';

import { getTextChannelsForGuild, sleep } from './helpers.js';

export async function initialLoad(client) {
	for(const guildName in guilds) {
		// Create guild specific directory if needed
		const guildDir = `data/${guilds[guildName]}/`;
		try {
			await mkdir(guildDir);
		} catch { /* Already exists */ }

		// Persist channels list
		const { channels, threads } = await getTextChannelsForGuild(client, guilds[guildName]);
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
}