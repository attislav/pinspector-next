'use client';

import { useState } from 'react';
import { Search, Loader2, ExternalLink, Plus, Check, X } from 'lucide-react';

interface FoundUrl {
  url: string;
  scraped: boolean;
  error?: string;
  loading?: boolean;
}

export default function FindPage() {
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [foundUrls, setFoundUrls] = useState<FoundUrl[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;

    setLoading(true);
    setError(null);
    setFoundUrls([]);

    try {
      const response = await fetch('/api/find-interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: keyword.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Fehler bei der Suche');
        return;
      }

      setFoundUrls(data.urls.map((url: string) => ({ url, scraped: false })));
    } catch (err) {
      setError('Netzwerkfehler bei der Suche');
    } finally {
      setLoading(false);
    }
  };

  const handleScrape = async (index: number) => {
    const urlObj = foundUrls[index];
    if (urlObj.scraped || urlObj.loading) return;

    setFoundUrls(prev => prev.map((u, i) =>
      i === index ? { ...u, loading: true } : u
    ));

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlObj.url }),
      });

      const data = await response.json();

      setFoundUrls(prev => prev.map((u, i) =>
        i === index ? {
          ...u,
          loading: false,
          scraped: data.success,
          error: data.success ? undefined : data.error,
        } : u
      ));
    } catch (err) {
      setFoundUrls(prev => prev.map((u, i) =>
        i === index ? { ...u, loading: false, error: 'Netzwerkfehler' } : u
      ));
    }
  };

  const handleScrapeAll = async () => {
    const unscraped = foundUrls.filter(u => !u.scraped && !u.loading);
    if (unscraped.length === 0) return;

    // Scrape in batches of 3
    for (let i = 0; i < foundUrls.length; i++) {
      if (!foundUrls[i].scraped && !foundUrls[i].loading) {
        await handleScrape(i);
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  };

  const scrapedCount = foundUrls.filter(u => u.scraped).length;
  const errorCount = foundUrls.filter(u => u.error).length;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Neue Interests finden</h1>
        <p className="text-gray-600">
          Suche nach Pinterest Ideas zu einem Keyword über Google und scrape sie automatisch.
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Keyword eingeben (z.B. 'garten ideen')"
              className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              disabled={loading}
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          </div>
          <button
            type="submit"
            disabled={loading || !keyword.trim()}
            className="px-6 py-3 bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Suche...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Suchen
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {foundUrls.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-gray-600">
              {foundUrls.length} URLs gefunden
              {scrapedCount > 0 && (
                <span className="ml-2 text-green-600">
                  ({scrapedCount} gescraped)
                </span>
              )}
              {errorCount > 0 && (
                <span className="ml-2 text-red-600">
                  ({errorCount} Fehler)
                </span>
              )}
            </div>
            <button
              onClick={handleScrapeAll}
              disabled={scrapedCount === foundUrls.length}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-4 h-4" />
              Alle scrapen
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y">
            {foundUrls.map((urlObj, index) => (
              <div
                key={index}
                className="p-4 flex items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <a
                    href={urlObj.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-700 hover:text-red-900 hover:underline flex items-center gap-2 truncate"
                  >
                    <ExternalLink className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{urlObj.url}</span>
                  </a>
                  {urlObj.error && (
                    <p className="text-red-600 text-sm mt-1">{urlObj.error}</p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {urlObj.scraped ? (
                    <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                      <Check className="w-4 h-4" />
                      Gespeichert
                    </span>
                  ) : urlObj.error ? (
                    <span className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                      <X className="w-4 h-4" />
                      Fehler
                    </span>
                  ) : (
                    <button
                      onClick={() => handleScrape(index)}
                      disabled={urlObj.loading}
                      className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded-full text-sm transition-colors disabled:opacity-50"
                    >
                      {urlObj.loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Laden...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Scrapen
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium text-gray-900 mb-2">Hinweis:</h3>
        <p className="text-sm text-gray-600">
          Die Suche verwendet DuckDuckGo, um Pinterest Ideas URLs zu finden.
          Kein API-Key erforderlich. Bei zu vielen Anfragen kann ein Rate-Limit greifen.
        </p>
      </div>
    </div>
  );
}
