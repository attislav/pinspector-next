'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle, XCircle, Clock, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';

interface SyncLogEntry {
  id: number;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed';
  idea_id: string | null;
  idea_name: string | null;
  idea_searches: number | null;
  language: string | null;
  score: number | null;
  annotations_total: number;
  annotations_scraped: number;
  new_created: number;
  existing_updated: number;
  failed: number;
  error: string | null;
  debug_log: string | null;
}

function formatDuration(started: string, completed: string | null): string {
  if (!completed) return '...';
  const ms = new Date(completed).getTime() - new Date(started).getTime();
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <CheckCircle className="w-3 h-3" /> OK
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <XCircle className="w-3 h-3" /> Fehler
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
      <RefreshCw className="w-3 h-3 animate-spin" /> Läuft
    </span>
  );
}

export default function SyncLogPage() {
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/sync-logs');
      const data = await res.json();
      if (data.success) setLogs(data.logs);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLogs();
    // Auto-refresh every 10s if there are running entries
    const interval = setInterval(() => {
      fetchLogs();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const hasRunning = logs.some(l => l.status === 'running');
  const totalCompleted = logs.filter(l => l.status === 'completed').length;
  const totalFailed = logs.filter(l => l.status === 'failed').length;
  const totalNew = logs.reduce((sum, l) => sum + l.new_created, 0);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-red-900">Sync Log</h1>
            <p className="text-gray-500 text-sm mt-1">Auto-Scrape Verlauf</p>
          </div>
          <button
            onClick={() => { setLoading(true); fetchLogs(); }}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </button>
        </div>

        {/* Summary */}
        <div className="flex gap-4 mt-4">
          <div className="px-3 py-1.5 bg-green-50 rounded-lg text-sm">
            <span className="text-green-600 font-medium">{totalCompleted}</span> <span className="text-green-500">erfolgreich</span>
          </div>
          <div className="px-3 py-1.5 bg-red-50 rounded-lg text-sm">
            <span className="text-red-600 font-medium">{totalFailed}</span> <span className="text-red-500">fehlgeschlagen</span>
          </div>
          <div className="px-3 py-1.5 bg-blue-50 rounded-lg text-sm">
            <span className="text-blue-600 font-medium">{totalNew}</span> <span className="text-blue-500">neue Ideas</span>
          </div>
          {hasRunning && (
            <div className="px-3 py-1.5 bg-yellow-50 rounded-lg text-sm flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin text-yellow-600" />
              <span className="text-yellow-600 font-medium">Scrape läuft...</span>
            </div>
          )}
        </div>
      </div>

      {loading && logs.length === 0 ? (
        <div className="flex items-center justify-center min-h-[30vh]">
          <RefreshCw className="w-8 h-8 animate-spin text-red-600" />
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center text-gray-500">
          Noch keine Sync-Einträge vorhanden.
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Datum</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Idea</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Vol.</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Score</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Annot.</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Neu</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Upd.</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Fail</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Dauer</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr className={`border-b border-gray-100 hover:bg-gray-50 ${(log.debug_log || log.error) ? 'cursor-pointer' : ''}`}
                      onClick={() => (log.debug_log || log.error) && setExpandedLog(expandedLog === log.id ? null : log.id)}>
                      <td className="py-2.5 px-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          {(log.debug_log || log.error) && (
                            expandedLog === log.id
                              ? <ChevronUp className="w-3 h-3 text-gray-400" />
                              : <ChevronDown className="w-3 h-3 text-gray-400" />
                          )}
                          {formatDateTime(log.started_at)}
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        {log.idea_id ? (
                          <Link href={`/interests/${log.idea_id}`} className="text-sm text-red-700 hover:text-red-900 hover:underline flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}>
                            {log.idea_name || log.idea_id}
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-sm text-right text-gray-700">
                        {log.idea_searches ? log.idea_searches.toLocaleString('de-DE') : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-sm text-right text-gray-500">
                        {log.score ? log.score.toFixed(1) : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-sm text-right text-gray-700">
                        {log.annotations_scraped}/{log.annotations_total}
                      </td>
                      <td className="py-2.5 px-4 text-sm text-right">
                        {log.new_created > 0 ? (
                          <span className="text-green-600 font-medium">+{log.new_created}</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-sm text-right">
                        {log.existing_updated > 0 ? (
                          <span className="text-blue-600">{log.existing_updated}</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-sm text-right">
                        {log.failed > 0 ? (
                          <span className="text-red-600">{log.failed}</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <StatusBadge status={log.status} />
                      </td>
                      <td className="py-2.5 px-4 text-xs text-right text-gray-500">
                        {formatDuration(log.started_at, log.completed_at)}
                      </td>
                    </tr>
                    {expandedLog === log.id && (log.debug_log || log.error) && (
                      <tr className="bg-gray-50">
                        <td colSpan={10} className="px-4 py-3">
                          {log.error && (
                            <div className="mb-2 text-xs text-red-600 bg-red-50 p-2 rounded font-medium">
                              Error: {log.error}
                            </div>
                          )}
                          {log.debug_log && (
                            <pre className="text-xs text-gray-600 bg-gray-100 p-3 rounded font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                              {log.debug_log}
                            </pre>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">{formatDateTime(log.started_at)}</span>
                  <StatusBadge status={log.status} />
                </div>
                {log.idea_id ? (
                  <Link href={`/interests/${log.idea_id}`} className="text-sm font-medium text-red-700 hover:underline block mb-2">
                    {log.idea_name || log.idea_id}
                  </Link>
                ) : (
                  <p className="text-sm text-gray-400 mb-2">-</p>
                )}
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>Vol: {log.idea_searches?.toLocaleString('de-DE') || '-'}</span>
                  <span>Score: {log.score?.toFixed(1) || '-'}</span>
                  <span>Dauer: {formatDuration(log.started_at, log.completed_at)}</span>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-xs">
                  <span className="text-gray-500">Annot: {log.annotations_scraped}/{log.annotations_total}</span>
                  {log.new_created > 0 && <span className="text-green-600">+{log.new_created} neu</span>}
                  {log.existing_updated > 0 && <span className="text-blue-600">{log.existing_updated} upd</span>}
                  {log.failed > 0 && <span className="text-red-600">{log.failed} fail</span>}
                </div>
                {(log.error || log.debug_log) && (
                  <button
                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                    className="mt-2 text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  >
                    {expandedLog === log.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    Debug Log
                  </button>
                )}
                {expandedLog === log.id && (
                  <div className="mt-2">
                    {log.error && (
                      <p className="text-xs text-red-600 bg-red-50 p-2 rounded mb-2">{log.error}</p>
                    )}
                    {log.debug_log && (
                      <pre className="text-xs text-gray-600 bg-gray-100 p-2 rounded font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {log.debug_log}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
