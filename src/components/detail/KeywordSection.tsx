import { Loader2 } from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import { CopyDropdown } from './CopyDropdown';

interface KeywordSectionProps {
  title: string;
  icon: LucideIcon;
  items: { name: string; url: string; id?: string }[];
  copyId: string;
  copied: boolean;
  copyMenuOpen: boolean;
  onCopyToggle: () => void;
  onCopy: (asList: boolean) => void;
  onItemClick: (url: string) => void;
  scrapingUrl: string | null;
  existingIds?: Set<string>;
  existingNames?: Set<string>;
}

function extractIdFromUrl(url: string): string | null {
  const match = url?.match(/\/ideas\/[^/]+\/(\d+)/);
  return match ? match[1] : null;
}

export function KeywordSection({
  title, icon: Icon, items, copyId, copied, copyMenuOpen,
  onCopyToggle, onCopy, onItemClick, scrapingUrl, existingIds, existingNames,
}: KeywordSectionProps) {
  if (!items || items.length === 0) return null;

  const existsCount = (existingIds || existingNames) ? items.filter(item => {
    const itemId = item.id || extractIdFromUrl(item.url);
    if (itemId && existingIds?.has(itemId)) return true;
    if (existingNames?.has(item.name.toLowerCase())) return true;
    return false;
  }).length : 0;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Icon className="w-5 h-5 text-red-600" />
          {title} ({items.length})
          {existingIds && existingIds.size > 0 && (
            <span className="text-xs font-normal text-green-600">{existsCount} in DB</span>
          )}
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
        {items.map((item, index) => {
          const itemId = item.id || extractIdFromUrl(item.url);
          const exists = (itemId && existingIds?.has(itemId)) || existingNames?.has(item.name.toLowerCase());
          return (
            <button
              key={index}
              onClick={() => onItemClick(item.url)}
              disabled={scrapingUrl === item.url}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors disabled:opacity-50 disabled:cursor-wait flex items-center gap-1 ${
                exists
                  ? 'bg-green-100 hover:bg-green-200 text-green-800 hover:text-green-900'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800'
              }`}
            >
              {scrapingUrl === item.url && (
                <Loader2 className="w-3 h-3 animate-spin" />
              )}
              {item.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
