'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Search, Loader2, ExternalLink, Tag, User, Layout, Globe,
  Calendar, Heart, MessageCircle, Repeat, Video, Link2,
} from 'lucide-react';

interface PinAnnotation {
  name: string;
  url: string;
}

interface PinData {
  id: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  image_thumbnail_url: string | null;
  link: string;
  article_url: string | null;
  repin_count: number;
  save_count: number;
  comment_count: number;
  annotations: PinAnnotation[];
  pin_created_at: string | null;
  domain: string | null;
  board: { id: string | null; name: string | null; url: string | null };
  pinner: { id: string | null; username: string | null; full_name: string | null; image_url: string | null };
  is_video: boolean;
  is_promoted: boolean;
  rich_metadata: { type: string | null; title: string | null; description: string | null; url: string | null; site_name: string | null } | null;
  scraped_at: string;
}

export default function PinLivePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-red-600" /></div>}>
      <PinLiveContent />
    </Suspense>
  );
}

function PinLiveContent() {
  const searchParams = useSearchParams();
  const initialPinId = searchParams.get('pinId') || '';
  const initialUrl = searchParams.get('url') || '';

  const [input, setInput] = useState(initialUrl || (initialPinId ? `https://www.pinterest.com/pin/${initialPinId}/` : ''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState<PinData | null>(null);
  const [autoLoaded, setAutoLoaded] = useState(false);

  const loadPin = async (pinIdOrUrl?: string) => {
    const value = pinIdOrUrl || input.trim();
    if (!value) return;

    setLoading(true);
    setError(null);

    try {
      const isUrl = value.includes('pinterest');
      const params = isUrl
        ? `url=${encodeURIComponent(value)}&language=de`
        : `pinId=${value}&language=de`;

      const res = await fetch(`/api/pin-live?${params}`);
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Fehler beim Laden');
        setPin(null);
      } else {
        setPin(data.pin);
      }
    } catch {
      setError('Netzwerkfehler');
      setPin(null);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load if pinId or url is in query params
  if ((initialPinId || initialUrl) && !autoLoaded && !loading && !pin && !error) {
    setAutoLoaded(true);
    loadPin(initialUrl || initialPinId);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Pin Live Inspector</h1>

      {/* Search */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && loadPin()}
          placeholder="Pinterest Pin-URL oder Pin-ID eingeben..."
          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
        />
        <button
          onClick={() => loadPin()}
          disabled={loading || !input.trim()}
          className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Scrape
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-6">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-red-600" />
        </div>
      )}

      {/* Results */}
      {pin && !loading && (
        <div className="space-y-4">
          {/* Pin Header */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="md:flex">
              {pin.image_url && (
                <div className="md:w-64 shrink-0 bg-gray-100">
                  <img src={pin.image_url} alt={pin.title || 'Pin'} className="w-full h-auto md:h-full object-cover" />
                </div>
              )}
              <div className="p-5 flex-1">
                <h2 className="text-lg font-bold text-gray-900 mb-2">{pin.title || 'Kein Titel'}</h2>
                {pin.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-4">{pin.description}</p>
                )}

                {/* Stats Row */}
                <div className="flex flex-wrap gap-3 mb-4">
                  <Stat icon={<Heart className="w-3.5 h-3.5" />} label="Saves" value={pin.save_count} />
                  <Stat icon={<Repeat className="w-3.5 h-3.5" />} label="Repins" value={pin.repin_count} />
                  <Stat icon={<MessageCircle className="w-3.5 h-3.5" />} label="Comments" value={pin.comment_count} />
                  {pin.is_video && <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full"><Video className="w-3 h-3" /> Video</span>}
                </div>

                {/* Meta Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {pin.board?.name && (
                    <MetaRow icon={<Layout className="w-3.5 h-3.5" />} label="Board">
                      {pin.board.url
                        ? <a href={pin.board.url} target="_blank" className="text-blue-600 hover:underline">{pin.board.name}</a>
                        : pin.board.name}
                    </MetaRow>
                  )}
                  {pin.pinner?.full_name && (
                    <MetaRow icon={<User className="w-3.5 h-3.5" />} label="Pinner">
                      {pin.pinner.username
                        ? <a href={`https://pinterest.com/${pin.pinner.username}/`} target="_blank" className="text-blue-600 hover:underline">{pin.pinner.full_name}</a>
                        : pin.pinner.full_name}
                    </MetaRow>
                  )}
                  {pin.domain && (
                    <MetaRow icon={<Globe className="w-3.5 h-3.5" />} label="Domain">{pin.domain}</MetaRow>
                  )}
                  {pin.pin_created_at && (
                    <MetaRow icon={<Calendar className="w-3.5 h-3.5" />} label="Erstellt">
                      {new Date(pin.pin_created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </MetaRow>
                  )}
                </div>

                {/* Links */}
                <div className="flex flex-wrap gap-2 mt-4">
                  <a href={pin.link} target="_blank" className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-full hover:bg-red-200">
                    <ExternalLink className="w-3 h-3" /> Pin auf Pinterest
                  </a>
                  {pin.article_url && (
                    <a href={pin.article_url} target="_blank" className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full hover:bg-blue-200">
                      <Link2 className="w-3 h-3" /> Originalartikel
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Annotations */}
          {pin.annotations.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Tag className="w-4 h-4 text-red-600" />
                Annotations ({pin.annotations.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {pin.annotations.map((ann, i) => (
                  <a
                    key={i}
                    href={ann.url}
                    target="_blank"
                    className="inline-flex items-center px-3 py-1.5 bg-red-50 text-red-700 rounded-full text-sm hover:bg-red-100 transition-colors border border-red-200"
                  >
                    {ann.name}
                    <ExternalLink className="w-3 h-3 ml-1.5 opacity-50" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Rich Metadata */}
          {pin.rich_metadata?.title && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Rich Pin Metadata</h3>
              <div className="text-sm space-y-1">
                <p><span className="text-gray-500">Titel:</span> {pin.rich_metadata.title}</p>
                {pin.rich_metadata.description && (
                  <p><span className="text-gray-500">Description:</span> {pin.rich_metadata.description}</p>
                )}
                {pin.rich_metadata.site_name && (
                  <p><span className="text-gray-500">Site:</span> {pin.rich_metadata.site_name}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <span className="flex items-center gap-1.5 text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
      {icon} {value} {label}
    </span>
  );
}

function MetaRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-gray-700">
      <span className="text-gray-400">{icon}</span>
      <span className="text-gray-500">{label}:</span>
      <span className="font-medium truncate">{children}</span>
    </div>
  );
}
