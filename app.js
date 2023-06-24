import { Client, Events, GatewayIntentBits } from 'discord.js';

import pg from 'pg';

import { botToken, connectionString } from './config.js';

import { channelInfoCommand, channelInfoCommandHandler } from './channelInfo.js';
import { userInfoCommand, userInfoCommandHandler } from './userInfo.js';
import { initialLoad } from './initialLoad.js';

const client = new Client({ intents: [
	GatewayIntentBits.Guilds,
	GatewayIntentBits.GuildMembers,
	GatewayIntentBits.GuildMessages,
	GatewayIntentBits.MessageContent,
] });

const pgClient = new pg.Client(connectionString);
await pgClient.connect();

const commandsList = [
	channelInfoCommand,
	userInfoCommand
];

client.once(Events.ClientReady, async(c) => {
	console.log(`Ready! Logged in as ${c.user.tag}`);

	try {
		client.application?.commands.set(commandsList)
	} catch(e) {
		console.error(e);
	}


	const executeLoad = async() => {
		await initialLoad(client, pgClient);
		setTimeout(executeLoad, 60 * 60 * 1000);
	};
	executeLoad();
});

client.on('interactionCreate',  async(interaction) => {
	try {
		if(interaction.isCommand()) {
			switch(interaction.commandName) {
				case 'channelinfo':
					await channelInfoCommandHandler(interaction, pgClient);
					break;
				case 'userinfo':
					await userInfoCommandHandler(interaction, client, pgClient);
					break;
			}
		}
	} catch(e) {
		console.error(e);
	}
});

client.login(botToken);