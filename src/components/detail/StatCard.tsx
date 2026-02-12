import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  highlight?: boolean;
}

export function StatCard({ icon: Icon, label, value, highlight }: StatCardProps) {
  return (
    <div className={`p-4 rounded-xl ${highlight ? 'bg-red-50' : 'bg-gray-50'}`}>
      <div className={`flex items-center gap-2 text-sm font-medium mb-1 ${highlight ? 'text-red-600' : 'text-gray-600'}`}>
        <Icon className="w-4 h-4" />
        {label}
      </div>
      <div className={`${typeof value === 'number' || String(value).length <= 10 ? 'text-2xl font-bold' : 'text-sm font-medium'} ${highlight ? 'text-red-900' : 'text-gray-900'}`}>
        {value}
      </div>
    </div>
  );
}
