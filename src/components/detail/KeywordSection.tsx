import { Loader2 } from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import { CopyDropdown } from './CopyDropdown';

interface KeywordSectionProps {
  title: string;
  icon: LucideIcon;
  items: { name: string; url: string }[];
  copyId: string;
  copied: boolean;
  copyMenuOpen: boolean;
  onCopyToggle: () => void;
  onCopy: (asList: boolean) => void;
  onItemClick: (url: string) => void;
  scrapingUrl: string | null;
  colorClass: string;
}

export function KeywordSection({
  title, icon: Icon, items, copyId, copied, copyMenuOpen,
  onCopyToggle, onCopy, onItemClick, scrapingUrl, colorClass,
}: KeywordSectionProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Icon className="w-5 h-5 text-red-600" />
          {title} ({items.length})
        </h2>
        <CopyDropdown
          id={copyId}
          label="Kopieren"
          copied={copied}
          isOpen={copyMenuOpen}
          onToggle={onCopyToggle}
          onCopy={onCopy}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item, index) => (
          <button
            key={index}
            onClick={() => onItemClick(item.url)}
            disabled={scrapingUrl === item.url}
            className={`px-3 py-1.5 ${colorClass} rounded-full text-sm transition-colors disabled:opacity-50 disabled:cursor-wait flex items-center gap-1`}
          >
            {scrapingUrl === item.url && (
              <Loader2 className="w-3 h-3 animate-spin" />
            )}
            {item.name}
          </button>
        ))}
      </div>
    </div>
  );
}
