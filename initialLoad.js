import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { PermissionsBitField } from 'discord.js';
import ChartJSImage from 'chart.js-image';

import { guilds, minDate } from './config.js';

import { getTextChannelsForGuild, sleep } from './helpers.js';

async function syncChannelListToDb(channels, pgClient, guild) {
	const dbChannels = (await pgClient.query('SELECT * FROM public.channels')).rows;
	for(const channel of channels) {
		if(dbChannels.find(x => x.id === channel.id && x.name === channel.name)) {
			continue;
		}
		if(dbChannels.find(x => x.id === channel.id)) {
			await pgClient.query(`UPDATE public.channels SET name = $2 WHERE id = $1 AND guild = $3`, [channel.id, channel.name, guild]);
			continue;
		}

		await pgClient.query(`INSERT INTO public.channels(id, name, guild) VALUES ($1, $2, $3)`, [channel.id, channel.name, guild]);
	}
}

export async function initialLoad(client, pgClient) {
	for(const guildName in guilds) {
		// Persist channels list
		const { channels, threads } = await getTextChannelsForGuild(client, guilds[guildName]);
		const reducedChannels = channels.map(x => ({ id: x.id, name: x.name }));
		for(const thread of threads) {
			reducedChannels.push({ id: thread.id, name: thread.name });
		}

		await syncChannelListToDb(reducedChannels, pgClient, guilds[guildName]);

		// Load users cache
		let users = (await pgClient.query('SELECT * FROM users')).rows;

		// Channels list for loop
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
			const messages = (await pgClient.query('SELECT id FROM public.messages WHERE channel = $1 ORDER BY id::bigint DESC', [channel.id])).rows;

			// Get messages
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
					if(messages.find(x => x.id === message.id)) {
						continue;
					}

					added = true;

					if(beforeMode) {
						messages.push({ id: message.id });
					} else {
						messages.unshift({ id: message.id });
					}

					if(!users.find(x => x.id === message.author.id)) {
						await pgClient.query(`INSERT INTO public.users(id, bot, system, username, discriminator) 
							VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
							[message.author.id, message.author.bot, message.author.system, message.author.username, message.author.discriminator]);
					}
					if(users.find(x => x.id === message.author.id && 
						(x.name !== message.author.username || x.discriminator !== message.author.discriminator)
					)) {
						await pgClient.query('UPDATE public.users SET username = $1, discriminator = $2 WHERE id = $3',
							[message.author.username, message.author.discriminator, message.author.id]
						);
					}

					if(message.createdTimestamp < minDate.getTime()) {
						beforeMode = false;
						break;
					}

					await pgClient.query(`INSERT INTO public.messages(id, "createdTimestamp", type, content, author, channel, guild)
						VALUES ($1, $2, $3, $4, $5, $6, $7)`,
						[message.id, message.createdTimestamp, message.type, message.content, message.author.id, channel.id, guilds[guildName]]
					);
				}

				if(!added && beforeMode) {
					beforeMode = false;
				} else if(!added) {
					shouldQuit = true;
				}

				await sleep(2000);
			}

			console.log(`${channel.name} is up to date !`);
		}

		console.log(`${guildName} is up to date !`);
	}
}