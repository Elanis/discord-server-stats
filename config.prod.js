export const guilds = JSON.parse(process.env.SERVER_LIST); // "{\"Name\":\"SNOWFLAKE\"}"

export const botToken = process.env.DISCORD_TOKEN;
export const minDate = new Date(2015, 0, 1);

export const connectionString = {
	user: process.env.PG_USER,
	host: process.env.PG_HOST,
	database: process.env.PG_DB,
	password: process.env.PG_PASSWORD,
	port: 5432,
};
