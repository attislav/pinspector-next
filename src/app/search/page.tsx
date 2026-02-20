'use client';

import { useState } from 'react';
import { Search, Loader2, ExternalLink, Copy, Check, RefreshCw } from 'lucide-react';
import { Idea } from '@/types/database';

interface ScrapeResult {
  success: boolean;
  idea?: Idea;
  error?: string;
  isNew?: boolean;
  isDuplicate?: boolean;
}

export default function SearchPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: 'Netzwerkfehler beim Scrapen',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRescrape = async () => {
    if (!result?.idea?.id) return;

    setLoading(true);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: result.idea.url, rescrape: true, language: result.idea.language }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: 'Fehler beim erneuten Scrapen',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyAnnotations = () => {
    if (!result?.idea?.top_annotations) return;

    // Strip HTML tags for plain text copy
    const text = result.idea.top_annotations.replace(/<[^>]*>/g, '');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('de-DE').format(num);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Pinterest Ideas Search</h1>
        <p className="text-gray-600">
          Gib eine Pinterest Ideas URL ein, um Daten zu extrahieren und zu speichern.
        </p>
      </div>

      <form onSubmit={handleScrape} className="mb-8">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.pinterest.com/ideas/..."
              className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              disabled={loading}
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          </div>
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="px-6 py-3 bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Lade...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Analysieren
              </>
            )}
          </button>
        </div>
      </form>

      {result && (
        <div className={`p-6 rounded-xl border ${
          result.success
            ? 'bg-white border-gray-200'
            : 'bg-red-50 border-red-200'
        }`}>
          {result.success && result.idea ? (
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">
                    {result.idea.name}
                  </h2>
                  {result.isNew && (
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                      Neu hinzugefügt
                    </span>
                  )}
                  {result.isDuplicate && (
                    <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
                      Bereits vorhanden - aktualisiert
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleRescrape}
                    disabled={loading}
                    className="p-2 text-gray-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    title="Erneut scrapen"
                  >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  <a
                    href={result.idea.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    title="Auf Pinterest öffnen"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="text-sm text-red-600 font-medium">Suchanfragen</div>
                  <div className="text-2xl font-bold text-red-900">
                    {formatNumber(result.idea.searches)}
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600 font-medium">ID</div>
                  <div className="text-lg font-mono text-gray-900 truncate">
                    {result.idea.id}
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg col-span-2">
                  <div className="text-sm text-gray-600 font-medium">Kategorien</div>
                  <div className="text-sm text-gray-900 mt-1">
                    {result.idea.seo_breadcrumbs.length > 0
                      ? result.idea.seo_breadcrumbs.join(' > ')
                      : 'Keine Kategorien'
                    }
                  </div>
                </div>
              </div>

              {result.idea.top_annotations && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">Top Annotations</h3>
                    <button
                      onClick={copyAnnotations}
                      className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4" />
                          Kopiert!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Kopieren
                        </>
                      )}
                    </button>
                  </div>
                  <div
                    className="p-4 bg-gray-50 rounded-lg text-sm text-gray-700 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: result.idea.top_annotations }}
                  />
                </div>
              )}

              {result.idea.related_interests.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Verwandte Interessen ({result.idea.related_interests.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {result.idea.related_interests.slice(0, 20).map((interest, index) => (
                      <a
                        key={index}
                        href={interest.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-gray-100 hover:bg-red-100 text-gray-700 hover:text-red-800 rounded-full text-sm transition-colors"
                      >
                        {interest.name}
                      </a>
                    ))}
                    {result.idea.related_interests.length > 20 && (
                      <span className="px-3 py-1 text-gray-500 text-sm">
                        +{result.idea.related_interests.length - 20} weitere
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-red-700 font-medium">Fehler beim Scrapen</p>
              <p className="text-red-600 text-sm mt-1">{result.error}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium text-gray-900 mb-2">Tipp:</h3>
        <p className="text-sm text-gray-600">
          Du kannst Pinterest Ideas URLs direkt von Pinterest kopieren. Das Format sollte sein:
          <code className="mx-1 px-2 py-0.5 bg-gray-200 rounded text-xs">
            pinterest.com/ideas/name/123456789/
          </code>
        </p>
      </div>
    </div>
  );
}
