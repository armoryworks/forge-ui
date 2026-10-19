import { Chart, registerables } from 'chart.js';
import { Flow, SankeyController } from 'chartjs-chart-sankey';
import { BaseChartDirective } from 'ng2-charts';

import { watchChartTheme } from './chart-theme';

Chart.register(...registerables, SankeyController, Flow);
watchChartTheme();

export { BaseChartDirective };
