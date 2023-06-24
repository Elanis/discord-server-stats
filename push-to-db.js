import pg from 'pg';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

import { connectionString } from './config.js';

const pgClient = new pg.Client(connectionString);
await pgClient.connect();

const amount_per_query = 1000;

function log(msg) {
	console.log(`${(new Date()).toLocaleTimeString()} - ${msg}`);
}

log('Connected to db !');

let i = 0;
const guild = 'GUIDID';
const channels = JSON.parse(await readFile(`data/${guild}/channels.json`));
const dbChannels = (await pgClient.query('SELECT * FROM public.channels')).rows;

for(const channel of channels) {
	if(dbChannels.find(x => x.id === channel.id)) {
		if(++i % 100 === 0) { log(`${i}/${channels.length}`); }
		continue;
	}
	// TODO: update ?
	await pgClient.query(`INSERT INTO public.channels(id, name, guild) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [channel.id, channel.name, guild]);

	if(++i % 100 === 0) { log(`${i}/${channels.length}`); }
}

log('Synced channels !');

const users = JSON.parse(await readFile(`data/${guild}/users.json`));
const dbUsers = (await pgClient.query('SELECT * FROM public.users')).rows;

const length = Object.keys(users).length;
i=0;
for(const userId in users) {
	const user = users[userId];
	if(dbUsers.find(x => x.id === userId)) {
		if(++i % 100 === 0) { log(`${i}/${length}`); }
		continue;
	}
	// TODO: update ?
	await pgClient.query(`INSERT INTO public.users(id, bot, system, username, discriminator) 
		VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`, [userId, user.bot, user.system, user.username, user.discriminator]);

	if(++i % 100 === 0) { log(`${i}/${length}`); }
}

log('Synced users !');

for(let channel of channels) {
	try {
		const dbMessages = (await pgClient.query('SELECT id FROM public.messages WHERE channel = $1', [channel.id])).rows;
		let messages = [];
		let messagesCacheFile = `data/${guild}/messages-${channel.id}.json`
		try {
			const messagesListStr = await readFile(messagesCacheFile, 'utf-8');
			messages = JSON.parse(messagesListStr);
		} catch(e) { console.error(e); continue; }

		log(`Loaded ${messages.length} messages from channel ${channel.name}. Pushing to db.`);

		i=0;
		let tempList = [];
		for(const message of messages) {
			if(dbMessages.find(x => x.id === message.id)) {
				if(++i % 1000 === 0) { log(`${i}/${messages.length}`); }
				continue;
			}

			tempList.push(message);

			if(tempList.length === amount_per_query) {
				let values = '';
				for(let l = 0; l < amount_per_query; l++) {
				    values += `($${l*7 + 1}, $${l*7 + 2}, $${l*7 + 3}, $${l*7 + 4}, $${l*7 + 5}, $${l*7 + 6}, $${l*7 + 7}), `;
				}
				values = values.substr(0, values.length - 2);

				await pgClient.query(`INSERT INTO public.messages(id, "createdTimestamp", type, content, author, channel, guild)
					VALUES ${values}
					ON CONFLICT DO NOTHING`,
					tempList.map(x => [x.id, x.createdTimestamp, x.type, x.content.replaceAll('\u0000', ''), x.author, channel.id, guild]).flat()
				);

				tempList = [];
			}

			if(++i % 1000 === 0) { log(`${i}/${messages.length}`); }
		}
	} catch(e) { console.error(e); }
}