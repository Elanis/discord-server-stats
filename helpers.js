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

export function getMinMaxDatesFromMessageList(messages) {
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

export function getDatesListFromMessageList(messages) {
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

export function getTopUsersFromMessages(messages, users) {
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