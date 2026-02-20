'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Search, Download, Trash2, ChevronLeft, ChevronRight, ExternalLink, Filter, X,
  RefreshCw, Eye, ArrowUpDown, ArrowUp, ArrowDown, Loader2,
} from 'lucide-react';
import { Idea, InterestFilters, PaginatedResponse, CategoriesResponse } from '@/types/database';
import { formatNumber, formatDateShort } from '@/lib/format';

export default function InterestsPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(30);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState<InterestFilters>({
    search: '',
    sortBy: 'searches',
    sortOrder: 'desc',
  });
  const [categories, setCategories] = useState<CategoriesResponse>({
    mainCategories: [],
    subCategories: {},
  });
  const [availableSubCategories, setAvailableSubCategories] = useState<string[]>([]);
  const [rescraping, setRescraping] = useState(false);
  const [rescrapeProgress, setRescrapeProgress] = useState({ current: 0, total: 0, currentName: '' });

  const totalPages = Math.ceil(total / pageSize);

  const fetchIdeas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== undefined && v !== '')
        ),
      });
      const response = await fetch(`/api/interests?${params}`);
      const data: PaginatedResponse<Idea> = await response.json();
      setIdeas(data.data);
      setTotal(data.total);
    } catch (error) {
      console.error('Error fetching ideas:', error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters]);

  useEffect(() => { fetchIdeas(); }, [fetchIdeas]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/categories');
        const data: CategoriesResponse = await response.json();
        setCategories(data);
      } catch (error) { console.error('Error fetching categories:', error); }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (filters.mainCategory && categories.subCategories[filters.mainCategory]) {
      setAvailableSubCategories(categories.subCategories[filters.mainCategory]);
    } else {
      setAvailableSubCategories([]);
    }
  }, [filters.mainCategory, categories.subCategories]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); fetchIdeas(); };

  const handleDelete = async (id: string) => {
    if (!confirm('Möchtest du dieses Interest wirklich löschen?')) return;
    try {
      const response = await fetch('/api/interests', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [id] }) });
      if (response.ok) { setIdeas(ideas.filter(idea => idea.id !== id)); setTotal(total - 1); setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; }); }
    } catch (error) { console.error('Delete error:', error); }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Möchtest du ${selectedIds.size} Interests wirklich löschen?`)) return;
    try {
      const response = await fetch('/api/interests', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: Array.from(selectedIds) }) });
      if (response.ok) { setIdeas(ideas.filter(idea => !selectedIds.has(idea.id))); setTotal(total - selectedIds.size); setSelectedIds(new Set()); }
    } catch (error) { console.error('Bulk delete error:', error); }
  };

  const handleBulkRescrape = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Möchtest du ${selectedIds.size} Interests neu scrapen?`)) return;
    setRescraping(true);
    const selectedIdeas = ideas.filter(idea => selectedIds.has(idea.id));
    setRescrapeProgress({ current: 0, total: selectedIdeas.length, currentName: '' });
    try {
      for (let i = 0; i < selectedIdeas.length; i++) {
        const idea = selectedIdeas[i];
        setRescrapeProgress({ current: i + 1, total: selectedIdeas.length, currentName: idea.name });
        try { await fetch('/api/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: idea.url, language: idea.language }) }); }
        catch (err) { console.error(`Error rescraping ${idea.name}:`, err); }
        if (i < selectedIdeas.length - 1) await new Promise(resolve => setTimeout(resolve, 500));
      }
      await fetchIdeas();
      setSelectedIds(new Set());
    } finally { setRescraping(false); setRescrapeProgress({ current: 0, total: 0, currentName: '' }); }
  };

  const handleExport = async () => {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : undefined;
    try {
      const response = await fetch('/api/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, filters }) });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `pinspector-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
      }
    } catch (error) { console.error('Export error:', error); }
  };

  const toggleSelectAll = () => { selectedIds.size === ideas.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(ideas.map(idea => idea.id))); };
  const toggleSelect = (id: string) => { setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; }); };

  const handleSort = (column: 'name' | 'searches' | 'last_scrape') => {
    setFilters(prev => ({ ...prev, sortBy: column, sortOrder: prev.sortBy === column && prev.sortOrder === 'desc' ? 'asc' : 'desc' }));
    setPage(1);
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (filters.sortBy !== column) return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    return filters.sortOrder === 'asc' ? <ArrowUp className="w-4 h-4 text-red-600" /> : <ArrowDown className="w-4 h-4 text-red-600" />;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Interests</h1>
          <p className="text-gray-600 mt-1">{formatNumber(total)} Interessen in der Datenbank</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={fetchIdeas} className="p-2 text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors" title="Aktualisieren">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${showFilters ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            <Filter className="w-4 h-4" /> Filter
          </button>
          {selectedIds.size > 0 && (
            <>
              <button onClick={handleBulkRescrape} disabled={rescraping} className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50 text-sm">
                {rescraping ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} {selectedIds.size} rescrapen
              </button>
              <button onClick={handleBulkDelete} disabled={rescraping} className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50 text-sm">
                <Trash2 className="w-4 h-4" /> {selectedIds.size} löschen
              </button>
            </>
          )}
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors text-sm">
            <Download className="w-4 h-4" /> {selectedIds.size > 0 ? `${selectedIds.size} exportieren` : 'Exportieren'}
          </button>
        </div>
      </div>

      {/* Rescrape Progress */}
      {rescraping && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-blue-700 font-medium flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Rescraping...</span>
            <span className="text-blue-600 text-sm">{rescrapeProgress.current} / {rescrapeProgress.total}</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${(rescrapeProgress.current / rescrapeProgress.total) * 100}%` }} />
          </div>
          {rescrapeProgress.currentName && <p className="text-blue-600 text-sm truncate">Aktuell: {rescrapeProgress.currentName}</p>}
        </div>
      )}

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="flex-1 relative">
            <input type="text" value={filters.search || ''} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Suche nach Namen..."
              className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none" />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          </div>
          <button type="submit" className="px-6 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors">Suchen</button>
        </form>

        {showFilters && (
          <div className="p-4 bg-gray-50 rounded-lg space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hauptkategorie</label>
                <select value={filters.mainCategory || ''} onChange={(e) => { setFilters({ ...filters, mainCategory: e.target.value || undefined, subCategory: undefined }); setPage(1); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white">
                  <option value="">Alle Kategorien</option>
                  {categories.mainCategories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subkategorie</label>
                <select value={filters.subCategory || ''} onChange={(e) => { setFilters({ ...filters, subCategory: e.target.value || undefined }); setPage(1); }}
                  disabled={!filters.mainCategory || availableSubCategories.length === 0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white disabled:bg-gray-100 disabled:text-gray-400">
                  <option value="">Alle Subkategorien</option>
                  {availableSubCategories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min. Wörter</label>
                <input type="number" value={filters.minWords || ''} onChange={(e) => setFilters({ ...filters, minWords: e.target.value ? parseInt(e.target.value) : undefined })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max. Wörter</label>
                <input type="number" value={filters.maxWords || ''} onChange={(e) => setFilters({ ...filters, maxWords: e.target.value ? parseInt(e.target.value) : undefined })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="10" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min. Suchanfragen</label>
                <input type="number" value={filters.minSearches || ''} onChange={(e) => setFilters({ ...filters, minSearches: e.target.value ? parseInt(e.target.value) : undefined })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max. Suchanfragen</label>
                <input type="number" value={filters.maxSearches || ''} onChange={(e) => setFilters({ ...filters, maxSearches: e.target.value ? parseInt(e.target.value) : undefined })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="1000000" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sortieren nach</label>
                <select value={filters.sortBy || 'last_scrape'} onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as InterestFilters['sortBy'] })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="last_scrape">Zuletzt gescraped</option>
                  <option value="name">Name</option>
                  <option value="searches">Suchanfragen</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reihenfolge</label>
                <select value={filters.sortOrder || 'desc'} onChange={(e) => setFilters({ ...filters, sortOrder: e.target.value as 'asc' | 'desc' })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="desc">Absteigend</option>
                  <option value="asc">Aufsteigend</option>
                </select>
              </div>
              <div className="col-span-2 flex items-end">
                <button onClick={() => { setFilters({ search: '', sortBy: 'searches', sortOrder: 'desc' }); setPage(1); }} className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900">
                  <X className="w-4 h-4" /> Filter zurücksetzen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input type="checkbox" checked={ideas.length > 0 && selectedIds.size === ideas.length} onChange={toggleSelectAll} className="rounded border-gray-300" />
                </th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort('name')} className="flex items-center gap-1 text-sm font-semibold text-gray-700 hover:text-red-700 transition-colors">Name <SortIcon column="name" /></button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button onClick={() => handleSort('searches')} className="flex items-center gap-1 text-sm font-semibold text-gray-700 hover:text-red-700 transition-colors ml-auto">Suchanfragen <SortIcon column="searches" /></button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Kategorien</th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort('last_scrape')} className="flex items-center gap-1 text-sm font-semibold text-gray-700 hover:text-red-700 transition-colors">Gescraped <SortIcon column="last_scrape" /></button>
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />Lade Daten...</td></tr>
              ) : ideas.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">Keine Interessen gefunden</td></tr>
              ) : (
                ideas.map((idea) => (
                  <tr key={idea.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.has(idea.id)} onChange={() => toggleSelect(idea.id)} className="rounded border-gray-300" /></td>
                    <td className="px-4 py-3">
                      <Link href={`/interests/${idea.id}`} className="font-medium text-red-700 hover:text-red-900 hover:underline">{idea.name}</Link>
                      <div className="text-xs text-gray-500 font-mono">{idea.id}</div>
                    </td>
                    <td className="px-4 py-3 text-right"><span className="font-semibold text-red-700">{formatNumber(idea.searches)}</span></td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-600 truncate max-w-xs">
                        {idea.seo_breadcrumbs?.map((crumb: string | { name: string }) => typeof crumb === 'string' ? crumb : crumb.name).join(' > ') || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDateShort(idea.last_scrape)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link href={`/interests/${idea.id}`} className="p-2 text-gray-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors" title="Details anzeigen"><Eye className="w-4 h-4" /></Link>
                        <a href={idea.url || '#'} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors" title="Auf Pinterest öffnen"><ExternalLink className="w-4 h-4" /></a>
                        <button onClick={() => handleDelete(idea.id)} className="p-2 text-gray-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors" title="Löschen"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">Seite {page} von {totalPages}</div>
            <div className="flex gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"><ChevronRight className="w-5 h-5" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-red-600" /></div>
        ) : ideas.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Keine Interessen gefunden</div>
        ) : (
          ideas.map((idea) => (
            <div key={idea.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <input type="checkbox" checked={selectedIds.has(idea.id)} onChange={() => toggleSelect(idea.id)} className="rounded border-gray-300 mt-1" />
                  <div className="min-w-0">
                    <Link href={`/interests/${idea.id}`} className="font-medium text-red-700 hover:text-red-900 hover:underline block truncate">{idea.name}</Link>
                    <div className="text-sm text-gray-600 truncate mt-0.5">
                      {idea.seo_breadcrumbs?.map((crumb: string | { name: string }) => typeof crumb === 'string' ? crumb : crumb.name).join(' > ') || '-'}
                    </div>
                  </div>
                </div>
                <span className="font-bold text-red-700 whitespace-nowrap text-lg">{formatNumber(idea.searches)}</span>
              </div>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-500">{formatDateShort(idea.last_scrape)}</span>
                <div className="flex gap-1">
                  <Link href={`/interests/${idea.id}`} className="p-1.5 text-gray-400 hover:text-red-700 rounded" title="Details"><Eye className="w-4 h-4" /></Link>
                  <a href={idea.url || '#'} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 hover:text-red-700 rounded" title="Pinterest"><ExternalLink className="w-4 h-4" /></a>
                  <button onClick={() => handleDelete(idea.id)} className="p-1.5 text-gray-400 hover:text-red-700 rounded" title="Löschen"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between py-3">
            <div className="text-sm text-gray-600">Seite {page} von {totalPages}</div>
            <div className="flex gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 hover:bg-gray-100"><ChevronLeft className="w-5 h-5" /></button>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 hover:bg-gray-100"><ChevronRight className="w-5 h-5" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
