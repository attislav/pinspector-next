'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  TrendingUp,
  Calendar,
  Hash,
  Tag,
  Link2,
  Loader2,
  ImageIcon,
  Heart,
  MessageCircle,
  FileText,
  Repeat2,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Pin as PinIcon,
  ThumbsUp,
  Sparkles,
  Wand2,
  Lightbulb,
  ChevronDown
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Idea, IdeaHistory, Pin } from '@/types/database';

type PinSortKey = 'position' | 'title' | 'save_count' | 'repin_count' | 'comment_count' | 'pin_created_at' | 'reaction_count';

export default function IdeaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [idea, setIdea] = useState<Idea | null>(null);
  const [history, setHistory] = useState<IdeaHistory[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [scrapingUrl, setScrapingUrl] = useState<string | null>(null);
  const [rescraping, setRescraping] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [pinSortBy, setPinSortBy] = useState<PinSortKey | null>(null);
  const [pinSortOrder, setPinSortOrder] = useState<'asc' | 'desc'>('asc');
  const [hoveredPin, setHoveredPin] = useState<Pin | null>(null);
  const [hoveredPinPosition, setHoveredPinPosition] = useState<{ x: number; y: number } | null>(null);
  const [scrapingAnnotation, setScrapingAnnotation] = useState<string | null>(null);
  const [scrapingAllAnnotations, setScrapingAllAnnotations] = useState(false);
  const [annotationProgress, setAnnotationProgress] = useState({ current: 0, total: 0, currentName: '', success: 0, failed: 0 });
  const [extractingKeywords, setExtractingKeywords] = useState(false);
  const [extractedKeywords, setExtractedKeywords] = useState<string[] | null>(null);
  const [keywordsCopied, setKeywordsCopied] = useState(false);
  const [klpPivotsCopied, setKlpPivotsCopied] = useState(false);
  const [relatedInterestsCopied, setRelatedInterestsCopied] = useState(false);
  const [analyzingContent, setAnalyzingContent] = useState(false);
  const [contentAnalysis, setContentAnalysis] = useState<string | null>(null);
  const [allKwsCopied, setAllKwsCopied] = useState(false);
  const [copyMenuOpen, setCopyMenuOpen] = useState<'klp' | 'related' | 'annotations' | 'allKws' | null>(null);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  // Close copy menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setCopyMenuOpen(null);
    if (copyMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [copyMenuOpen]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [ideaRes, historyRes, pinsRes] = await Promise.all([
        fetch(`/api/interests/${id}`),
        fetch(`/api/interests/${id}/history`),
        fetch(`/api/interests/${id}/pins`)
      ]);

      if (!ideaRes.ok) {
        setError('Idea nicht gefunden');
        return;
      }

      const ideaData = await ideaRes.json();
      const historyData = await historyRes.json();
      const pinsData = await pinsRes.json();

      setIdea(ideaData);
      setHistory(Array.isArray(historyData) ? historyData : []);
      setPins(pinsData.pins || []);
    } catch {
      setError('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  // Add original position to pins and sort
  const pinsWithPosition = useMemo(() => {
    return pins.map((pin, index) => ({ ...pin, originalPosition: index + 1 }));
  }, [pins]);

  // Sorted pins
  const sortedPins = useMemo(() => {
    // No sorting - return original order
    if (!pinSortBy) {
      return pinsWithPosition;
    }

    return [...pinsWithPosition].sort((a, b) => {
      let aVal: number | string | null = null;
      let bVal: number | string | null = null;

      switch (pinSortBy) {
        case 'position':
          aVal = a.originalPosition;
          bVal = b.originalPosition;
          break;
        case 'title':
          aVal = a.title || '';
          bVal = b.title || '';
          break;
        case 'save_count':
          aVal = a.save_count || 0;
          bVal = b.save_count || 0;
          break;
        case 'repin_count':
          aVal = a.repin_count || 0;
          bVal = b.repin_count || 0;
          break;
        case 'comment_count':
          aVal = a.comment_count || 0;
          bVal = b.comment_count || 0;
          break;
        case 'pin_created_at':
          aVal = a.pin_created_at ? new Date(a.pin_created_at).getTime() : 0;
          bVal = b.pin_created_at ? new Date(b.pin_created_at).getTime() : 0;
          break;
        case 'reaction_count':
          aVal = a.repin_count || 0; // Using repin_count as reaction proxy
          bVal = b.repin_count || 0;
          break;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return pinSortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      const numA = aVal as number;
      const numB = bVal as number;
      return pinSortOrder === 'asc' ? numA - numB : numB - numA;
    });
  }, [pinsWithPosition, pinSortBy, pinSortOrder]);

  const handlePinSort = (key: PinSortKey) => {
    if (pinSortBy === key) {
      // Toggle order, or reset if already desc
      if (pinSortOrder === 'desc') {
        setPinSortBy(null); // Reset to original order
      } else {
        setPinSortOrder('desc');
      }
    } else {
      setPinSortBy(key);
      setPinSortOrder('asc');
    }
  };

  const PinSortIcon = ({ column }: { column: PinSortKey }) => {
    if (pinSortBy !== column) {
      return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    }
    return pinSortOrder === 'asc'
      ? <ArrowUp className="w-3 h-3 text-red-600" />
      : <ArrowDown className="w-3 h-3 text-red-600" />;
  };

  // Scrape annotation and navigate
  const scrapeAnnotation = async (annotationName: string) => {
    setScrapingAnnotation(annotationName);
    try {
      // First try to find in database or scrape
      const response = await fetch('/api/find-or-scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: annotationName }),
      });

      const result = await response.json();

      if (result.success && result.idea) {
        router.push(`/interests/${result.idea.id}`);
      } else {
        alert(`Kein Interest gefunden für "${annotationName}"`);
      }
    } catch {
      alert('Fehler beim Scrapen');
    } finally {
      setScrapingAnnotation(null);
    }
  };

  // Scrape all annotations (KLP Pivots + Related Interests + Top Annotations)
  // Note: Pin annotations are excluded to reduce requests
  const scrapeAllAnnotations = async () => {
    if (!idea) return;

    // Collect all unique items to scrape
    const allNames = new Set<string>();

    // 1. KLP Pivots (have direct URLs)
    const klpPivotUrls: { name: string; url: string }[] = [];
    if (idea.klp_pivots) {
      for (const pivot of idea.klp_pivots) {
        if (pivot.url && !allNames.has(pivot.name.toLowerCase())) {
          allNames.add(pivot.name.toLowerCase());
          klpPivotUrls.push({ name: pivot.name, url: pivot.url });
        }
      }
    }

    // 2. Related interests (have direct URLs)
    const relatedInterestUrls: { name: string; url: string }[] = [];
    if (idea.related_interests) {
      for (const interest of idea.related_interests) {
        if (interest.url && !allNames.has(interest.name.toLowerCase())) {
          allNames.add(interest.name.toLowerCase());
          relatedInterestUrls.push({ name: interest.name, url: interest.url });
        }
      }
    }

    // 3. Top annotations (extract names from HTML)
    const topAnnotationNames: string[] = [];
    if (idea.top_annotations) {
      const regex = /<a[^>]*>([^<]*)<\/a>/g;
      let match;
      while ((match = regex.exec(idea.top_annotations)) !== null) {
        const name = match[1];
        if (!allNames.has(name.toLowerCase())) {
          allNames.add(name.toLowerCase());
          topAnnotationNames.push(name);
        }
      }
    }

    const totalCount = klpPivotUrls.length + relatedInterestUrls.length + topAnnotationNames.length;

    if (totalCount === 0) {
      alert('Keine Annotations zum Scrapen gefunden.');
      return;
    }

    if (!confirm(`${totalCount} einzigartige Einträge gefunden:\n- ${klpPivotUrls.length} Keyword Pivots\n- ${relatedInterestUrls.length} Verwandte Interessen\n- ${topAnnotationNames.length} Top Annotations\n\nJetzt alle scrapen?`)) {
      return;
    }

    setScrapingAllAnnotations(true);
    setAnnotationProgress({ current: 0, total: totalCount, currentName: '', success: 0, failed: 0 });

    let current = 0;
    let success = 0;
    let failed = 0;

    try {
      // Scrape KLP Pivots (have direct URLs)
      for (const pivot of klpPivotUrls) {
        current++;
        setAnnotationProgress({ current, total: totalCount, currentName: pivot.name, success, failed });

        try {
          const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: pivot.url, skipIfRecent: true }),
          });
          const result = await response.json();
          if (result.success) {
            success++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
        setAnnotationProgress({ current, total: totalCount, currentName: pivot.name, success, failed });

        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Scrape related interests (have direct URLs)
      for (const interest of relatedInterestUrls) {
        current++;
        setAnnotationProgress({ current, total: totalCount, currentName: interest.name, success, failed });

        try {
          const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: interest.url, skipIfRecent: true }),
          });
          const result = await response.json();
          if (result.success) {
            success++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
        setAnnotationProgress({ current, total: totalCount, currentName: interest.name, success, failed });

        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Scrape top annotations (use find-or-scrape API)
      for (const name of topAnnotationNames) {
        current++;
        setAnnotationProgress({ current, total: totalCount, currentName: name, success, failed });

        try {
          const response = await fetch('/api/find-or-scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
          });
          const result = await response.json();
          if (result.success) {
            success++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
        setAnnotationProgress({ current, total: totalCount, currentName: name, success, failed });

        await new Promise(resolve => setTimeout(resolve, 300));
      }

      alert(`Scraping abgeschlossen!\n\nErfolgreich: ${success}\nFehlgeschlagen: ${failed}`);
    } finally {
      setScrapingAllAnnotations(false);
      setAnnotationProgress({ current: 0, total: 0, currentName: '', success: 0, failed: 0 });
    }
  };

  const copyAnnotations = (asList: boolean) => {
    if (!idea?.top_annotations) return;

    // Extract annotation names from HTML
    const regex = /<a[^>]*>([^<]*)<\/a>/g;
    const annotations: string[] = [];
    let match;
    while ((match = regex.exec(idea.top_annotations)) !== null) {
      annotations.push(match[1]);
    }

    const text = asList ? annotations.join('\n') : annotations.join(', ');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setCopyMenuOpen(null);
    setTimeout(() => setCopied(false), 2000);
  };

  // Extract keywords from pin titles using AI
  const extractKeywordsFromTitles = async () => {
    const titles = pins.map(p => p.title).filter(t => t && t.trim().length > 0);

    if (titles.length === 0) {
      alert('Keine Pin-Titel gefunden');
      return;
    }

    setExtractingKeywords(true);
    setExtractedKeywords(null);

    try {
      const response = await fetch('/api/extract-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titles }),
      });

      const data = await response.json();

      if (data.success && data.keywords) {
        setExtractedKeywords(data.keywords);
      } else {
        alert(data.error || 'Fehler bei der Keyword-Extraktion');
      }
    } catch {
      alert('Fehler bei der Keyword-Extraktion');
    } finally {
      setExtractingKeywords(false);
    }
  };

  const copyExtractedKeywords = () => {
    if (!extractedKeywords) return;
    navigator.clipboard.writeText(extractedKeywords.join(', '));
    setKeywordsCopied(true);
    setTimeout(() => setKeywordsCopied(false), 2000);
  };

  // Analyze content strategy based on pin titles
  const analyzeContentStrategy = async () => {
    if (!idea) return;

    const titles = pins.map(p => p.title).filter(t => t && t.trim().length > 0);

    if (titles.length === 0) {
      alert('Keine Pin-Titel gefunden');
      return;
    }

    setAnalyzingContent(true);
    setContentAnalysis(null);

    try {
      const response = await fetch('/api/analyze-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: idea.name, titles }),
      });

      const data = await response.json();

      if (data.success && data.analysis) {
        setContentAnalysis(data.analysis);
      } else {
        alert(data.error || 'Fehler bei der Content-Analyse');
      }
    } catch {
      alert('Fehler bei der Content-Analyse');
    } finally {
      setAnalyzingContent(false);
    }
  };

  const copyKlpPivots = (asList: boolean) => {
    if (!idea?.klp_pivots || idea.klp_pivots.length === 0) return;
    const text = asList
      ? idea.klp_pivots.map(p => p.name).join('\n')
      : idea.klp_pivots.map(p => p.name).join(', ');
    navigator.clipboard.writeText(text);
    setKlpPivotsCopied(true);
    setCopyMenuOpen(null);
    setTimeout(() => setKlpPivotsCopied(false), 2000);
  };

  const copyRelatedInterests = (asList: boolean) => {
    if (!idea?.related_interests || idea.related_interests.length === 0) return;
    const text = asList
      ? idea.related_interests.map(i => i.name).join('\n')
      : idea.related_interests.map(i => i.name).join(', ');
    navigator.clipboard.writeText(text);
    setRelatedInterestsCopied(true);
    setCopyMenuOpen(null);
    setTimeout(() => setRelatedInterestsCopied(false), 2000);
  };

  // Copy all unique keywords from the page (KLP Pivots, Related Interests, Top Annotations, Pin Annotations)
  const copyAllKeywords = (asList: boolean) => {
    if (!idea) return;

    const allKws = new Set<string>();

    // KLP Pivots
    if (idea.klp_pivots) {
      for (const pivot of idea.klp_pivots) {
        allKws.add(pivot.name);
      }
    }

    // Related Interests
    if (idea.related_interests) {
      for (const interest of idea.related_interests) {
        allKws.add(interest.name);
      }
    }

    // Top Annotations (extract from HTML)
    if (idea.top_annotations) {
      const regex = /<a[^>]*>([^<]*)<\/a>/g;
      let match;
      while ((match = regex.exec(idea.top_annotations)) !== null) {
        allKws.add(match[1]);
      }
    }

    // Pin Annotations
    for (const pin of pins) {
      if (pin.annotations) {
        for (const annotation of pin.annotations) {
          allKws.add(annotation);
        }
      }
    }

    if (allKws.size === 0) {
      return;
    }

    const text = asList ? Array.from(allKws).join('\n') : Array.from(allKws).join(', ');
    navigator.clipboard.writeText(text);
    setAllKwsCopied(true);
    setCopyMenuOpen(null);
    setTimeout(() => setAllKwsCopied(false), 2000);
  };

  const scrapeAndNavigate = async (url: string) => {
    setScrapingUrl(url);
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, skipIfRecent: true }),
      });

      const result = await response.json();

      if (result.success && result.idea) {
        router.push(`/interests/${result.idea.id}`);
      } else {
        alert(result.error || 'Fehler beim Scrapen');
      }
    } catch {
      alert('Fehler beim Scrapen');
    } finally {
      setScrapingUrl(null);
    }
  };

  const handleRescrape = async () => {
    if (!idea?.url) return;
    setRescraping(true);
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: idea.url }),
      });

      const result = await response.json();

      if (result.success && result.idea) {
        setIdea(result.idea);
        if (result.pins) {
          setPins(result.pins);
        }
        fetchData();
      } else {
        alert(result.error || 'Fehler beim Scrapen');
      }
    } catch {
      alert('Fehler beim Scrapen');
    } finally {
      setRescraping(false);
    }
  };

  const formatNumber = (num: number) => new Intl.NumberFormat('de-DE').format(num);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatShortDate = (date: string) => {
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit'
    });
  };

  const formatPinDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  // Parse top annotations into structured format for better display
  const parseAnnotations = (html: string) => {
    const regex = /<a[^>]*>([^<]*)<\/a>\s*\((\d+)\)/g;
    const annotations: { name: string; count: number }[] = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
      annotations.push({ name: match[1], count: parseInt(match[2]) });
    }
    return annotations.sort((a, b) => b.count - a.count);
  };

  const chartData = history.map((h) => ({
    date: formatShortDate(h.scrape_date),
    fullDate: formatDate(h.scrape_date),
    searches: h.searches
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  if (error || !idea) {
    return (
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-red-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Zurück
        </button>
        <div className="p-8 bg-red-50 rounded-xl text-center">
          <p className="text-red-700 font-medium">{error || 'Idea nicht gefunden'}</p>
        </div>
      </div>
    );
  }

  const parsedAnnotations = idea.top_annotations ? parseAnnotations(idea.top_annotations) : [];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-red-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Zurück zur Übersicht
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-red-900 mb-2">{idea.name}</h1>
            <p className="text-gray-500 font-mono text-sm">ID: {idea.id}</p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <button
                onClick={() => setCopyMenuOpen(copyMenuOpen === 'allKws' ? null : 'allKws')}
                className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                title="Alle Keywords kopieren"
              >
                {allKwsCopied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Kopiert!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    KWs Kopieren
                    <ChevronDown className="w-3 h-3" />
                  </>
                )}
              </button>
              {copyMenuOpen === 'allKws' && (
                <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[160px]">
                  <button
                    onClick={() => copyAllKeywords(false)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 rounded-t-lg"
                  >
                    Kommagetrennt
                  </button>
                  <button
                    onClick={() => copyAllKeywords(true)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 rounded-b-lg"
                  >
                    Als Liste
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={scrapeAllAnnotations}
              disabled={scrapingAllAnnotations || rescraping}
              className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
              title="Alle Annotations scrapen"
            >
              {scrapingAllAnnotations ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Scrape Annotations
            </button>
            <button
              onClick={handleRescrape}
              disabled={rescraping || scrapingAllAnnotations}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              title="Daten neu laden"
            >
              <RefreshCw className={`w-4 h-4 ${rescraping ? 'animate-spin' : ''}`} />
              {rescraping ? 'Lädt...' : 'Neu scrapen'}
            </button>
            <a
              href={idea.url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Auf Pinterest öffnen
            </a>
          </div>
        </div>
      </div>

      {/* Scrape Annotations Progress */}
      {scrapingAllAnnotations && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-blue-700 font-medium flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Scrape Annotations...
            </span>
            <span className="text-blue-600 text-sm">
              {annotationProgress.current} / {annotationProgress.total}
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(annotationProgress.current / annotationProgress.total) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-sm">
            {annotationProgress.currentName && (
              <p className="text-blue-600 truncate flex-1 mr-4">
                Aktuell: {annotationProgress.currentName}
              </p>
            )}
            <p className="text-blue-600">
              <span className="text-green-600">{annotationProgress.success} OK</span>
              {annotationProgress.failed > 0 && (
                <span className="text-red-600 ml-2">{annotationProgress.failed} Fehler</span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-red-50 rounded-xl">
          <div className="flex items-center gap-2 text-red-600 text-sm font-medium mb-1">
            <TrendingUp className="w-4 h-4" />
            Suchvolumen
          </div>
          <div className="text-2xl font-bold text-red-900">
            {formatNumber(idea.searches)}
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-xl">
          <div className="flex items-center gap-2 text-gray-600 text-sm font-medium mb-1">
            <Calendar className="w-4 h-4" />
            Last Update
          </div>
          <div className="text-sm font-medium text-gray-900">
            {idea.last_update ? formatDate(idea.last_update) : '-'}
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-xl">
          <div className="flex items-center gap-2 text-gray-600 text-sm font-medium mb-1">
            <RefreshCw className="w-4 h-4" />
            Last Scrape
          </div>
          <div className="text-sm font-medium text-gray-900">
            {formatDate(idea.last_scrape)}
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-xl">
          <div className="flex items-center gap-2 text-gray-600 text-sm font-medium mb-1">
            <Hash className="w-4 h-4" />
            History-Einträge
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {history.length}
          </div>
        </div>
      </div>

      {/* History Chart */}
      {chartData.length > 1 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Suchvolumen-Entwicklung
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickLine={{ stroke: '#e5e7eb' }}
                  tickFormatter={(value) => formatNumber(value)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [formatNumber(value), 'Suchanfragen']}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      return payload[0].payload.fullDate;
                    }
                    return label;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="searches"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  dot={{ fill: '#7c3aed', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: '#7c3aed' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* SEO Kategorien */}
      {idea.seo_breadcrumbs && idea.seo_breadcrumbs.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Tag className="w-5 h-5 text-red-600" />
            SEO Kategorien
          </h2>
          <div className="flex items-center gap-2 text-gray-700 flex-wrap">
            {idea.seo_breadcrumbs.map((crumb: string | { name: string }, index: number) => {
              const crumbName = typeof crumb === 'string' ? crumb : crumb.name;
              return (
                <span key={index} className="flex items-center gap-2">
                  {index > 0 && <span className="text-gray-400">›</span>}
                  <span className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm">
                    {crumbName}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* KLP Pivots (Keyword Bubbles) */}
      {idea.klp_pivots && idea.klp_pivots.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-red-600" />
              Keyword Pivots ({idea.klp_pivots.length})
            </h2>
            <div className="relative">
              <button
                onClick={() => setCopyMenuOpen(copyMenuOpen === 'klp' ? null : 'klp')}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                {klpPivotsCopied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Kopiert!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Kopieren
                    <ChevronDown className="w-3 h-3" />
                  </>
                )}
              </button>
              {copyMenuOpen === 'klp' && (
                <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[160px]">
                  <button
                    onClick={() => copyKlpPivots(false)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 rounded-t-lg"
                  >
                    Kommagetrennt
                  </button>
                  <button
                    onClick={() => copyKlpPivots(true)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 rounded-b-lg"
                  >
                    Als Liste
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {idea.klp_pivots.map((pivot, index) => (
              <button
                key={index}
                onClick={() => scrapeAndNavigate(pivot.url)}
                disabled={scrapingUrl === pivot.url}
                className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 hover:text-orange-800 rounded-full text-sm transition-colors disabled:opacity-50 disabled:cursor-wait flex items-center gap-1"
              >
                {scrapingUrl === pivot.url && (
                  <Loader2 className="w-3 h-3 animate-spin" />
                )}
                {pivot.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Verwandte Interessen */}
      {idea.related_interests && idea.related_interests.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Link2 className="w-5 h-5 text-red-600" />
              Verwandte Interessen ({idea.related_interests.length})
            </h2>
            <div className="relative">
              <button
                onClick={() => setCopyMenuOpen(copyMenuOpen === 'related' ? null : 'related')}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                {relatedInterestsCopied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Kopiert!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Kopieren
                    <ChevronDown className="w-3 h-3" />
                  </>
                )}
              </button>
              {copyMenuOpen === 'related' && (
                <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[160px]">
                  <button
                    onClick={() => copyRelatedInterests(false)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 rounded-t-lg"
                  >
                    Kommagetrennt
                  </button>
                  <button
                    onClick={() => copyRelatedInterests(true)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 rounded-b-lg"
                  >
                    Als Liste
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {idea.related_interests.map((interest, index) => (
              <button
                key={index}
                onClick={() => scrapeAndNavigate(interest.url)}
                disabled={scrapingUrl === interest.url}
                className="px-3 py-1.5 bg-gray-100 hover:bg-red-100 text-gray-700 hover:text-red-800 rounded-full text-sm transition-colors disabled:opacity-50 disabled:cursor-wait flex items-center gap-1"
              >
                {scrapingUrl === interest.url && (
                  <Loader2 className="w-3 h-3 animate-spin" />
                )}
                {interest.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Top Annotations */}
      {parsedAnnotations.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Top Annotations</h2>
            <div className="relative">
              <button
                onClick={() => setCopyMenuOpen(copyMenuOpen === 'annotations' ? null : 'annotations')}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
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
                    <ChevronDown className="w-3 h-3" />
                  </>
                )}
              </button>
              {copyMenuOpen === 'annotations' && (
                <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[160px]">
                  <button
                    onClick={() => copyAnnotations(false)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 rounded-t-lg"
                  >
                    Kommagetrennt
                  </button>
                  <button
                    onClick={() => copyAnnotations(true)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 rounded-b-lg"
                  >
                    Als Liste
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {parsedAnnotations.map((annotation, index) => (
              <button
                key={index}
                onClick={() => scrapeAnnotation(annotation.name)}
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
      )}

      {/* Image Enlargement Modal */}
      {enlargedImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setEnlargedImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300"
            onClick={() => setEnlargedImage(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={enlargedImage}
            alt="Enlarged pin"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
        </div>
      )}

      {/* Hover Preview Tooltip */}
      {hoveredPin && (
        <div className="fixed z-40 pointer-events-none" style={{
          left: 'min(calc(var(--mouse-x, 50%) + 20px), calc(100vw - 400px))',
          top: 'min(calc(var(--mouse-y, 50%) + 20px), calc(100vh - 500px))'
        }}>
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-3 max-w-[360px]">
            {hoveredPin.image_url && (
              <img
                src={hoveredPin.image_url}
                alt={hoveredPin.title || 'Pin'}
                className="w-full max-h-[400px] object-contain rounded-lg"
              />
            )}
            {hoveredPin.title && (
              <h3 className="font-semibold text-gray-900 text-sm mt-2 text-center">{hoveredPin.title}</h3>
            )}
          </div>
        </div>
      )}

      {/* Pins Table - Sortierbar */}
      {sortedPins.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-red-600" />
              Top Pins ({pins.length})
            </h2>
            <button
              onClick={analyzeContentStrategy}
              disabled={analyzingContent}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg transition-colors disabled:opacity-50"
              title="Content-Strategie analysieren (KI)"
            >
              {analyzingContent ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Lightbulb className="w-4 h-4" />
              )}
              {analyzingContent ? 'Analysiere...' : 'Content analysieren'}
            </button>
            <button
              onClick={extractKeywordsFromTitles}
              disabled={extractingKeywords}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition-colors disabled:opacity-50"
              title="Keywords aus Pin-Titeln extrahieren (KI)"
            >
              {extractingKeywords ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              {extractingKeywords ? 'Extrahiere...' : 'Keywords extrahieren'}
            </button>
          </div>

          {/* Content Analysis Result */}
          {contentAnalysis && (
            <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-purple-700 font-medium flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  Content-Strategie für &quot;{idea?.name}&quot;
                </span>
                <button
                  onClick={() => setContentAnalysis(null)}
                  className="text-purple-400 hover:text-purple-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="text-sm text-gray-700 space-y-2">
                {contentAnalysis.split('\n').map((line, idx) => {
                  if (line.startsWith('DOMINANTER CONTENT-TYP:') || line.startsWith('WAS RANKT:') || line.startsWith('MEINE EMPFEHLUNG:')) {
                    return <p key={idx} className="text-purple-800 font-semibold mt-3 mb-1">{line}</p>;
                  }
                  if (line.startsWith('- ')) {
                    return <p key={idx} className="ml-4">• {line.replace('- ', '')}</p>;
                  }
                  if (line.trim()) {
                    return <p key={idx}>{line}</p>;
                  }
                  return null;
                })}
              </div>
            </div>
          )}

          {/* Extracted Keywords Result */}
          {extractedKeywords && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-green-700 font-medium">
                  {extractedKeywords.length} Keywords extrahiert
                </span>
                <button
                  onClick={copyExtractedKeywords}
                  className="flex items-center gap-1 px-2 py-1 text-sm text-green-600 hover:text-green-800 hover:bg-green-100 rounded transition-colors"
                >
                  {keywordsCopied ? (
                    <>
                      <Check className="w-3 h-3" />
                      Kopiert!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Kopieren
                    </>
                  )}
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {extractedKeywords.map((kw, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-sm"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-center py-3 px-2">
                    <button
                      onClick={() => handlePinSort('position')}
                      className="flex items-center gap-1 font-semibold text-gray-700 hover:text-red-700"
                      title="Position"
                    >
                      # <PinSortIcon column="position" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Bild</th>
                  <th className="text-left py-3 px-2">
                    <button
                      onClick={() => handlePinSort('title')}
                      className="flex items-center gap-1 font-semibold text-gray-700 hover:text-red-700"
                    >
                      Titel <PinSortIcon column="title" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Domain</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Beschreibung</th>
                  <th className="text-left py-3 px-2">
                    <button
                      onClick={() => handlePinSort('pin_created_at')}
                      className="flex items-center gap-1 font-semibold text-gray-700 hover:text-red-700 text-xs"
                    >
                      Erstellt <PinSortIcon column="pin_created_at" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Annotations</th>
                  <th className="text-right py-3 px-2">
                    <button
                      onClick={() => handlePinSort('save_count')}
                      className="flex items-center gap-1 font-semibold text-gray-700 hover:text-red-700 ml-auto"
                      title="Saves"
                    >
                      <PinIcon className="w-4 h-4" /> <PinSortIcon column="save_count" />
                    </button>
                  </th>
                  <th className="text-right py-3 px-2">
                    <button
                      onClick={() => handlePinSort('reaction_count')}
                      className="flex items-center gap-1 font-semibold text-gray-700 hover:text-red-700 ml-auto"
                      title="Reactions"
                    >
                      <Heart className="w-4 h-4" /> <PinSortIcon column="reaction_count" />
                    </button>
                  </th>
                  <th className="text-right py-3 px-2">
                    <button
                      onClick={() => handlePinSort('repin_count')}
                      className="flex items-center gap-1 font-semibold text-gray-700 hover:text-red-700 ml-auto"
                      title="Repins"
                    >
                      <Repeat2 className="w-4 h-4" /> <PinSortIcon column="repin_count" />
                    </button>
                  </th>
                  <th className="text-right py-3 px-2">
                    <button
                      onClick={() => handlePinSort('comment_count')}
                      className="flex items-center gap-1 font-semibold text-gray-700 hover:text-red-700 ml-auto"
                      title="Kommentare"
                    >
                      <MessageCircle className="w-4 h-4" /> <PinSortIcon column="comment_count" />
                    </button>
                  </th>
                  <th className="text-center py-3 px-2 font-semibold text-gray-700">Links</th>
                </tr>
              </thead>
              <tbody>
                {sortedPins.map((pin) => (
                  <tr
                    key={pin.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    {/* Position */}
                    <td className="py-2 px-2 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                        {pin.originalPosition}
                      </span>
                    </td>
                    {/* Thumbnail - hover only here */}
                    <td className="py-2 px-2">
                      <div
                        className="w-12 h-16 bg-gray-100 rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-red-400 transition-all"
                        onClick={() => setEnlargedImage(pin.image_url)}
                        onMouseEnter={(e) => {
                          setHoveredPin(pin);
                          document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
                          document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
                        }}
                        onMouseMove={(e) => {
                          document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
                          document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
                        }}
                        onMouseLeave={() => setHoveredPin(null)}
                      >
                        {(pin.image_thumbnail_url || pin.image_url) ? (
                          <img
                            src={pin.image_thumbnail_url || pin.image_url || ''}
                            alt={pin.title || 'Pin'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                      </div>
                    </td>
                    {/* Title */}
                    <td className="py-2 px-2 max-w-[180px]">
                      <span className="line-clamp-2 text-gray-900 cursor-help" title={pin.title || ''}>
                        {pin.title || '-'}
                      </span>
                    </td>
                    {/* Domain */}
                    <td className="py-2 px-2 text-gray-600 text-xs">
                      {pin.domain || '-'}
                    </td>
                    {/* Description */}
                    <td className="py-2 px-2 max-w-[200px]">
                      <span className="line-clamp-2 text-gray-600 text-xs cursor-help" title={pin.description || ''}>
                        {pin.description || '-'}
                      </span>
                    </td>
                    {/* Created Date */}
                    <td className="py-2 px-2 text-gray-500 whitespace-nowrap text-xs">
                      {formatPinDate(pin.pin_created_at)}
                    </td>
                    {/* Annotations - Alle anzeigen, klickbar */}
                    <td className="py-2 px-2">
                      <div className="flex flex-wrap gap-1 max-w-[280px]">
                        {pin.annotations?.map((annotation, idx) => (
                          <button
                            key={idx}
                            onClick={() => scrapeAnnotation(annotation)}
                            disabled={scrapingAnnotation === annotation}
                            className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full whitespace-nowrap hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-wait flex items-center gap-1"
                          >
                            {scrapingAnnotation === annotation && (
                              <Loader2 className="w-2 h-2 animate-spin" />
                            )}
                            {annotation}
                          </button>
                        ))}
                      </div>
                    </td>
                    {/* Saves */}
                    <td className="py-2 px-2 text-right text-gray-900 font-medium">
                      {formatNumber(pin.save_count)}
                    </td>
                    {/* Reactions (using repin_count as proxy) */}
                    <td className="py-2 px-2 text-right text-gray-900 font-medium">
                      {formatNumber(pin.repin_count)}
                    </td>
                    {/* Repins */}
                    <td className="py-2 px-2 text-right text-gray-900 font-medium">
                      {formatNumber(pin.repin_count)}
                    </td>
                    {/* Comments */}
                    <td className="py-2 px-2 text-right text-gray-900 font-medium">
                      {formatNumber(pin.comment_count)}
                    </td>
                    {/* Links */}
                    <td className="py-2 px-2">
                      <div className="flex items-center justify-center gap-2">
                        {pin.link && (
                          <a
                            href={pin.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-red-600 hover:text-red-800"
                            title="Pin auf Pinterest öffnen"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        {pin.article_url && (
                          <a
                            href={pin.article_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                            title="Artikel öffnen"
                          >
                            <FileText className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History Table */}
      {history.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Suchvolumen-Historie
          </h2>
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
                {history.slice().reverse().map((h, index, arr) => {
                  const prevSearches = index < arr.length - 1 ? arr[index + 1].searches : h.searches;
                  const change = h.searches - prevSearches;

                  return (
                    <tr key={h.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 text-sm text-gray-600">
                        {formatDate(h.scrape_date)}
                      </td>
                      <td className="py-2 px-3 text-sm text-right font-medium text-gray-900">
                        {formatNumber(h.searches)}
                      </td>
                      <td className={`py-2 px-3 text-sm text-right font-medium ${
                        change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-400'
                      }`}>
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
