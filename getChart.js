import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

import { getDateFromDateTime } from './helpers.js';

export async function getChart(type, labels, datasets) {
	let height = 500;
	let widthFactor = 10;
	if (type === 'line') {
		height = 300;
		widthFactor = 4;
	}

	const chartJSNodeCanvas = new ChartJSNodeCanvas({
		width: 400 + labels.length * widthFactor,
		height: height,
		backgroundColour: 'white'
	});

	const configuration = {
		type,
		data: {
			labels,
			datasets
		}
	};

	return await chartJSNodeCanvas.renderToBuffer(configuration);
}

export const colors = ['#1abc9c', '#f1c40f', '#130f40', '#e67e22', '#3498db', '#e74c3c', '#9b59b6', '#34495e', '#95a5a6', '#e84393'];

export function getBarChart(top10) {
	return getChart(
		'bar',
		top10[0].dates.map((x) => getDateFromDateTime(x.date)),
		top10.map((item, index) => ({
			label: item.name,
			borderColor: colors[index],
			backgroundColor: colors[index],
			data: item.dates.map((x) => x.count),
		}))
	);
}