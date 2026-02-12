import { Loader2 } from 'lucide-react';
import { CopyDropdown } from './CopyDropdown';

interface AnnotationListProps {
  annotations: { name: string; count: number }[];
  copied: boolean;
  copyMenuOpen: boolean;
  onCopyToggle: () => void;
  onCopy: (asList: boolean) => void;
  onAnnotationClick: (name: string) => void;
  scrapingAnnotation: string | null;
}

export function AnnotationList({
  annotations, copied, copyMenuOpen, onCopyToggle, onCopy,
  onAnnotationClick, scrapingAnnotation,
}: AnnotationListProps) {
  if (annotations.length === 0) return null;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Top Annotations</h2>
        <CopyDropdown
          id="annotations"
          label="Kopieren"
          copied={copied}
          isOpen={copyMenuOpen}
          onToggle={onCopyToggle}
          onCopy={onCopy}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {annotations.map((annotation, index) => (
          <button
            key={index}
            onClick={() => onAnnotationClick(annotation.name)}
            disabled={scrapingAnnotation === annotation.name}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-full text-sm hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            {scrapingAnnotation === annotation.name && (
              <Loader2 className="w-3 h-3 animate-spin" />
            )}
            {annotation.name}
            <span className="text-red-500 text-xs font-medium">({annotation.count})</span>
          </button>
        ))}
      </div>
    </div>
  );
}
