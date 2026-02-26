'use client';

import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, ExternalLink, RefreshCw, TrendingUp, Calendar, Hash, Tag,
  Sparkles, Link2, Loader2, X,
} from 'lucide-react';
import { useIdeaDetail } from '@/hooks/useIdeaDetail';
import { formatNumber, formatDate } from '@/lib/format';
import { StatCard } from '@/components/detail/StatCard';
import { CopyDropdown } from '@/components/detail/CopyDropdown';
import { HistoryChart } from '@/components/detail/HistoryChart';
import { KeywordSection } from '@/components/detail/KeywordSection';
import { AnnotationList } from '@/components/detail/AnnotationList';
import { PinsTable } from '@/components/detail/PinsTable';

export default function IdeaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const detail = useIdeaDetail(id);

  if (detail.loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  if (detail.error || !detail.idea) {
    return (
      <div className="max-w-7xl mx-auto">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-600 hover:text-red-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Zurück
        </button>
        <div className="p-8 bg-red-50 rounded-xl text-center">
          <p className="text-red-700 font-medium">{detail.error || 'Idea nicht gefunden'}</p>
        </div>
      </div>
    );
  }

  const { idea } = detail;
  const parsedAnnotations = idea.top_annotations ? detail.parseAnnotations(idea.top_annotations) : [];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-600 hover:text-red-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Zurück zur Übersicht
        </button>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl md:text-3xl font-bold text-red-900">{idea.name}</h1>
              {idea.language && <span className="px-2 py-1 text-xs font-bold bg-gray-100 text-gray-600 rounded uppercase">{idea.language}</span>}
            </div>
            <p className="text-gray-500 font-mono text-sm">ID: {idea.id}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <CopyDropdown id="allKws" label="KWs Kopieren" copied={detail.allKwsCopied}
              isOpen={detail.copyMenuOpen === 'allKws'}
              onToggle={() => detail.setCopyMenuOpen(detail.copyMenuOpen === 'allKws' ? null : 'allKws')}
              onCopy={detail.copyAllKeywords} variant="green" />
            <button onClick={detail.scrapeAllAnnotations} disabled={detail.scrapingAllAnnotations || detail.rescraping}
              className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50 text-sm">
              {detail.scrapingAllAnnotations ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Scrape Annotations
            </button>
            <button onClick={detail.handleRescrape} disabled={detail.rescraping || detail.scrapingAllAnnotations}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 text-sm">
              <RefreshCw className={`w-4 h-4 ${detail.rescraping ? 'animate-spin' : ''}`} />
              {detail.rescraping ? 'Lädt...' : 'Neu scrapen'}
            </button>
            <a href={idea.url || '#'} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors text-sm">
              <ExternalLink className="w-4 h-4" /> Auf Pinterest öffnen
            </a>
          </div>
        </div>
      </div>

      {/* Scrape Annotations Progress */}
      {detail.scrapingAllAnnotations && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-blue-700 font-medium flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Scrape Annotations...
            </span>
            <span className="text-blue-600 text-sm">{detail.annotationProgress.current} / {detail.annotationProgress.total}</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${(detail.annotationProgress.current / detail.annotationProgress.total) * 100}%` }} />
          </div>
          <div className="flex justify-between text-sm">
            {detail.annotationProgress.currentName && <p className="text-blue-600 truncate flex-1 mr-4">Aktuell: {detail.annotationProgress.currentName}</p>}
            <p className="text-blue-600">
              <span className="text-green-600">{detail.annotationProgress.success} OK</span>
              {detail.annotationProgress.failed > 0 && <span className="text-red-600 ml-2">{detail.annotationProgress.failed} Fehler</span>}
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={TrendingUp} label="Suchvolumen" value={formatNumber(idea.searches)} highlight />
        <StatCard icon={Calendar} label="Last Update" value={idea.last_update ? formatDate(idea.last_update) : '-'} />
        <StatCard icon={RefreshCw} label="Last Scrape" value={formatDate(idea.last_scrape)} />
        <StatCard icon={Hash} label="History-Einträge" value={detail.history.length} />
      </div>

      {/* History Chart */}
      <HistoryChart history={detail.history} />

      {/* SEO Kategorien */}
      {idea.seo_breadcrumbs && idea.seo_breadcrumbs.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Tag className="w-5 h-5 text-red-600" /> SEO Kategorien
          </h2>
          <div className="flex items-center gap-2 text-gray-700 flex-wrap">
            {idea.seo_breadcrumbs.map((crumb: string | { name: string }, index: number) => {
              const crumbName = typeof crumb === 'string' ? crumb : crumb.name;
              return (
                <span key={index} className="flex items-center gap-2">
                  {index > 0 && <span className="text-gray-400">›</span>}
                  <span className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm">{crumbName}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* KLP Pivots */}
      <KeywordSection
        title="Keyword Pivots" icon={Sparkles}
        items={idea.klp_pivots || []} copyId="klp"
        copied={detail.klpPivotsCopied}
        copyMenuOpen={detail.copyMenuOpen === 'klp'}
        onCopyToggle={() => detail.setCopyMenuOpen(detail.copyMenuOpen === 'klp' ? null : 'klp')}
        onCopy={detail.copyKlpPivots}
        onItemClick={detail.scrapeAndNavigate}
        scrapingUrl={detail.scrapingUrl}
        existingIds={detail.existingIds}
        existingNames={detail.existingNames}
      />

      {/* Verwandte Interessen */}
      <KeywordSection
        title="Verwandte Interessen" icon={Link2}
        items={idea.related_interests || []} copyId="related"
        copied={detail.relatedInterestsCopied}
        copyMenuOpen={detail.copyMenuOpen === 'related'}
        onCopyToggle={() => detail.setCopyMenuOpen(detail.copyMenuOpen === 'related' ? null : 'related')}
        onCopy={detail.copyRelatedInterests}
        onItemClick={detail.scrapeAndNavigate}
        scrapingUrl={detail.scrapingUrl}
        existingIds={detail.existingIds}
        existingNames={detail.existingNames}
      />

      {/* Top Annotations */}
      <AnnotationList
        annotations={parsedAnnotations}
        copied={detail.copied}
        copyMenuOpen={detail.copyMenuOpen === 'annotations'}
        onCopyToggle={() => detail.setCopyMenuOpen(detail.copyMenuOpen === 'annotations' ? null : 'annotations')}
        onCopy={detail.copyAnnotations}
        onAnnotationClick={detail.scrapeAnnotation}
        scrapingAnnotation={detail.scrapingAnnotation}
        existingNames={detail.existingNames}
      />

      {/* Image Enlargement Modal */}
      {detail.enlargedImage && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => detail.setEnlargedImage(null)}>
          <button className="absolute top-4 right-4 text-white hover:text-gray-300" onClick={() => detail.setEnlargedImage(null)}>
            <X className="w-8 h-8" />
          </button>
          <img src={detail.enlargedImage} alt="Enlarged pin" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
        </div>
      )}

      {/* Pins Table */}
      <PinsTable
        sortedPins={detail.sortedPins}
        totalPins={detail.pins.length}
        pinSortBy={detail.pinSortBy}
        pinSortOrder={detail.pinSortOrder}
        onSort={detail.handlePinSort}
        onImageClick={(url) => detail.setEnlargedImage(url)}
        hoveredPin={detail.hoveredPin}
        onPinHover={detail.setHoveredPin}
        scrapingAnnotation={detail.scrapingAnnotation}
        onAnnotationClick={detail.scrapeAnnotation}
        ideaName={idea.name}
        analyzingContent={detail.analyzingContent}
        contentAnalysis={detail.contentAnalysis}
        onAnalyze={detail.analyzeContentStrategy}
        onClearAnalysis={() => detail.setContentAnalysis(null)}
        extractingKeywords={detail.extractingKeywords}
        extractedKeywords={detail.extractedKeywords}
        keywordsCopied={detail.keywordsCopied}
        onExtract={detail.extractKeywordsFromTitles}
        onCopyKeywords={detail.copyExtractedKeywords}
        existingNames={detail.existingNames}
      />

      {/* History Table */}
      {detail.history.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Suchvolumen-Historie</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Datum</th>
                  <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">Suchvolumen</th>
                  <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">Änderung</th>
                </tr>
              </thead>
              <tbody>
                {detail.history.slice().reverse().map((h, index, arr) => {
                  const prevSearches = index < arr.length - 1 ? arr[index + 1].searches : h.searches;
                  const change = h.searches - prevSearches;
                  return (
                    <tr key={h.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 text-sm text-gray-600">{formatDate(h.scrape_date)}</td>
                      <td className="py-2 px-3 text-sm text-right font-medium text-gray-900">{formatNumber(h.searches)}</td>
                      <td className={`py-2 px-3 text-sm text-right font-medium ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {change > 0 ? '+' : ''}{formatNumber(change)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
