'use client';

import {
  ExternalLink, ImageIcon, FileText, Loader2,
  ArrowUpDown, ArrowUp, ArrowDown,
  Pin as PinIcon, Heart, Repeat2, MessageCircle,
  X, Wand2, Lightbulb, Check, Copy,
} from 'lucide-react';
import { formatNumber, formatPinDate } from '@/lib/format';
import { Pin } from '@/types/database';
import { PinWithPosition } from '@/hooks/useIdeaDetail';

type PinSortKey = 'position' | 'title' | 'save_count' | 'repin_count' | 'comment_count' | 'pin_created_at' | 'reaction_count';

interface PinsTableProps {
  sortedPins: PinWithPosition[];
  totalPins: number;
  pinSortBy: PinSortKey | null;
  pinSortOrder: 'asc' | 'desc';
  onSort: (key: PinSortKey) => void;
  onImageClick: (url: string | null) => void;
  hoveredPin: Pin | null;
  onPinHover: (pin: Pin | null) => void;
  scrapingAnnotation: string | null;
  onAnnotationClick: (name: string) => void;
  // AI features
  ideaName: string;
  analyzingContent: boolean;
  contentAnalysis: string | null;
  onAnalyze: () => void;
  onClearAnalysis: () => void;
  extractingKeywords: boolean;
  extractedKeywords: string[] | null;
  keywordsCopied: boolean;
  onExtract: () => void;
  onCopyKeywords: () => void;
}

function SortIcon({ column, sortBy, sortOrder }: { column: PinSortKey; sortBy: PinSortKey | null; sortOrder: 'asc' | 'desc' }) {
  if (sortBy !== column) return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
  return sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-red-600" /> : <ArrowDown className="w-3 h-3 text-red-600" />;
}

export function PinsTable({
  sortedPins, totalPins, pinSortBy, pinSortOrder, onSort,
  onImageClick, hoveredPin, onPinHover,
  scrapingAnnotation, onAnnotationClick,
  ideaName, analyzingContent, contentAnalysis, onAnalyze, onClearAnalysis,
  extractingKeywords, extractedKeywords, keywordsCopied, onExtract, onCopyKeywords,
}: PinsTableProps) {
  if (sortedPins.length === 0) return null;

  return (
    <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-red-600" />
          Top Pins ({totalPins})
        </h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={onAnalyze} disabled={analyzingContent}
            className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg transition-colors disabled:opacity-50 text-sm">
            {analyzingContent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
            {analyzingContent ? 'Analysiere...' : 'Content analysieren'}
          </button>
          <button onClick={onExtract} disabled={extractingKeywords}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition-colors disabled:opacity-50 text-sm">
            {extractingKeywords ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {extractingKeywords ? 'Extrahiere...' : 'Keywords extrahieren'}
          </button>
        </div>
      </div>

      {/* Content Analysis Result */}
      {contentAnalysis && (
        <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-purple-700 font-medium flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              Content-Strategie für &quot;{ideaName}&quot;
            </span>
            <button onClick={onClearAnalysis} className="text-purple-400 hover:text-purple-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="text-sm text-gray-700 space-y-2">
            {contentAnalysis.split('\n').map((line, idx) => {
              if (line.startsWith('DOMINANTER CONTENT-TYP:') || line.startsWith('WAS RANKT:') || line.startsWith('MEINE EMPFEHLUNG:'))
                return <p key={idx} className="text-purple-800 font-semibold mt-3 mb-1">{line}</p>;
              if (line.startsWith('- ')) return <p key={idx} className="ml-4">• {line.replace('- ', '')}</p>;
              if (line.trim()) return <p key={idx}>{line}</p>;
              return null;
            })}
          </div>
        </div>
      )}

      {/* Extracted Keywords Result */}
      {extractedKeywords && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-green-700 font-medium">{extractedKeywords.length} Keywords extrahiert</span>
            <button onClick={onCopyKeywords} className="flex items-center gap-1 px-2 py-1 text-sm text-green-600 hover:text-green-800 hover:bg-green-100 rounded transition-colors">
              {keywordsCopied ? <><Check className="w-3 h-3" />Kopiert!</> : <><Copy className="w-3 h-3" />Kopieren</>}
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {extractedKeywords.map((kw, idx) => (
              <span key={idx} className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-sm">{kw}</span>
            ))}
          </div>
        </div>
      )}

      {/* Hover Preview Tooltip */}
      {hoveredPin && (
        <div className="fixed z-40 pointer-events-none hidden md:block" style={{
          left: 'min(calc(var(--mouse-x, 50%) + 20px), calc(100vw - 400px))',
          top: 'min(calc(var(--mouse-y, 50%) + 20px), calc(100vh - 500px))'
        }}>
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-3 max-w-[360px]">
            {hoveredPin.image_url && <img src={hoveredPin.image_url} alt={hoveredPin.title || 'Pin'} className="w-full max-h-[400px] object-contain rounded-lg" />}
            {hoveredPin.title && <h3 className="font-semibold text-gray-900 text-sm mt-2 text-center">{hoveredPin.title}</h3>}
          </div>
        </div>
      )}

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-center py-3 px-2"><button onClick={() => onSort('position')} className="flex items-center gap-1 font-semibold text-gray-700 hover:text-red-700" title="Position"># <SortIcon column="position" sortBy={pinSortBy} sortOrder={pinSortOrder} /></button></th>
              <th className="text-left py-3 px-2 font-semibold text-gray-700">Bild</th>
              <th className="text-left py-3 px-2"><button onClick={() => onSort('title')} className="flex items-center gap-1 font-semibold text-gray-700 hover:text-red-700">Titel <SortIcon column="title" sortBy={pinSortBy} sortOrder={pinSortOrder} /></button></th>
              <th className="text-left py-3 px-2 font-semibold text-gray-700">Domain</th>
              <th className="text-left py-3 px-2 font-semibold text-gray-700">Beschreibung</th>
              <th className="text-left py-3 px-2"><button onClick={() => onSort('pin_created_at')} className="flex items-center gap-1 font-semibold text-gray-700 hover:text-red-700 text-xs">Erstellt <SortIcon column="pin_created_at" sortBy={pinSortBy} sortOrder={pinSortOrder} /></button></th>
              <th className="text-left py-3 px-2 font-semibold text-gray-700">Annotations</th>
              <th className="text-right py-3 px-2"><button onClick={() => onSort('save_count')} className="flex items-center gap-1 font-semibold text-gray-700 hover:text-red-700 ml-auto" title="Saves"><PinIcon className="w-4 h-4" /> <SortIcon column="save_count" sortBy={pinSortBy} sortOrder={pinSortOrder} /></button></th>
              <th className="text-right py-3 px-2"><button onClick={() => onSort('reaction_count')} className="flex items-center gap-1 font-semibold text-gray-700 hover:text-red-700 ml-auto" title="Reactions"><Heart className="w-4 h-4" /> <SortIcon column="reaction_count" sortBy={pinSortBy} sortOrder={pinSortOrder} /></button></th>
              <th className="text-right py-3 px-2"><button onClick={() => onSort('repin_count')} className="flex items-center gap-1 font-semibold text-gray-700 hover:text-red-700 ml-auto" title="Repins"><Repeat2 className="w-4 h-4" /> <SortIcon column="repin_count" sortBy={pinSortBy} sortOrder={pinSortOrder} /></button></th>
              <th className="text-right py-3 px-2"><button onClick={() => onSort('comment_count')} className="flex items-center gap-1 font-semibold text-gray-700 hover:text-red-700 ml-auto" title="Kommentare"><MessageCircle className="w-4 h-4" /> <SortIcon column="comment_count" sortBy={pinSortBy} sortOrder={pinSortOrder} /></button></th>
              <th className="text-center py-3 px-2 font-semibold text-gray-700">Links</th>
            </tr>
          </thead>
          <tbody>
            {sortedPins.map((pin) => (
              <tr key={pin.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 px-2 text-center"><span className="inline-flex items-center justify-center w-6 h-6 bg-red-100 text-red-700 rounded-full text-xs font-bold">{pin.originalPosition}</span></td>
                <td className="py-2 px-2">
                  <div className="w-12 h-16 bg-gray-100 rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-red-400 transition-all"
                    onClick={() => onImageClick(pin.image_url)}
                    onMouseEnter={(e) => { onPinHover(pin); document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`); document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`); }}
                    onMouseMove={(e) => { document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`); document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`); }}
                    onMouseLeave={() => onPinHover(null)}>
                    {(pin.image_thumbnail_url || pin.image_url) ? <img src={pin.image_thumbnail_url || pin.image_url || ''} alt={pin.title || 'Pin'} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-4 h-4 text-gray-400" /></div>}
                  </div>
                </td>
                <td className="py-2 px-2 max-w-[180px]"><span className="line-clamp-2 text-gray-900 cursor-help" title={pin.title || ''}>{pin.title || '-'}</span></td>
                <td className="py-2 px-2 text-gray-600 text-xs">{pin.domain || '-'}</td>
                <td className="py-2 px-2 max-w-[200px]"><span className="line-clamp-2 text-gray-600 text-xs cursor-help" title={pin.description || ''}>{pin.description || '-'}</span></td>
                <td className="py-2 px-2 text-gray-500 whitespace-nowrap text-xs">{formatPinDate(pin.pin_created_at)}</td>
                <td className="py-2 px-2">
                  <div className="flex flex-wrap gap-1 max-w-[280px]">
                    {pin.annotations?.map((annotation, idx) => (
                      <button key={idx} onClick={() => onAnnotationClick(annotation)} disabled={scrapingAnnotation === annotation}
                        className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full whitespace-nowrap hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-wait flex items-center gap-1">
                        {scrapingAnnotation === annotation && <Loader2 className="w-2 h-2 animate-spin" />}{annotation}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="py-2 px-2 text-right text-gray-900 font-medium">{formatNumber(pin.save_count)}</td>
                <td className="py-2 px-2 text-right text-gray-900 font-medium">{formatNumber(pin.repin_count)}</td>
                <td className="py-2 px-2 text-right text-gray-900 font-medium">{formatNumber(pin.repin_count)}</td>
                <td className="py-2 px-2 text-right text-gray-900 font-medium">{formatNumber(pin.comment_count)}</td>
                <td className="py-2 px-2">
                  <div className="flex items-center justify-center gap-2">
                    {pin.link && <a href={pin.link} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:text-red-800" title="Pin auf Pinterest öffnen"><ExternalLink className="w-4 h-4" /></a>}
                    {pin.article_url && <a href={pin.article_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800" title="Artikel öffnen"><FileText className="w-4 h-4" /></a>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {sortedPins.map((pin) => (
          <div key={pin.id} className="border border-gray-200 rounded-lg p-3">
            <div className="flex gap-3">
              <div className="w-16 h-20 bg-gray-100 rounded overflow-hidden flex-shrink-0 cursor-pointer"
                onClick={() => onImageClick(pin.image_url)}>
                {(pin.image_thumbnail_url || pin.image_url) ? <img src={pin.image_thumbnail_url || pin.image_url || ''} alt={pin.title || 'Pin'} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-4 h-4 text-gray-400" /></div>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 bg-red-100 text-red-700 rounded-full text-xs font-bold">{pin.originalPosition}</span>
                  <div className="flex gap-1.5">
                    {pin.link && <a href={pin.link} target="_blank" rel="noopener noreferrer" className="text-red-600"><ExternalLink className="w-4 h-4" /></a>}
                    {pin.article_url && <a href={pin.article_url} target="_blank" rel="noopener noreferrer" className="text-blue-600"><FileText className="w-4 h-4" /></a>}
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-900 line-clamp-2 mt-1">{pin.title || '-'}</p>
                {pin.domain && <p className="text-xs text-gray-500 mt-0.5">{pin.domain}</p>}
              </div>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
              <span className="flex items-center gap-1"><PinIcon className="w-3 h-3" />{formatNumber(pin.save_count)}</span>
              <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{formatNumber(pin.repin_count)}</span>
              <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{formatNumber(pin.comment_count)}</span>
              <span>{formatPinDate(pin.pin_created_at)}</span>
            </div>
            {pin.annotations && pin.annotations.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {pin.annotations.slice(0, 5).map((annotation, idx) => (
                  <button key={idx} onClick={() => onAnnotationClick(annotation)} disabled={scrapingAnnotation === annotation}
                    className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full hover:bg-red-200 disabled:opacity-50 flex items-center gap-1">
                    {scrapingAnnotation === annotation && <Loader2 className="w-2 h-2 animate-spin" />}{annotation}
                  </button>
                ))}
                {pin.annotations.length > 5 && <span className="text-xs text-gray-400">+{pin.annotations.length - 5}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
