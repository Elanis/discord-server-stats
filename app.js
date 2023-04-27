import { mkdir, writeFile } from 'node:fs/promises';
import { ChannelType, Client, Events, GatewayIntentBits } from 'discord.js';

import { guilds, botToken } from './config.js';

const client = new Client({ intents: [
	GatewayIntentBits.Guilds,
	GatewayIntentBits.GuildMembers,
	GatewayIntentBits.GuildMessages,
	GatewayIntentBits.MessageContent,
] });

async function getGuild(id) {
	const oauthGuild = (await client.guilds.fetch(x => x.id === id)).first();
	const guild = await oauthGuild.fetch();

	return { oauthGuild, guild };
}

async function getTextChannelsForGuild(id) {
	const { guild } = await getGuild(id);

	return (await guild.channels.fetch()).filter(x => [
		ChannelType.AnnouncementThread,
		ChannelType.GuildAnnouncement,
		ChannelType.GuildPrivateThread,
		ChannelType.GuildText,
		ChannelType.PublicThread,
		ChannelType.GuildNews,
		ChannelType.GuildPublicThread,
		ChannelType.GuildNewsThread,
		ChannelType.PrivateThread
	].includes(x.type)); 
}

// START !
client.once(Events.ClientReady, async(c) => {
	console.log(`Ready! Logged in as ${c.user.tag}`);

	for(const guildName in guilds) {
		// Create guild specific directory if needed
		const guildDir = `data/${guilds[guildName]}/`;
		try {
			await mkdir(guildDir);
		} catch { /* Already exists */ }

		// Persist channels list
		const channels = await getTextChannelsForGuild(guilds[guildName]);
		const reducedChannels = channels.map(x => ({ id: x.id, name: x.name }));
		await writeFile(`${guildDir}/channels.json`, JSON.stringify(reducedChannels, null, 4));
	}
});

client.login(botToken);