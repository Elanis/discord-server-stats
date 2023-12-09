function reduceDates(dates) {
	dates.sort((a, b) => a.date.getTime() - b.date.getTime());

	if(dates.length > 45) {
		const filteredDates = [];

		dates[0].date.setDate(1);
		let lastDate = new Date(dates[0].date);
		let count = 0;
		
		for(const date of dates) {
			if(lastDate.getMonth() !== date.date.getMonth()) {
				filteredDates.push({ date: lastDate, count });

				date.date.setDate(1);
				lastDate = new Date(date.date);
				count = 0;
			}

			count += parseInt(date.count, 10);
		}

		filteredDates.push({ date: lastDate, count });

		dates = filteredDates;
	}

	if(dates.length > 45) {
		const filteredDates = [];

		dates[0].date.setMonth(0);
		let lastDate = new Date(dates[0].date);
		let count = 0;
		
		for(const date of dates) {
			if(lastDate.getFullYear() !== date.date.getFullYear()) {
				filteredDates.push({ date: lastDate, count });

				date.date.setMonth(0);
				lastDate = new Date(date.date);
				count = 0;
			}

			count += parseInt(date.count, 10);
		}

		filteredDates.push({ date: lastDate, count });

		dates = filteredDates;
	}

	return dates;
}

///// CHANNEL INFO
export async function getTopUsersForChannel(pgClient, guild, channel, amount, from, toArg) {
	const to = new Date(toArg);
	to.setDate(to.getDate() + 1);

	const topUsers = (await pgClient.query(`
		SELECT CONCAT(CONCAT(users.username, '#'), users.discriminator) as name, users.id as userid, COUNT(*) as count
		FROM public.messages
		INNER JOIN users ON users.id = author
		WHERE messages.channel = $1
		AND messages.guild = $2
		AND "createdTimestamp" >= $4
		AND "createdTimestamp" <= $5
		GROUP BY 1, 2
		ORDER BY 3 DESC
		LIMIT $3
	`, [channel, guild, amount, from.getTime(), to.getTime()])).rows;

	for(const user of topUsers) {
		user.dates = (await pgClient.query(`
			SELECT to_timestamp("createdTimestamp" / 1000)::date as date, COUNT(*) as count
			FROM public.messages
			WHERE messages.channel = $1
			AND messages.guild = $2
			AND messages.author = $3
			AND "createdTimestamp" >= $4
			AND "createdTimestamp" <= $5
			GROUP BY 1
			ORDER BY 1
		`, [channel, guild, user.userid, from.getTime(), to.getTime()])).rows;

		for(const date = new Date(from); date.getTime() < to.getTime(); date.setDate(date.getDate() + 1)) {
			if(!user.dates.find((x) => x.date.getTime() === date.getTime())) {
				user.dates.push({ date: new Date(date), count: 0 });
			}
		}
		user.dates = reduceDates(user.dates);
	}

	return topUsers;
}

export async function getGlobalMetadataForChannel(pgClient, guild, channel, from, to) {
	let dates = (await pgClient.query(`
		SELECT to_timestamp("createdTimestamp" / 1000)::date as date, COUNT(*) as count
		FROM public.messages
		WHERE messages.channel = $1
		AND messages.guild = $2
		AND "createdTimestamp" >= $3
		AND "createdTimestamp" <= $4
		GROUP BY 1
		ORDER BY 1
	`, [channel, guild, from.getTime(), to.getTime()])).rows;

	const { count, users } = (await pgClient.query(`
		SELECT COUNT(*) as count, COUNT(DISTINCT author) as users
		FROM public.messages
		WHERE messages.channel = $1
		AND messages.guild = $2
		AND "createdTimestamp" >= $3
		AND "createdTimestamp" <= $4
	`, [channel, guild, from.getTime(), to.getTime()])).rows[0];

	let min = '?';
	let max = '?';
	if(dates.length > 0) {
		min = dates[0].date;
		max = dates[dates.length - 1].date;

		for(const date = new Date(min); date.getTime() < max.getTime(); date.setDate(date.getDate() + 1)) {
			if(!dates.find((x) => x.date.getTime() === date.getTime())) {
				dates.push({ date: new Date(date), count: 0 });
			}
		}
		dates = reduceDates(dates);
	}

	return { dates, min, max, count, users };
}


///// USER INFO
export async function getTopChannelsForUser(pgClient, guild, user, amount, from, toArg) {
	const to = new Date(toArg);
	to.setDate(to.getDate() + 1);

	const topChannels = (await pgClient.query(`
		SELECT channels.name as name, channels.id as channelid, COUNT(*) as count
		FROM public.messages
		INNER JOIN channels ON channels.id = channel
		WHERE messages.author = $1
		AND messages.guild = $2
		AND "createdTimestamp" >= $4
		AND "createdTimestamp" <= $5
		GROUP BY 1, 2
		ORDER BY 3 DESC
		LIMIT $3
	`, [user, guild, amount, from.getTime(), to.getTime()])).rows;

	for(const channel of topChannels) {
		channel.dates = (await pgClient.query(`
			SELECT to_timestamp("createdTimestamp" / 1000)::date as date, COUNT(*) as count
			FROM public.messages
			WHERE messages.author = $1
			AND messages.guild = $2
			AND messages.channel = $3
			AND "createdTimestamp" >= $4
			AND "createdTimestamp" <= $5
			GROUP BY 1
			ORDER BY 1
		`, [user, guild, channel.channelid, from.getTime(), to.getTime()])).rows;

		for(const date = new Date(from); date.getTime() < to.getTime(); date.setDate(date.getDate() + 1)) {
			if(!channel.dates.find((x) => x.date.getTime() === date.getTime())) {
				channel.dates.push({ date: new Date(date), count: 0 });
			}
		}
		channel.dates = reduceDates(channel.dates);
	}

	return topChannels;
}

export async function getGlobalMetadataForUser(pgClient, guild, user, from, to) {
	let dates = (await pgClient.query(`
		SELECT to_timestamp("createdTimestamp" / 1000)::date as date, COUNT(*) as count
		FROM public.messages
		WHERE messages.author = $1
		AND messages.guild = $2
		AND "createdTimestamp" >= $3
		AND "createdTimestamp" <= $4
		GROUP BY 1
		ORDER BY 1
	`, [user, guild, from.getTime(), to.getTime()])).rows;

	const { count } = (await pgClient.query(`
		SELECT COUNT(*) as count
		FROM public.messages
		WHERE messages.author = $1
		AND messages.guild = $2
		AND "createdTimestamp" >= $3
		AND "createdTimestamp" <= $4
	`, [user, guild, from.getTime(), to.getTime()])).rows[0];

	let min = '?';
	let max = '?';
	if(dates.length > 0) {
		min = dates[0].date;
		max = dates[dates.length - 1].date;

		for(const date = new Date(min); date.getTime() < max.getTime(); date.setDate(date.getDate() + 1)) {
			if(!dates.find((x) => x.date.getTime() === date.getTime())) {
				dates.push({ date: new Date(date), count: 0 });
			}
		}
		dates = reduceDates(dates);
	}

	return { dates, min, max, count };
}

/// SERVER INFO
export async function getGlobalMetadataForServer(pgClient, guild, from, to) {
	let dates = (await pgClient.query(`
		SELECT to_timestamp("createdTimestamp" / 1000)::date as date, COUNT(*) as count
		FROM public.messages
		WHERE messages.guild = $1
		AND "createdTimestamp" >= $2
		AND "createdTimestamp" <= $3
		GROUP BY 1
		ORDER BY 1
	`, [guild, from.getTime(), to.getTime()])).rows;

	const { count, users } = (await pgClient.query(`
		SELECT COUNT(*) as count, COUNT(DISTINCT author) as users
		FROM public.messages
		WHERE messages.guild = $1
		AND "createdTimestamp" >= $2
		AND "createdTimestamp" <= $3
	`, [guild, from.getTime(), to.getTime()])).rows[0];

	let min = '?';
	let max = '?';
	if(dates.length > 0) {
		min = dates[0].date;
		max = dates[dates.length - 1].date;

		for(const date = new Date(min); date.getTime() < max.getTime(); date.setDate(date.getDate() + 1)) {
			if(!dates.find((x) => x.date.getTime() === date.getTime())) {
				dates.push({ date: new Date(date), count: 0 });
			}
		}
		dates = reduceDates(dates);
	}

	return { dates, min, max, count, users };
}

export async function getTopChannelsForServer(pgClient, guild, amount, from, toArg) {
	const to = new Date(toArg);
	to.setDate(to.getDate() + 1);

	const topChannels = (await pgClient.query(`
		SELECT channels.name as name, channels.id as channelid, COUNT(*) as count
		FROM public.messages
		INNER JOIN channels ON channels.id = channel
		WHERE messages.guild = $1
		AND "createdTimestamp" >= $3
		AND "createdTimestamp" <= $4
		GROUP BY 1, 2
		ORDER BY 3 DESC
		LIMIT $2
	`, [guild, amount, from.getTime(), to.getTime()])).rows;

	for(const channel of topChannels) {
		channel.dates = (await pgClient.query(`
			SELECT to_timestamp("createdTimestamp" / 1000)::date as date, COUNT(*) as count
			FROM public.messages
			WHERE messages.guild = $1
			AND messages.channel = $2
			AND "createdTimestamp" >= $3
			AND "createdTimestamp" <= $4
			GROUP BY 1
			ORDER BY 1
		`, [guild, channel.channelid, from.getTime(), to.getTime()])).rows;

		for(const date = new Date(from); date.getTime() < to.getTime(); date.setDate(date.getDate() + 1)) {
			if(!channel.dates.find((x) => x.date.getTime() === date.getTime())) {
				channel.dates.push({ date: new Date(date), count: 0 });
			}
		}
		channel.dates = reduceDates(channel.dates);
	}

	return topChannels;
}

export async function getTopUsersForServer(pgClient, guild, amount, from, toArg) {
	const to = new Date(toArg);
	to.setDate(to.getDate() + 1);

	const topUsers = (await pgClient.query(`
		SELECT CONCAT(CONCAT(users.username, '#'), users.discriminator) as name, users.id as userid, COUNT(*) as count
		FROM public.messages
		INNER JOIN users ON users.id = author
		WHERE messages.guild = $1
		AND "createdTimestamp" >= $3
		AND "createdTimestamp" <= $4
		GROUP BY 1, 2
		ORDER BY 3 DESC
		LIMIT $2
	`, [guild, amount, from.getTime(), to.getTime()])).rows;

	for(const user of topUsers) {
		user.dates = (await pgClient.query(`
			SELECT to_timestamp("createdTimestamp" / 1000)::date as date, COUNT(*) as count
			FROM public.messages
			WHERE messages.guild = $1
			AND messages.author = $2
			AND "createdTimestamp" >= $3
			AND "createdTimestamp" <= $4
			GROUP BY 1
			ORDER BY 1
		`, [guild, user.userid, from.getTime(), to.getTime()])).rows;

		for(const date = new Date(from); date.getTime() < to.getTime(); date.setDate(date.getDate() + 1)) {
			if(!user.dates.find((x) => x.date.getTime() === date.getTime())) {
				user.dates.push({ date: new Date(date), count: 0 });
			}
		}
		user.dates = reduceDates(user.dates);
	}

	return topUsers;
}