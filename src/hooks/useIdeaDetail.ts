'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { Idea, IdeaHistory, Pin } from '@/types/database';

type PinSortKey = 'position' | 'title' | 'save_count' | 'repin_count' | 'comment_count' | 'pin_created_at' | 'reaction_count';
type CopyMenuType = 'klp' | 'related' | 'annotations' | 'allKws' | null;

export interface PinWithPosition extends Pin {
  originalPosition: number;
}

export function useIdeaDetail(id: string) {
  const router = useRouter();

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
  const [copyMenuOpen, setCopyMenuOpen] = useState<CopyMenuType>(null);
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());
  const [existingNames, setExistingNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  // Check which related ideas already exist in our DB
  useEffect(() => {
    if (!idea || pins.length === 0) return;

    const idsToCheck = new Set<string>();

    // Extract IDs from KLP pivot URLs (/ideas/something/123456/)
    if (idea.klp_pivots) {
      for (const p of idea.klp_pivots) {
        const match = p.url?.match(/\/ideas\/[^/]+\/(\d+)/);
        if (match) idsToCheck.add(match[1]);
      }
    }

    // Extract IDs from related interest URLs
    if (idea.related_interests) {
      for (const ri of idea.related_interests) {
        if (ri.id) idsToCheck.add(ri.id);
        const match = ri.url?.match(/\/ideas\/[^/]+\/(\d+)/);
        if (match) idsToCheck.add(match[1]);
      }
    }

    // Extract IDs and names from top_annotations
    const annotationNames = new Set<string>();
    if (idea.top_annotations) {
      const urlRegex = /href="[^"]*\/ideas\/[^/]+\/(\d+)[^"]*"/g;
      let match;
      while ((match = urlRegex.exec(idea.top_annotations)) !== null) {
        idsToCheck.add(match[1]);
      }
      // Also collect annotation names for name-based check
      const nameRegex = /<a[^>]*>([^<]*)<\/a>/g;
      let nameMatch;
      while ((nameMatch = nameRegex.exec(idea.top_annotations)) !== null) {
        annotationNames.add(nameMatch[1]);
      }
    }

    // Collect pin annotation names
    for (const pin of pins) {
      if (pin.annotations) {
        for (const a of pin.annotations) {
          annotationNames.add(a);
        }
      }
    }

    // Also add KLP pivot and related interest names for name-based fallback
    if (idea.klp_pivots) {
      for (const p of idea.klp_pivots) annotationNames.add(p.name);
    }
    if (idea.related_interests) {
      for (const ri of idea.related_interests) annotationNames.add(ri.name);
    }

    if (idsToCheck.size === 0 && annotationNames.size === 0) return;

    // Batch check IDs and names in one request
    fetchWithTimeout('/api/interests/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: Array.from(idsToCheck),
        names: Array.from(annotationNames),
      }),
    })
      .then(res => res.json())
      .then(data => {
        setExistingIds(new Set<string>(data.ids || []));
        setExistingNames(new Set<string>((data.names || []).map((n: string) => n.toLowerCase())));
      })
      .catch(() => {});
  }, [idea, pins]);

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
        fetchWithTimeout(`/api/interests/${id}`),
        fetchWithTimeout(`/api/interests/${id}/history`),
        fetchWithTimeout(`/api/interests/${id}/pins`),
      ]);
      if (!ideaRes.ok) {
        // Interest not in DB — try auto-scraping from Pinterest
        if (/^\d+$/.test(id)) {
          const scrapeUrl = `https://www.pinterest.de/ideas/_/${id}/`;
          try {
            const scrapeRes = await fetchWithTimeout('/api/scrape', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: scrapeUrl }),
            });
            const scrapeResult = await scrapeRes.json();
            if (scrapeResult.success && scrapeResult.idea) {
              setIdea(scrapeResult.idea);
              setPins(scrapeResult.pins || []);
              setHistory([]);
              return;
            }
          } catch {
            // Auto-scrape failed, fall through to error
          }
        }
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

  // Pins with original position
  const pinsWithPosition = useMemo<PinWithPosition[]>(() => {
    return pins.map((pin, index) => ({ ...pin, originalPosition: index + 1 }));
  }, [pins]);

  // Sorted pins
  const sortedPins = useMemo<PinWithPosition[]>(() => {
    if (!pinSortBy) return pinsWithPosition;
    return [...pinsWithPosition].sort((a, b) => {
      let aVal: number | string | null = null;
      let bVal: number | string | null = null;
      switch (pinSortBy) {
        case 'position': aVal = a.originalPosition; bVal = b.originalPosition; break;
        case 'title': aVal = a.title || ''; bVal = b.title || ''; break;
        case 'save_count': aVal = a.save_count || 0; bVal = b.save_count || 0; break;
        case 'repin_count': aVal = a.repin_count || 0; bVal = b.repin_count || 0; break;
        case 'comment_count': aVal = a.comment_count || 0; bVal = b.comment_count || 0; break;
        case 'pin_created_at': aVal = a.pin_created_at ? new Date(a.pin_created_at).getTime() : 0; bVal = b.pin_created_at ? new Date(b.pin_created_at).getTime() : 0; break;
        case 'reaction_count': aVal = a.repin_count || 0; bVal = b.repin_count || 0; break;
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return pinSortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return pinSortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [pinsWithPosition, pinSortBy, pinSortOrder]);

  const handlePinSort = (key: PinSortKey) => {
    if (pinSortBy === key) {
      if (pinSortOrder === 'desc') { setPinSortBy(null); } else { setPinSortOrder('desc'); }
    } else {
      setPinSortBy(key); setPinSortOrder('asc');
    }
  };

  const scrapeAnnotation = async (annotationName: string) => {
    setScrapingAnnotation(annotationName);
    try {
      const response = await fetchWithTimeout('/api/find-or-scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: annotationName, language: idea?.language }),
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

  const scrapeAllAnnotations = async () => {
    if (!idea) return;

    // Collect all unique items from all sources, deduplicated by name (lowercase)
    const seen = new Set<string>();
    const withUrl: { name: string; url: string }[] = [];
    const withoutUrl: string[] = [];

    // 1. KLP Pivots (have URLs)
    if (idea.klp_pivots) {
      for (const pivot of idea.klp_pivots) {
        if (pivot.url && !seen.has(pivot.name.toLowerCase())) {
          seen.add(pivot.name.toLowerCase());
          withUrl.push({ name: pivot.name, url: pivot.url });
        }
      }
    }

    // 2. Related Interests (have URLs)
    if (idea.related_interests) {
      for (const interest of idea.related_interests) {
        if (interest.url && !seen.has(interest.name.toLowerCase())) {
          seen.add(interest.name.toLowerCase());
          withUrl.push({ name: interest.name, url: interest.url });
        }
      }
    }

    // 3. Top Annotations (have URLs in href)
    if (idea.top_annotations) {
      const regex = /<a\s+href="([^"]*)"[^>]*>([^<]*)<\/a>/g;
      let match;
      while ((match = regex.exec(idea.top_annotations)) !== null) {
        const url = match[1];
        const name = match[2];
        if (!seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          if (url && url.includes('/ideas/')) {
            withUrl.push({ name, url: url.startsWith('http') ? url : `https://www.pinterest.com${url}` });
          } else {
            withoutUrl.push(name);
          }
        }
      }
    }

    // 4. Pin Annotations (names only, no URLs)
    for (const pin of pins) {
      if (pin.annotations) {
        for (const annotation of pin.annotations) {
          if (!seen.has(annotation.toLowerCase())) {
            seen.add(annotation.toLowerCase());
            withoutUrl.push(annotation);
          }
        }
      }
    }

    const totalCount = withUrl.length + withoutUrl.length;
    if (totalCount === 0) { alert('Keine Annotations zum Scrapen gefunden.'); return; }
    if (!confirm(`${totalCount} einzigartige Einträge gefunden:\n- ${withUrl.length} mit URL (direkt scrapen)\n- ${withoutUrl.length} ohne URL (per Suche)\n\nJetzt alle scrapen?`)) return;

    setScrapingAllAnnotations(true);
    setAnnotationProgress({ current: 0, total: totalCount, currentName: '', success: 0, failed: 0 });
    let current = 0, success = 0, failed = 0;

    try {
      // Scrape items with URL via /api/scrape
      for (const item of withUrl) {
        current++;
        setAnnotationProgress({ current, total: totalCount, currentName: item.name, success, failed });
        try {
          const response = await fetchWithTimeout('/api/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: item.url, skipIfRecent: true, language: idea?.language }) });
          const result = await response.json();
          result.success ? success++ : failed++;
        } catch { failed++; }
        setAnnotationProgress({ current, total: totalCount, currentName: item.name, success, failed });
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Scrape items without URL via /api/find-or-scrape
      for (const name of withoutUrl) {
        current++;
        setAnnotationProgress({ current, total: totalCount, currentName: name, success, failed });
        try {
          const response = await fetchWithTimeout('/api/find-or-scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, language: idea?.language }) });
          const result = await response.json();
          result.success ? success++ : failed++;
        } catch { failed++; }
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
    const regex = /<a[^>]*>([^<]*)<\/a>/g;
    const annotations: string[] = [];
    let match;
    while ((match = regex.exec(idea.top_annotations)) !== null) annotations.push(match[1]);
    navigator.clipboard.writeText(asList ? annotations.join('\n') : annotations.join(', '));
    setCopied(true); setCopyMenuOpen(null);
    setTimeout(() => setCopied(false), 2000);
  };

  const extractKeywordsFromTitles = async () => {
    const titles = pins.map(p => p.title).filter(t => t && t.trim().length > 0);
    if (titles.length === 0) { alert('Keine Pin-Titel gefunden'); return; }
    setExtractingKeywords(true); setExtractedKeywords(null);
    try {
      const response = await fetchWithTimeout('/api/extract-keywords', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titles }) });
      const data = await response.json();
      if (data.success && data.keywords) setExtractedKeywords(data.keywords);
      else alert(data.error || 'Fehler bei der Keyword-Extraktion');
    } catch { alert('Fehler bei der Keyword-Extraktion'); }
    finally { setExtractingKeywords(false); }
  };

  const copyExtractedKeywords = () => {
    if (!extractedKeywords) return;
    navigator.clipboard.writeText(extractedKeywords.join(', '));
    setKeywordsCopied(true);
    setTimeout(() => setKeywordsCopied(false), 2000);
  };

  const analyzeContentStrategy = async () => {
    if (!idea) return;
    const titles = pins.map(p => p.title).filter(t => t && t.trim().length > 0);
    if (titles.length === 0) { alert('Keine Pin-Titel gefunden'); return; }
    setAnalyzingContent(true); setContentAnalysis(null);
    try {
      const response = await fetchWithTimeout('/api/analyze-content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyword: idea.name, titles }) });
      const data = await response.json();
      if (data.success && data.analysis) setContentAnalysis(data.analysis);
      else alert(data.error || 'Fehler bei der Content-Analyse');
    } catch { alert('Fehler bei der Content-Analyse'); }
    finally { setAnalyzingContent(false); }
  };

  const copyKlpPivots = (asList: boolean) => {
    if (!idea?.klp_pivots?.length) return;
    const text = asList ? idea.klp_pivots.map(p => p.name).join('\n') : idea.klp_pivots.map(p => p.name).join(', ');
    navigator.clipboard.writeText(text);
    setKlpPivotsCopied(true); setCopyMenuOpen(null);
    setTimeout(() => setKlpPivotsCopied(false), 2000);
  };

  const copyRelatedInterests = (asList: boolean) => {
    if (!idea?.related_interests?.length) return;
    const text = asList ? idea.related_interests.map(i => i.name).join('\n') : idea.related_interests.map(i => i.name).join(', ');
    navigator.clipboard.writeText(text);
    setRelatedInterestsCopied(true); setCopyMenuOpen(null);
    setTimeout(() => setRelatedInterestsCopied(false), 2000);
  };

  const copyAllKeywords = (asList: boolean) => {
    if (!idea) return;
    const allKws = new Set<string>();
    if (idea.klp_pivots) for (const p of idea.klp_pivots) allKws.add(p.name);
    if (idea.related_interests) for (const i of idea.related_interests) allKws.add(i.name);
    if (idea.top_annotations) {
      const regex = /<a[^>]*>([^<]*)<\/a>/g;
      let match;
      while ((match = regex.exec(idea.top_annotations)) !== null) allKws.add(match[1]);
    }
    for (const pin of pins) if (pin.annotations) for (const a of pin.annotations) allKws.add(a);
    if (allKws.size === 0) return;
    navigator.clipboard.writeText(asList ? Array.from(allKws).join('\n') : Array.from(allKws).join(', '));
    setAllKwsCopied(true); setCopyMenuOpen(null);
    setTimeout(() => setAllKwsCopied(false), 2000);
  };

  const scrapeAndNavigate = async (url: string) => {
    setScrapingUrl(url);
    try {
      const response = await fetchWithTimeout('/api/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, skipIfRecent: true, language: idea?.language }) });
      const result = await response.json();
      if (result.success && result.idea) router.push(`/interests/${result.idea.id}`);
      else alert(result.error || 'Fehler beim Scrapen');
    } catch { alert('Fehler beim Scrapen'); }
    finally { setScrapingUrl(null); }
  };

  const handleRescrape = async () => {
    if (!idea?.url) return;
    setRescraping(true);
    try {
      const response = await fetchWithTimeout('/api/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: idea.url, language: idea.language }) });
      const result = await response.json();
      if (result.success && result.idea) { setIdea(result.idea); if (result.pins) setPins(result.pins); fetchData(); }
      else alert(result.error || 'Fehler beim Scrapen');
    } catch { alert('Fehler beim Scrapen'); }
    finally { setRescraping(false); }
  };

  const parseAnnotations = (html: string) => {
    const regex = /<a[^>]*>([^<]*)<\/a>\s*\((\d+)\)/g;
    const annotations: { name: string; count: number }[] = [];
    let match;
    while ((match = regex.exec(html)) !== null) annotations.push({ name: match[1], count: parseInt(match[2]) });
    return annotations.sort((a, b) => b.count - a.count);
  };

  return {
    idea, history, pins, loading, error,
    copied, scrapingUrl, rescraping,
    enlargedImage, setEnlargedImage,
    pinSortBy, pinSortOrder, handlePinSort,
    hoveredPin, setHoveredPin,
    scrapingAnnotation, scrapeAnnotation,
    scrapingAllAnnotations, annotationProgress, scrapeAllAnnotations,
    extractingKeywords, extractedKeywords, extractKeywordsFromTitles, keywordsCopied, copyExtractedKeywords,
    analyzingContent, contentAnalysis, setContentAnalysis, analyzeContentStrategy,
    klpPivotsCopied, copyKlpPivots,
    relatedInterestsCopied, copyRelatedInterests,
    allKwsCopied, copyAllKeywords,
    copyMenuOpen, setCopyMenuOpen, copyAnnotations,
    scrapeAndNavigate, handleRescrape,
    sortedPins, parseAnnotations,
    existingIds, existingNames,
  };
}
