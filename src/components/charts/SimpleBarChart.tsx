import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface Props {
  labels: string[];
  values: number[];
  title?: string;
}

export function SimpleBarChart({ labels, values, title }: Props) {
  return (
    <Bar
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
            backgroundColor: '#2f70ff'
          }
        ]
      }}
    />
  );
}
