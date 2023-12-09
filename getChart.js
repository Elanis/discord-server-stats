import ChartJSImage from 'chart.js-image';

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