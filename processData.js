import { mkdir, readFile, writeFile } from 'node:fs/promises';

import { guilds, minDate } from './config.js';



for(const guildName in guilds) {
	const dataDir = `data/${guilds[guildName]}`;

	const channels = JSON.parse(await readFile(`${dataDir}/channels.json`));
	const users = JSON.parse(await readFile(`${dataDir}/users.json`));

	const reportDir = `reports/${guilds[guildName]}`;
	try {
		await mkdir(reportDir);
	} catch { /* Already exists */ }

	let sortedUsers = Object.values(users).map(x => x.username);
	sortedUsers.sort()

	console.log(sortedUsers);

	const data = {};
	for(const channel of channels) {
		data[channel.name] = {};

		for(const username of sortedUsers) {
			data[channel.name][username] = 0;
		}

		let messages = [];
		try {
			messages = JSON.parse(await readFile(`${dataDir}/messages-${channel.id}.json`));
			console.log('Channel ' + channel.name + ' loaded ' + messages.length + ' messages.');
		} catch(e) {
			console.log('Channel ' + channel.name + ' failed loading');
			delete data[channel.name];
			continue;
		}

		for(const message of messages) {
			data[channel.name][users[message.author].username]++;
		}
	}

	// HEADER
	let str = ',' + sortedUsers.map(x => x.replace(',', ' ')).join(',') + '\n';
	// BODY
	for(const channel of channels) {
	    if(!data[channel.name]) {
	        continue;
	    }

	    str += channel.name;
	    str += ',';

	    const values = [];
	    for(const username of sortedUsers) {
	        values.push(data[channel.name][username] || 0);
	    }

	    str += values.join(',');
	    str += '\n';
	}

	await writeFile(`${reportDir}/output-${guilds[guildName]}.csv`, str);
}