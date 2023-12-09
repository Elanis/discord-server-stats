export function getDateFromDateTime(date) {
	if(Number.isNaN(date.getFullYear())) {
		return '?';
	}

	return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${(date.getDate()).toString().padStart(2, '0')}`;
}

export async function sleep(ms) {
	return new Promise((resolve, _reject) => setTimeout(resolve, ms));
}

export async function getGuild(client, id) {
	return client.guilds.fetch(id);
}

export async function getTextChannelsForGuild(client, id) {
	const guild = await getGuild(client, id);

	const channels = (await guild.channels.fetch()).filter((x) => x.isTextBased());
	const threads = (await guild.channels.fetchActiveThreads()).threads.values();

	return {
		channels,
		threads
	};
}

export function logWithTime(...args) { return console.log((new Date().toISOString()), ...args); };