import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface Props {
  labels: string[];
  values: number[];
  title?: string;
}

export function SimpleLineChart({ labels, values, title }: Props) {
  return (
    <Line
      options={{
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: Boolean(title), text: title }
        }
      }}
      data={{
        labels,
        datasets: [
          {
            label: title ?? 'Valor',
            data: values,
            borderColor: '#1f58d6',
            backgroundColor: 'rgba(47,112,255,0.2)',
            tension: 0.3,
            fill: true
          }
        ]
      }}
    />
  );
}

