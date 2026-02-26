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
  existingNames?: Set<string>;
}

export function AnnotationList({
  annotations, copied, copyMenuOpen, onCopyToggle, onCopy,
  onAnnotationClick, scrapingAnnotation, existingNames,
}: AnnotationListProps) {
  if (annotations.length === 0) return null;

  const existsCount = existingNames ? annotations.filter(a => existingNames.has(a.name.toLowerCase())).length : 0;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          Top Annotations
          {existingNames && existingNames.size > 0 && (
            <span className="text-xs font-normal text-green-600">{existsCount} in DB</span>
          )}
        </h2>
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
        {annotations.map((annotation, index) => {
          const exists = existingNames?.has(annotation.name.toLowerCase());
          return (
            <button
              key={index}
              onClick={() => onAnnotationClick(annotation.name)}
              disabled={scrapingAnnotation === annotation.name}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors disabled:opacity-50 disabled:cursor-wait ${
                exists
                  ? 'bg-green-100 hover:bg-green-200 text-green-800'
                  : 'bg-red-50 hover:bg-red-100 text-red-700'
              }`}
            >
              {scrapingAnnotation === annotation.name && (
                <Loader2 className="w-3 h-3 animate-spin" />
              )}
              {annotation.name}
              <span className={`text-xs font-medium ${exists ? 'text-green-600' : 'text-red-500'}`}>({annotation.count})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
