'use client';

import { useState } from 'react';
import { Sparkles, Loader2, Search, ChevronDown, ChevronUp, ExternalLink, Database } from 'lucide-react';
import Link from 'next/link';
import { formatNumber } from '@/lib/format';

interface TopicResult {
  topic: string;
  urlsFound: number;
}

interface ScrapedIdea {
  id: string;
  name: string;
  searches: number;
  fromTopic: string;
}

interface KeywordEntry {
  name: string;
  count: number;
  source: 'annotation' | 'klp_pivot' | 'related_interest';
}

interface DiscoverResult {
  success: boolean;
  topic: string;
  subTopics: TopicResult[];
  totalUrlsFound: number;
  urlsScraped: number;
  scrapedIdeas: ScrapedIdea[];
  keywords: KeywordEntry[];
}

const SOURCE_LABELS: Record<string, string> = {
  annotation: 'Annotation',
  klp_pivot: 'KLP Pivot',
  related_interest: 'Related Interest',
};

const SOURCE_COLORS: Record<string, string> = {
  annotation: 'bg-blue-100 text-blue-700',
  klp_pivot: 'bg-purple-100 text-purple-700',
  related_interest: 'bg-green-100 text-green-700',
};

export default function DiscoverPage() {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiscoverResult | null>(null);
  const [deepScan, setDeepScan] = useState(false);
  const [showTopics, setShowTopics] = useState(true);
  const [showIdeas, setShowIdeas] = useState(true);
  const [showKeywords, setShowKeywords] = useState(true);

  const handleDiscover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/discover-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          urlsPerTopic: 5,
          scrapePerTopic: 3,
          deepScan,
          skipExisting: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Fehler bei der Suche');
        return;
      }

      setResult(data);
    } catch (err) {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Topical Map entdecken</h1>
        <p className="text-gray-600">
          Gib ein Thema ein. Die KI generiert relevante Sub-Topics, sucht dazu Pinterest Ideas und baut eine Keyword-Map.
        </p>
      </div>

      <form onSubmit={handleDiscover} className="mb-8">
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Thema eingeben (z.B. 'Frühlingsdekoration')"
                className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                disabled={loading}
              />
              <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            <button
              type="submit"
              disabled={loading || !topic.trim()}
              className="px-6 py-3 bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analysiere...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Entdecken
                </>
              )}
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={deepScan}
              onChange={(e) => setDeepScan(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
              disabled={loading}
            />
            <span>
              <strong>Deep Scan:</strong> Zusätzlich Annotations, KLP Pivots und Related Interests von jeder gescrapten Seite sammeln
            </span>
          </label>
        </div>
      </form>

      {loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-red-600 mx-auto mb-4" />
          <p className="text-gray-700 font-medium">Topical Map wird erstellt...</p>
          <p className="text-gray-500 text-sm mt-1">
            KI generiert Sub-Topics, sucht Pinterest Ideas und scrapt die Ergebnisse. Das kann 1-2 Minuten dauern.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{result.subTopics.length}</p>
              <p className="text-sm text-gray-500">Sub-Topics</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{result.totalUrlsFound}</p>
              <p className="text-sm text-gray-500">URLs gefunden</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{result.urlsScraped}</p>
              <p className="text-sm text-gray-500">Ideas gescrapt</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{result.keywords.length}</p>
              <p className="text-sm text-gray-500">Keywords</p>
            </div>
          </div>

          {/* Sub-Topics */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <button
              onClick={() => setShowTopics(!showTopics)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <h2 className="text-lg font-semibold text-gray-900">
                KI-generierte Sub-Topics ({result.subTopics.length})
              </h2>
              {showTopics ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>
            {showTopics && (
              <div className="px-4 pb-4">
                <div className="flex flex-wrap gap-2">
                  {result.subTopics.map((t, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${
                        t.urlsFound > 0
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-gray-50 text-gray-500 border border-gray-200'
                      }`}
                    >
                      <Search className="w-3 h-3" />
                      {t.topic}
                      {t.urlsFound > 0 && (
                        <span className="text-xs bg-green-200 text-green-800 px-1.5 py-0.5 rounded-full">
                          {t.urlsFound}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Scraped Ideas */}
          {result.scrapedIdeas.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <button
                onClick={() => setShowIdeas(!showIdeas)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <h2 className="text-lg font-semibold text-gray-900">
                  Gefundene Ideas ({result.scrapedIdeas.length})
                </h2>
                {showIdeas ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </button>
              {showIdeas && (
                <div className="divide-y">
                  {result.scrapedIdeas.map((idea) => (
                    <div key={idea.id} className="px-4 py-3 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/interests/${idea.id}`}
                          className="text-gray-900 font-medium hover:text-red-700 hover:underline flex items-center gap-2"
                        >
                          <Database className="w-4 h-4 flex-shrink-0 text-gray-400" />
                          <span className="truncate">{idea.name}</span>
                        </Link>
                        <p className="text-xs text-gray-500 mt-0.5 ml-6">
                          via &quot;{idea.fromTopic}&quot;
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-sm text-gray-600">
                          {formatNumber(idea.searches)} Suchen
                        </span>
                        <Link
                          href={`/interests/${idea.id}`}
                          className="text-red-600 hover:text-red-800"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Keywords (Deep Scan) */}
          {result.keywords.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <button
                onClick={() => setShowKeywords(!showKeywords)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <h2 className="text-lg font-semibold text-gray-900">
                  Keyword-Map ({result.keywords.length})
                </h2>
                {showKeywords ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </button>
              {showKeywords && (
                <div className="px-4 pb-4">
                  <div className="flex flex-wrap gap-2">
                    {result.keywords.map((kw, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${SOURCE_COLORS[kw.source]}`}
                      >
                        {kw.name}
                        {kw.count > 1 && (
                          <span className="text-xs opacity-70">x{kw.count}</span>
                        )}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-4 mt-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-blue-200" /> Annotation
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-purple-200" /> KLP Pivot
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-green-200" /> Related Interest
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
