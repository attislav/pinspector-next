import { Copy, Check, ChevronDown } from 'lucide-react';

interface CopyDropdownProps {
  id: string;
  label: string;
  copied: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onCopy: (asList: boolean) => void;
  variant?: 'default' | 'green';
}

export function CopyDropdown({ label, copied, isOpen, onToggle, onCopy, variant = 'default' }: CopyDropdownProps) {
  const baseClass = variant === 'green'
    ? 'bg-green-100 text-green-700 hover:bg-green-200'
    : 'text-gray-600 hover:text-red-700 hover:bg-red-50';

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${baseClass}`}
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" />
            Kopiert!
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            {label}
            <ChevronDown className="w-3 h-3" />
          </>
        )}
      </button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[160px]">
          <button
            onClick={() => onCopy(false)}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 rounded-t-lg"
          >
            Kommagetrennt
          </button>
          <button
            onClick={() => onCopy(true)}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 rounded-b-lg"
          >
            Als Liste
          </button>
        </div>
      )}
    </div>
  );
}
