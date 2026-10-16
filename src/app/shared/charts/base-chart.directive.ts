import { Chart, registerables } from 'chart.js';
import { Flow, SankeyController } from 'chartjs-chart-sankey';
import { BaseChartDirective } from 'ng2-charts';

Chart.register(...registerables, SankeyController, Flow);

export { BaseChartDirective };
