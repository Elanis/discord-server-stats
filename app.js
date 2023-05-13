import { Client, Events, GatewayIntentBits } from 'discord.js';

import { botToken } from './config.js';

import { channelInfoCommand, channelInfoCommandHandler } from './channelInfo.js';
import { initialLoad } from './initialLoad.js';

const client = new Client({ intents: [
	GatewayIntentBits.Guilds,
	GatewayIntentBits.GuildMembers,
	GatewayIntentBits.GuildMessages,
	GatewayIntentBits.MessageContent,
] });

const commandsList = [
	channelInfoCommand
];

client.once(Events.ClientReady, async(c) => {
	console.log(`Ready! Logged in as ${c.user.tag}`);

	try {
		client.application?.commands.set(commandsList)
	} catch(e) {
		console.error(e);
	}

	await initialLoad(client);
});

client.on('interactionCreate',  async(interaction) => {
	if(interaction.isCommand()) {
		switch(interaction.commandName) {
			case 'channelinfo':
				await channelInfoCommandHandler(interaction);
				break;
		}
	}
});

client.login(botToken);