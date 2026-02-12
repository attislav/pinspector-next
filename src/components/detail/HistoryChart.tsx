import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { formatNumber, formatShortDate, formatDate } from '@/lib/format';
import { IdeaHistory } from '@/types/database';

interface HistoryChartProps {
  history: IdeaHistory[];
}

export function HistoryChart({ history }: HistoryChartProps) {
  const chartData = history.map((h) => ({
    date: formatShortDate(h.scrape_date),
    fullDate: formatDate(h.scrape_date),
    searches: h.searches,
  }));

  if (chartData.length <= 1) return null;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Suchvolumen-Entwicklung
      </h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={{ stroke: '#e5e7eb' }} />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={{ stroke: '#e5e7eb' }} tickFormatter={(value) => formatNumber(value)} />
            <Tooltip
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              formatter={(value: number) => [formatNumber(value), 'Suchanfragen']}
              labelFormatter={(label, payload) => {
                if (payload && payload[0]) return payload[0].payload.fullDate;
                return label;
              }}
            />
            <Line type="monotone" dataKey="searches" stroke="#7c3aed" strokeWidth={2} dot={{ fill: '#7c3aed', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: '#7c3aed' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
