export function getDateFromDateTime(date) {
	if(Number.isNaN(date.getFullYear())) {
		return '?';
	}

	return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${(date.getDate()).toString().padStart(2, '0')}`;
}

export async function sleep(ms) {
	await new Promise((resolve, reject) => setTimeout(resolve, ms));
}

export async function getGuild(client, id) {
	const oauthGuild = (await client.guilds.fetch(x => x.id === id)).first();
	const guild = await oauthGuild.fetch();

	return { oauthGuild, guild };
}

export async function getTextChannelsForGuild(client, id) {
	const { guild } = await getGuild(client, id);

	const channels = (await guild.channels.fetch()).filter(x => x.isTextBased());

	return {
		channels,
		threads: Array.from((await channels.first().threads.fetch()).threads.values())
	};
}