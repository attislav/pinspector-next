'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ExternalLink,
  FileText,
  ImageIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  ChevronLeft,
  ChevronRight,
  Pin as PinIcon,
  Heart,
  MessageCircle,
  Repeat2,
  Link2
} from 'lucide-react';

interface PinIdea {
  id: string;
  name: string;
}

interface Pin {
  id: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  image_thumbnail_url: string | null;
  link: string | null;
  article_url: string | null;
  repin_count: number;
  save_count: number;
  comment_count: number;
  annotations: string[] | null;
  pin_created_at: string | null;
  last_scrape: string | null;
  ideas: PinIdea[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type SortKey = 'save_count' | 'repin_count' | 'comment_count' | 'pin_created_at' | 'title';

export default function PinsPage() {
  const router = useRouter();
  const [pins, setPins] = useState<Pin[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [minSaves, setMinSaves] = useState('');
  const [maxSaves, setMaxSaves] = useState('');
  const [hasArticle, setHasArticle] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('save_count');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Ideas for filter
  const [ideas, setIdeas] = useState<{ id: string; name: string }[]>([]);
  const [selectedIdeaId, setSelectedIdeaId] = useState('');
  const [ideaSearch, setIdeaSearch] = useState('');
  const [showIdeaSuggestions, setShowIdeaSuggestions] = useState(false);

  useEffect(() => {
    fetchIdeas();
  }, []);

  useEffect(() => {
    fetchPins();
  }, [pagination.page, sortBy, sortOrder]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.interest-filter')) {
        setShowIdeaSuggestions(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchIdeas = async () => {
    try {
      const response = await fetch('/api/interests?pageSize=1000&sortBy=name&sortOrder=asc');
      const data = await response.json();
      if (data.data) {
        setIdeas(data.data.map((i: { id: string; name: string }) => ({ id: i.id, name: i.name })));
      }
    } catch (error) {
      console.error('Error fetching ideas:', error);
    }
  };

  const fetchPins = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (selectedIdeaId) params.set('ideaId', selectedIdeaId);
      if (minSaves) params.set('minSaves', minSaves);
      if (maxSaves) params.set('maxSaves', maxSaves);
      if (hasArticle) params.set('hasArticle', hasArticle);
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
      params.set('page', pagination.page.toString());
      params.set('limit', pagination.limit.toString());

      const response = await fetch(`/api/pins?${params.toString()}`);
      const data = await response.json();

      setPins(data.pins || []);
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
    } catch (error) {
      console.error('Error fetching pins:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchPins();
  };

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('desc');
    }
  };

  const resetFilters = () => {
    setSearch('');
    setSelectedIdeaId('');
    setIdeaSearch('');
    setMinSaves('');
    setMaxSaves('');
    setHasArticle('');
    setSortBy('save_count');
    setSortOrder('desc');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Filter ideas based on search input
  const filteredIdeas = ideaSearch.length >= 2
    ? ideas.filter(idea => idea.name.toLowerCase().includes(ideaSearch.toLowerCase())).slice(0, 10)
    : [];

  const selectIdea = (idea: { id: string; name: string }) => {
    setSelectedIdeaId(idea.id);
    setIdeaSearch(idea.name);
    setShowIdeaSuggestions(false);
  };

  const clearIdeaSelection = () => {
    setSelectedIdeaId('');
    setIdeaSearch('');
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    }
    return sortOrder === 'asc'
      ? <ArrowUp className="w-3 h-3 text-red-600" />
      : <ArrowDown className="w-3 h-3 text-red-600" />;
  };

  const formatNumber = (num: number) => new Intl.NumberFormat('de-DE').format(num);

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-red-900 mb-2">Pins</h1>
        <p className="text-gray-600">
          {formatNumber(pagination.total)} Pins in der Datenbank
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <span className="flex items-center gap-2 font-medium text-gray-900">
            <Filter className="w-5 h-5 text-red-600" />
            Filter
          </span>
          {showFilters ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {showFilters && (
          <div className="p-4 pt-0 border-t border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Suche</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Titel oder Beschreibung..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
              </div>

              {/* Interest Filter */}
              <div className="relative interest-filter">
                <label className="block text-sm font-medium text-gray-700 mb-1">Interest</label>
                <div className="relative">
                  <input
                    type="text"
                    value={ideaSearch}
                    onChange={(e) => {
                      setIdeaSearch(e.target.value);
                      setShowIdeaSuggestions(true);
                      if (!e.target.value) {
                        setSelectedIdeaId('');
                      }
                    }}
                    onFocus={() => setShowIdeaSuggestions(true)}
                    placeholder="Interest suchen..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 pr-8"
                  />
                  {selectedIdeaId && (
                    <button
                      onClick={clearIdeaSelection}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {showIdeaSuggestions && filteredIdeas.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredIdeas.map(idea => (
                      <button
                        key={idea.id}
                        onClick={() => selectIdea(idea)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 hover:text-red-700"
                      >
                        {idea.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Min Saves */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min. Saves</label>
                <input
                  type="number"
                  value={minSaves}
                  onChange={(e) => setMinSaves(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              {/* Max Saves */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max. Saves</label>
                <input
                  type="number"
                  value={maxSaves}
                  onChange={(e) => setMaxSaves(e.target.value)}
                  placeholder="∞"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              {/* Has Article */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Artikel-Link</label>
                <select
                  value={hasArticle}
                  onChange={(e) => setHasArticle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">Alle</option>
                  <option value="true">Mit Artikel</option>
                  <option value="false">Ohne Artikel</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Suchen
              </button>
              <button
                onClick={resetFilters}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Zurücksetzen
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Image Modal */}
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

      {/* Pins Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-red-600" />
          </div>
        ) : pins.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Keine Pins gefunden
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-3 font-semibold text-gray-700">Bild</th>
                    <th className="text-left py-3 px-3">
                      <button
                        onClick={() => handleSort('title')}
                        className="flex items-center gap-1 font-semibold text-gray-700 hover:text-red-700"
                      >
                        Titel <SortIcon column="title" />
                      </button>
                    </th>
                    <th className="text-left py-3 px-3 font-semibold text-gray-700">Interests</th>
                    <th className="text-left py-3 px-3">
                      <button
                        onClick={() => handleSort('pin_created_at')}
                        className="flex items-center gap-1 font-semibold text-gray-700 hover:text-red-700"
                      >
                        Erstellt <SortIcon column="pin_created_at" />
                      </button>
                    </th>
                    <th className="text-right py-3 px-3">
                      <button
                        onClick={() => handleSort('save_count')}
                        className="flex items-center gap-1 font-semibold text-gray-700 hover:text-red-700 ml-auto"
                        title="Saves"
                      >
                        <PinIcon className="w-4 h-4" /> <SortIcon column="save_count" />
                      </button>
                    </th>
                    <th className="text-right py-3 px-3">
                      <button
                        onClick={() => handleSort('repin_count')}
                        className="flex items-center gap-1 font-semibold text-gray-700 hover:text-red-700 ml-auto"
                        title="Repins"
                      >
                        <Repeat2 className="w-4 h-4" /> <SortIcon column="repin_count" />
                      </button>
                    </th>
                    <th className="text-right py-3 px-3">
                      <button
                        onClick={() => handleSort('comment_count')}
                        className="flex items-center gap-1 font-semibold text-gray-700 hover:text-red-700 ml-auto"
                        title="Kommentare"
                      >
                        <MessageCircle className="w-4 h-4" /> <SortIcon column="comment_count" />
                      </button>
                    </th>
                    <th className="text-center py-3 px-3 font-semibold text-gray-700">Links</th>
                  </tr>
                </thead>
                <tbody>
                  {pins.map((pin) => (
                    <tr key={pin.id} className="border-b border-gray-100 hover:bg-gray-50">
                      {/* Thumbnail */}
                      <td className="py-2 px-3">
                        <div
                          className="w-12 h-16 bg-gray-100 rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-red-400 transition-all"
                          onClick={() => setEnlargedImage(pin.image_url)}
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
                      <td className="py-2 px-3 max-w-[250px]">
                        <span className="line-clamp-2 text-gray-900" title={pin.title || ''}>
                          {pin.title || '-'}
                        </span>
                        {pin.description && (
                          <span className="line-clamp-1 text-gray-500 text-xs mt-1" title={pin.description}>
                            {pin.description}
                          </span>
                        )}
                      </td>
                      {/* Interests */}
                      <td className="py-2 px-3">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {pin.ideas.slice(0, 3).map((idea) => (
                            <button
                              key={idea.id}
                              onClick={() => router.push(`/interests/${idea.id}`)}
                              className="text-xs px-2 py-0.5 bg-red-50 text-red-700 rounded-full hover:bg-red-100 transition-colors truncate max-w-[150px]"
                              title={idea.name}
                            >
                              {idea.name}
                            </button>
                          ))}
                          {pin.ideas.length > 3 && (
                            <span className="text-xs text-gray-500">+{pin.ideas.length - 3}</span>
                          )}
                        </div>
                      </td>
                      {/* Created Date */}
                      <td className="py-2 px-3 text-gray-500 whitespace-nowrap">
                        {formatDate(pin.pin_created_at)}
                      </td>
                      {/* Saves */}
                      <td className="py-2 px-3 text-right font-medium text-gray-900">
                        {formatNumber(pin.save_count)}
                      </td>
                      {/* Repins */}
                      <td className="py-2 px-3 text-right font-medium text-gray-900">
                        {formatNumber(pin.repin_count)}
                      </td>
                      {/* Comments */}
                      <td className="py-2 px-3 text-right font-medium text-gray-900">
                        {formatNumber(pin.comment_count)}
                      </td>
                      {/* Links */}
                      <td className="py-2 px-3">
                        <div className="flex items-center justify-center gap-2">
                          {pin.link && (
                            <a
                              href={pin.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-red-600 hover:text-red-800"
                              title="Pin auf Pinterest"
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

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Seite {pagination.page} von {pagination.totalPages} ({formatNumber(pagination.total)} Pins)
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page <= 1}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= pagination.totalPages}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
