'use client';

import { useState, useRef, useCallback } from 'react';
import { Sparkles, Loader2, Search, ChevronDown, ChevronUp, ExternalLink, Database, Check, X, AlertCircle, ArrowRight, Star } from 'lucide-react';
import Link from 'next/link';
import { formatNumber } from '@/lib/format';

type StepStatus = 'idle' | 'running' | 'done' | 'error';

interface SubTopic {
  name: string;
  status: StepStatus;
  urls: FoundUrl[];
}

interface FoundUrl {
  url: string;
  title: string;
  breadcrumb: string | null;
  status: 'pending' | 'scraping' | 'done' | 'error' | 'skipped';
  idea?: ScrapedIdea;
  error?: string;
}

interface ScrapedIdea {
  id: string;
  name: string;
  searches: number;
  keywords: KeywordEntry[];
}

interface KeywordEntry {
  name: string;
  count: number;
  source: 'annotation' | 'klp_pivot' | 'related_interest';
}

interface Pillar {
  name: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  keywords: string[];
}

interface TopicalMap {
  summary: string;
  pillars: Pillar[];
  topRecommendation: string;
}

const SOURCE_COLORS: Record<string, string> = {
  annotation: 'bg-blue-100 text-blue-700',
  klp_pivot: 'bg-purple-100 text-purple-700',
  related_interest: 'bg-green-100 text-green-700',
};

const PRIORITY_STYLES: Record<string, { border: string; badge: string; badgeText: string }> = {
  high: { border: 'border-red-300', badge: 'bg-red-100 text-red-700', badgeText: 'Hoch' },
  medium: { border: 'border-yellow-300', badge: 'bg-yellow-100 text-yellow-700', badgeText: 'Mittel' },
  low: { border: 'border-gray-300', badge: 'bg-gray-100 text-gray-600', badgeText: 'Nische' },
};

export default function DiscoverPage() {
  const [topic, setTopic] = useState('');
  const [deepScan, setDeepScan] = useState(false);
  const [step, setStep] = useState<'idle' | 'topics' | 'searching' | 'scraping' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [subTopics, setSubTopics] = useState<SubTopic[]>([]);
  const [currentAction, setCurrentAction] = useState('');
  const [topicalMap, setTopicalMap] = useState<TopicalMap | null>(null);
  const [showTopics, setShowTopics] = useState(false);
  const [showIdeas, setShowIdeas] = useState(false);
  const [showKeywords, setShowKeywords] = useState(false);
  const abortRef = useRef(false);

  const allIdeas = subTopics.flatMap(st =>
    st.urls.filter(u => u.idea).map(u => ({ ...u.idea!, fromTopic: st.name }))
  );

  const allKeywords = (() => {
    const map = new Map<string, { count: number; source: string }>();
    for (const idea of allIdeas) {
      for (const kw of idea.keywords) {
        const existing = map.get(kw.name);
        if (existing) {
          existing.count += kw.count;
        } else {
          map.set(kw.name, { count: kw.count, source: kw.source });
        }
      }
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, count: data.count, source: data.source }))
      .sort((a, b) => b.count - a.count);
  })();

  const totalUrlsFound = subTopics.reduce((sum, st) => sum + st.urls.length, 0);
  const totalScraped = allIdeas.length;

  const handleDiscover = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    abortRef.current = false;
    setError(null);
    setSubTopics([]);
    setTopicalMap(null);

    // Step 1: Generate sub-topics
    setStep('topics');
    setCurrentAction('KI generiert Sub-Topics...');

    let topics: string[];
    try {
      const res = await fetch('/api/discover-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Fehler bei der KI-Analyse');
        setStep('idle');
        return;
      }
      topics = data.subTopics;
    } catch {
      setError('Netzwerkfehler bei der KI-Analyse');
      setStep('idle');
      return;
    }

    if (topics.length === 0) {
      setError('KI konnte keine Sub-Topics generieren');
      setStep('idle');
      return;
    }

    const initialTopics: SubTopic[] = topics.map(name => ({ name, status: 'idle', urls: [] }));
    setSubTopics(initialTopics);

    // Step 2: Search for each sub-topic
    setStep('searching');
    const seenUrls = new Set<string>();

    for (let i = 0; i < initialTopics.length; i++) {
      if (abortRef.current) break;

      setCurrentAction(`Suche "${initialTopics[i].name}" (${i + 1}/${initialTopics.length})...`);

      setSubTopics(prev => prev.map((st, idx) =>
        idx === i ? { ...st, status: 'running' } : st
      ));

      try {
        const res = await fetch('/api/find-interests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: initialTopics[i].name, limit: 5 }),
        });
        const data = await res.json();

        if (res.ok && data.urls) {
          const newUrls: FoundUrl[] = [];
          for (const item of data.urls) {
            const url = typeof item === 'string' ? item : item.url;
            if (!seenUrls.has(url)) {
              seenUrls.add(url);
              newUrls.push({
                url,
                title: typeof item === 'string' ? url : item.title,
                breadcrumb: typeof item === 'string' ? null : item.breadcrumb,
                status: 'pending',
              });
            }
          }
          const skippedUrls: FoundUrl[] = (data.duplicates || []).map((url: string) => ({
            url, title: url, breadcrumb: null, status: 'skipped' as const,
          }));

          setSubTopics(prev => prev.map((st, idx) =>
            idx === i ? { ...st, status: 'done', urls: [...newUrls, ...skippedUrls] } : st
          ));
        } else {
          setSubTopics(prev => prev.map((st, idx) =>
            idx === i ? { ...st, status: 'error' } : st
          ));
        }
      } catch {
        setSubTopics(prev => prev.map((st, idx) =>
          idx === i ? { ...st, status: 'error' } : st
        ));
      }
    }

    // Step 3: Scrape found URLs
    setStep('scraping');

    let currentTopics: SubTopic[] = [];
    setSubTopics(prev => { currentTopics = prev; return prev; });

    let scrapeIndex = 0;
    const totalToScrape = currentTopics.reduce((sum, st) => sum + st.urls.filter(u => u.status === 'pending').length, 0);

    for (let ti = 0; ti < currentTopics.length; ti++) {
      for (let ui = 0; ui < currentTopics[ti].urls.length; ui++) {
        if (abortRef.current) break;
        if (currentTopics[ti].urls[ui].status !== 'pending') continue;

        scrapeIndex++;
        setCurrentAction(`Scrape ${scrapeIndex}/${totalToScrape}: ${currentTopics[ti].urls[ui].title.substring(0, 50)}...`);

        setSubTopics(prev => prev.map((st, stIdx) =>
          stIdx === ti ? {
            ...st,
            urls: st.urls.map((u, uIdx) => uIdx === ui ? { ...u, status: 'scraping' } : u),
          } : st
        ));

        try {
          const res = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: currentTopics[ti].urls[ui].url }),
          });
          const data = await res.json();

          if (data.success && data.idea) {
            const keywords: KeywordEntry[] = [];
            if (deepScan) {
              if (data.idea.top_annotations) {
                const regex = /<a[^>]*>([^<]*)<\/a>/g;
                let match;
                while ((match = regex.exec(data.idea.top_annotations)) !== null) {
                  keywords.push({ name: match[1].toLowerCase(), count: 1, source: 'annotation' });
                }
              }
              if (data.idea.klp_pivots) {
                for (const p of data.idea.klp_pivots) {
                  keywords.push({ name: p.name.toLowerCase(), count: 1, source: 'klp_pivot' });
                }
              }
              if (data.idea.related_interests) {
                for (const r of data.idea.related_interests) {
                  keywords.push({ name: r.name.toLowerCase(), count: 1, source: 'related_interest' });
                }
              }
            }

            setSubTopics(prev => prev.map((st, stIdx) =>
              stIdx === ti ? {
                ...st,
                urls: st.urls.map((u, uIdx) => uIdx === ui ? {
                  ...u,
                  status: 'done',
                  idea: {
                    id: data.idea.id,
                    name: data.idea.name,
                    searches: data.idea.searches || 0,
                    keywords,
                  },
                } : u),
              } : st
            ));
          } else {
            setSubTopics(prev => prev.map((st, stIdx) =>
              stIdx === ti ? {
                ...st,
                urls: st.urls.map((u, uIdx) => uIdx === ui ? {
                  ...u, status: 'error', error: data.error || 'Scrape fehlgeschlagen',
                } : u),
              } : st
            ));
          }
        } catch {
          setSubTopics(prev => prev.map((st, stIdx) =>
            stIdx === ti ? {
              ...st,
              urls: st.urls.map((u, uIdx) => uIdx === ui ? {
                ...u, status: 'error', error: 'Netzwerkfehler',
              } : u),
            } : st
          ));
        }
      }
      if (abortRef.current) break;
    }

    setStep('done');
    setCurrentAction('');
  }, [topic, deepScan]);

  const handleStop = () => {
    abortRef.current = true;
    setStep('done');
    setCurrentAction('');
  };

  const [clusteringLoading, setClusteringLoading] = useState(false);

  const handleCreateTopicalMap = useCallback(async () => {
    setClusteringLoading(true);

    let finalTopics: SubTopic[] = [];
    setSubTopics(prev => { finalTopics = prev; return prev; });

    const finalIdeas = finalTopics.flatMap(st =>
      st.urls.filter(u => u.idea).map(u => ({ name: u.idea!.name, searches: u.idea!.searches }))
    );

    const kwMap = new Map<string, { count: number; source: string }>();
    for (const st of finalTopics) {
      for (const u of st.urls) {
        if (u.idea) {
          for (const kw of u.idea.keywords) {
            const existing = kwMap.get(kw.name);
            if (existing) { existing.count += kw.count; }
            else { kwMap.set(kw.name, { count: kw.count, source: kw.source }); }
          }
        }
      }
    }
    const finalKeywords: { name: string; count: number; source: string }[] = [];
    for (const [name, data] of kwMap) {
      finalKeywords.push({ name, count: data.count, source: data.source });
    }

    // Also add idea names as keywords for clustering
    for (const idea of finalIdeas) {
      if (!kwMap.has(idea.name.toLowerCase())) {
        finalKeywords.push({ name: idea.name.toLowerCase(), count: 1, source: 'idea_name' });
      }
    }

    try {
      const res = await fetch('/api/cluster-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          ideas: finalIdeas,
          keywords: finalKeywords.sort((a, b) => b.count - a.count).slice(0, 100),
        }),
      });
      const data = await res.json();

      if (data.success && data.topicalMap) {
        setTopicalMap(data.topicalMap);
      } else {
        setError(data.error || 'Topical Map konnte nicht erstellt werden');
      }
    } catch {
      setError('Netzwerkfehler beim Erstellen der Topical Map');
    } finally {
      setClusteringLoading(false);
    }
  }, [topic]);

  const isRunning = step === 'topics' || step === 'searching' || step === 'scraping';

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Topical Map entdecken</h1>
        <p className="text-gray-600">
          Gib ein Thema ein. Die KI generiert Sub-Topics, sucht Pinterest Ideas, scrapt die Ergebnisse und erstellt eine strukturierte Topical Map.
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
                disabled={isRunning}
              />
              <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            {isRunning ? (
              <button
                type="button"
                onClick={handleStop}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <X className="w-5 h-5" />
                Stopp
              </button>
            ) : (
              <button
                type="submit"
                disabled={!topic.trim()}
                className="px-6 py-3 bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <Sparkles className="w-5 h-5" />
                Entdecken
              </button>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={deepScan}
              onChange={(e) => setDeepScan(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
              disabled={isRunning}
            />
            <span>
              <strong>Deep Scan:</strong> Annotations, KLP Pivots und Related Interests von jeder Seite sammeln
            </span>
          </label>
        </div>
      </form>

      {/* Progress */}
      {isRunning && (
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <Loader2 className="w-5 h-5 animate-spin text-red-600" />
            <span className="text-sm font-medium text-gray-700">{currentAction}</span>
          </div>
          <div className="flex gap-1.5 text-xs text-gray-500">
            <span className={step === 'topics' ? 'text-red-600 font-medium' : subTopics.length > 0 ? 'text-green-600' : ''}>
              1. Sub-Topics
            </span>
            <ArrowRight className="w-3 h-3" />
            <span className={step === 'searching' ? 'text-red-600 font-medium' : step === 'scraping' ? 'text-green-600' : ''}>
              2. Suchen
            </span>
            <ArrowRight className="w-3 h-3" />
            <span className={step === 'scraping' ? 'text-red-600 font-medium' : ''}>
              3. Scrapen
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      {(subTopics.length > 0 || step === 'done') && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{subTopics.length}</p>
              <p className="text-sm text-gray-500">Sub-Topics</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{totalUrlsFound}</p>
              <p className="text-sm text-gray-500">URLs gefunden</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{totalScraped}</p>
              <p className="text-sm text-gray-500">Ideas gescrapt</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{allKeywords.length}</p>
              <p className="text-sm text-gray-500">Keywords</p>
            </div>
          </div>

          {/* Create Topical Map Button */}
          {step === 'done' && !topicalMap && allIdeas.length > 0 && (
            <button
              onClick={handleCreateTopicalMap}
              disabled={clusteringLoading}
              className="w-full py-4 bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-xl hover:from-red-700 hover:to-orange-600 disabled:from-gray-400 disabled:to-gray-400 transition-all flex items-center justify-center gap-3 text-lg font-medium shadow-sm"
            >
              {clusteringLoading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  KI erstellt Topical Map...
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6" />
                  Topical Map erstellen (KI-Clustering)
                </>
              )}
            </button>
          )}

          {/* Topical Map (main result) */}
          {topicalMap && (
            <div className="space-y-4">
              {/* Summary & Recommendation */}
              <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border border-red-200 p-5">
                <div className="flex items-start gap-3 mb-3">
                  <Star className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">Topical Map: {topic}</h2>
                    <p className="text-gray-700 text-sm">{topicalMap.summary}</p>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-white/60 rounded-lg border border-red-100">
                  <p className="text-sm font-medium text-red-800 mb-1">Empfehlung:</p>
                  <p className="text-sm text-gray-700">{topicalMap.topRecommendation}</p>
                </div>
              </div>

              {/* Pillar Cards */}
              <div className="grid gap-4 md:grid-cols-2">
                {topicalMap.pillars.map((pillar, i) => {
                  const style = PRIORITY_STYLES[pillar.priority] || PRIORITY_STYLES.medium;
                  return (
                    <div
                      key={i}
                      className={`bg-white rounded-xl shadow-sm border-2 ${style.border} p-4`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900">{pillar.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style.badge}`}>
                          {style.badgeText}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{pillar.description}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {pillar.keywords.map((kw, ki) => (
                          <span
                            key={ki}
                            className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-md"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sub-Topics (collapsed by default) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <button
              onClick={() => setShowTopics(!showTopics)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <h2 className="text-lg font-semibold text-gray-900">
                Sub-Topics ({subTopics.length})
              </h2>
              {showTopics ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>
            {showTopics && (
              <div className="px-4 pb-4">
                <div className="flex flex-wrap gap-2">
                  {subTopics.map((st, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border ${
                        st.status === 'running'
                          ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                          : st.status === 'done' && st.urls.filter(u => u.status === 'done').length > 0
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : st.status === 'error'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}
                    >
                      {st.status === 'running' ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : st.status === 'done' ? (
                        <Check className="w-3 h-3" />
                      ) : st.status === 'error' ? (
                        <X className="w-3 h-3" />
                      ) : (
                        <Search className="w-3 h-3" />
                      )}
                      {st.name}
                      {st.urls.filter(u => u.status !== 'skipped').length > 0 && (
                        <span className="text-xs bg-green-200 text-green-800 px-1.5 py-0.5 rounded-full">
                          {st.urls.filter(u => u.status !== 'skipped').length}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Scraped Ideas (collapsed by default) */}
          {allIdeas.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <button
                onClick={() => setShowIdeas(!showIdeas)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <h2 className="text-lg font-semibold text-gray-900">
                  Gefundene Ideas ({allIdeas.length})
                </h2>
                {showIdeas ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </button>
              {showIdeas && (
                <div className="divide-y">
                  {allIdeas
                    .sort((a, b) => b.searches - a.searches)
                    .map((idea) => (
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
                        <span className="text-sm text-gray-600 whitespace-nowrap">
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

          {/* Raw Keywords (collapsed by default) */}
          {allKeywords.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <button
                onClick={() => setShowKeywords(!showKeywords)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <h2 className="text-lg font-semibold text-gray-900">
                  Rohdaten: Keywords ({allKeywords.length})
                </h2>
                {showKeywords ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </button>
              {showKeywords && (
                <div className="px-4 pb-4">
                  <div className="flex flex-wrap gap-2">
                    {allKeywords.map((kw, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${SOURCE_COLORS[kw.source] || 'bg-gray-100 text-gray-700'}`}
                      >
                        {kw.name}
                        {kw.count > 1 && (
                          <span className="text-xs font-medium opacity-70">x{kw.count}</span>
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
