import ChartJSImage from 'chart.js-image';

import { getDateFromDateTime } from './helpers.js';

export function getChart(type, labels, datasets) {
	let height = 500;
	let widthFactor = 10;
	if(type === 'line') {
		height = 300;
		widthFactor = 4;
	}

	return ChartJSImage().chart({
		type,
		data: {
			labels,
			datasets
		},
		options: {
			title: {
				display: false,
				text: "Messages per day"
			},
			scales: {
				xAxes: [
					{
						scaleLabel: {
							display: false,
							labelString: "Day"
						}
					}
				],
				yAxes: [
					{
						scaleLabel: {
							display: true,
							labelString: "Messages"
						}
					}
				]
			}
		}
	}) // Line chart
	.backgroundColor('white')
	.width(400 + labels.length * widthFactor)
	.height(height);
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