'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus, Trash2, Copy, List, Download, Pencil, Check, X, FolderOpen, ChevronDown, ChevronRight, CheckCircle, Circle, Loader2,
} from 'lucide-react';
import { useKeywordCollections } from '@/context/KeywordCollectionContext';
import { KeywordCollectionItem } from '@/types/database';
import { formatShortDate, formatNumber } from '@/lib/format';

export default function CollectionsPage() {
  const {
    collections, createCollection, deleteCollection, renameCollection,
    addItems, removeItem, updateItems, toggleItemDone, toggleItemsDone,
  } = useKeywordCollections();
  const [newCollectionName, setNewCollectionName] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [addingKeywordId, setAddingKeywordId] = useState<string | null>(null);
  const [newKeyword, setNewKeyword] = useState('');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [editingKeywordsId, setEditingKeywordsId] = useState<string | null>(null);
  const [bulkText, setBulkText] = useState('');
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [lookupLoading, setLookupLoading] = useState<string | null>(null);

  const lookupSearchVolumes = useCallback(async (collectionId: string, keywords: string[]) => {
    try {
      setLookupLoading(collectionId);
      const res = await fetch('/api/keywords-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords }),
      });
      if (!res.ok) return;
      const { results } = await res.json();
      if (!results || Object.keys(results).length === 0) return;

      // Read fresh state from localStorage to avoid stale closure
      const stored = localStorage.getItem('pinspector-keyword-collections');
      if (!stored) return;
      const allCollections = JSON.parse(stored);
      const collection = allCollections.find((c: { id: string }) => c.id === collectionId);
      if (!collection) return;

      let changed = false;
      const updatedItems = collection.items.map((item: KeywordCollectionItem) => {
        const match = results[item.keyword.toLowerCase()];
        if (match && item.searches === 0) {
          changed = true;
          return { ...item, searches: match.searches, id: match.id };
        }
        return item;
      });

      if (changed) {
        updateItems(collectionId, updatedItems);
      }
    } catch (e) {
      console.error('Search volume lookup failed:', e);
    } finally {
      setLookupLoading(null);
    }
  }, [updateItems]);

  const handleCreate = () => {
    if (!newCollectionName.trim()) return;
    const c = createCollection(newCollectionName.trim());
    setNewCollectionName('');
    setExpandedId(c.id);
  };

  const handleRename = (id: string) => {
    if (!editName.trim()) return;
    renameCollection(id, editName.trim());
    setEditingId(null);
  };

  const handleAddKeyword = (collectionId: string) => {
    if (!newKeyword.trim()) return;
    const keywords = newKeyword.split(',').map(k => k.trim()).filter(Boolean);
    const items: KeywordCollectionItem[] = keywords.map(k => ({ keyword: k, searches: 0 }));
    addItems(collectionId, items);
    setNewKeyword('');
    // Auto-populate search volumes from DB
    lookupSearchVolumes(collectionId, keywords);
  };

  const showCopyFeedback = (msg: string) => {
    setCopyFeedback(msg);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const handleCopy = async (items: KeywordCollectionItem[], asList: boolean) => {
    const text = asList ? items.map(i => i.keyword).join('\n') : items.map(i => i.keyword).join(', ');
    await navigator.clipboard.writeText(text);
    showCopyFeedback(asList ? 'Liste kopiert!' : 'Kommaliste kopiert!');
  };

  const handleCopySingle = async (keyword: string) => {
    await navigator.clipboard.writeText(keyword);
    showCopyFeedback(`"${keyword}" kopiert!`);
  };

  const handleCopySelected = async (items: KeywordCollectionItem[], asList: boolean) => {
    const selected = items.filter(i => selectedKeywords.has(i.keyword));
    if (selected.length === 0) return;
    const text = asList ? selected.map(i => i.keyword).join('\n') : selected.map(i => i.keyword).join(', ');
    await navigator.clipboard.writeText(text);
    showCopyFeedback(`${selected.length} Keywords kopiert!`);
  };

  const handleExport = (name: string, items: KeywordCollectionItem[]) => {
    const bom = '\uFEFF';
    const csv = bom + 'Keyword,Searches\n' + items.map(i => `"${i.keyword.replace(/"/g, '""')}",${i.searches}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '_')}-keywords.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const startBulkEdit = (collectionId: string, items: KeywordCollectionItem[]) => {
    setEditingKeywordsId(collectionId);
    setBulkText(items.map(i => `${i.keyword}\t${i.searches}`).join('\n'));
  };

  const saveBulkEdit = (collectionId: string) => {
    const items: KeywordCollectionItem[] = bulkText.split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      const parts = trimmed.split('\t');
      const keyword = parts[0]?.trim();
      const searches = parts[1] ? parseInt(parts[1].trim(), 10) || 0 : 0;
      return keyword ? { keyword, searches } : null;
    }).filter((i): i is KeywordCollectionItem => i !== null);
    updateItems(collectionId, items);
    setEditingKeywordsId(null);
    setBulkText('');
    // Auto-populate search volumes for items that have 0 searches
    const zeroSearchItems = items.filter(i => i.searches === 0);
    if (zeroSearchItems.length > 0) {
      lookupSearchVolumes(collectionId, zeroSearchItems.map(i => i.keyword));
    }
  };

  const toggleKeyword = (keyword: string) => {
    setSelectedKeywords(prev => {
      const next = new Set(prev);
      next.has(keyword) ? next.delete(keyword) : next.add(keyword);
      return next;
    });
  };

  const toggleAllKeywords = (items: KeywordCollectionItem[]) => {
    const allSelected = items.every(i => selectedKeywords.has(i.keyword));
    if (allSelected) {
      setSelectedKeywords(prev => { const next = new Set(prev); items.forEach(i => next.delete(i.keyword)); return next; });
    } else {
      setSelectedKeywords(prev => { const next = new Set(prev); items.forEach(i => next.add(i.keyword)); return next; });
    }
  };

  const selectedCountFor = (items: KeywordCollectionItem[]) => items.filter(i => selectedKeywords.has(i.keyword)).length;

  const totalKeywords = collections.reduce((sum, c) => sum + c.items.length, 0);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Keyword-Sammlungen</h1>
          <p className="text-gray-600 mt-1">
            {collections.length} Sammlung{collections.length !== 1 ? 'en' : ''} mit insgesamt {totalKeywords} Keywords
          </p>
        </div>
      </div>

      {copyFeedback && (
        <div className="fixed top-4 right-4 z-50">
          <span className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm shadow-lg">{copyFeedback}</span>
        </div>
      )}

      {/* Create new collection */}
      <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="flex gap-3">
          <input
            type="text"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            placeholder="Neue Sammlung erstellen..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
          />
          <button
            type="submit"
            disabled={!newCollectionName.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Erstellen
          </button>
        </form>
      </div>

      {/* Collections list */}
      {collections.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FolderOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Noch keine Sammlungen</p>
          <p className="text-sm mt-1">Erstelle eine neue Sammlung oder wähle Keywords auf der Interests-Seite aus.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {collections.map(collection => {
            const isExpanded = expandedId === collection.id;
            const isEditing = editingId === collection.id;
            const isBulkEditing = editingKeywordsId === collection.id;
            const selCount = selectedCountFor(collection.items);

            return (
              <div key={collection.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => { setExpandedId(isExpanded ? null : collection.id); setSelectedKeywords(new Set()); }}
                >
                  {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" /> : <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />}

                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <form
                        onSubmit={(e) => { e.preventDefault(); handleRename(collection.id); }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex gap-2"
                      >
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-amber-500 outline-none"
                          autoFocus
                        />
                        <button type="submit" className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
                        <button type="button" onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
                      </form>
                    ) : (
                      <div>
                        <span className="font-semibold text-gray-900">{collection.name}</span>
                        <span className="ml-2 text-sm text-gray-500">{collection.items.length} Keywords</span>
                        {collection.items.some(i => i.done) && (
                          <span className="ml-1.5 text-xs text-green-600">{collection.items.filter(i => i.done).length} erledigt</span>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      Erstellt: {formatShortDate(collection.createdAt)} | Aktualisiert: {formatShortDate(collection.updatedAt)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleCopy(collection.items, false)}
                      disabled={collection.items.length === 0}
                      className="p-1.5 text-gray-400 hover:text-green-700 hover:bg-green-50 rounded transition-colors disabled:opacity-30"
                      title="Alle als Kommaliste kopieren"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleCopy(collection.items, true)}
                      disabled={collection.items.length === 0}
                      className="p-1.5 text-gray-400 hover:text-green-700 hover:bg-green-50 rounded transition-colors disabled:opacity-30"
                      title="Alle als Liste kopieren"
                    >
                      <List className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleExport(collection.name, collection.items)}
                      disabled={collection.items.length === 0}
                      className="p-1.5 text-gray-400 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors disabled:opacity-30"
                      title="Als CSV exportieren"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setEditingId(collection.id); setEditName(collection.name); }}
                      className="p-1.5 text-gray-400 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
                      title="Umbenennen"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { if (confirm(`"${collection.name}" wirklich löschen?`)) deleteCollection(collection.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                      title="Löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-gray-200 px-4 py-3">
                    {/* Action bar */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {addingKeywordId === collection.id ? (
                        <form
                          onSubmit={(e) => { e.preventDefault(); handleAddKeyword(collection.id); }}
                          className="flex gap-2 flex-1"
                        >
                          <input
                            type="text"
                            value={newKeyword}
                            onChange={(e) => setNewKeyword(e.target.value)}
                            placeholder="Keywords eingeben (kommagetrennt)..."
                            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                            autoFocus
                          />
                          <button type="submit" disabled={!newKeyword.trim()} className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50">
                            Hinzufügen
                          </button>
                          <button type="button" onClick={() => { setAddingKeywordId(null); setNewKeyword(''); }} className="px-3 py-1.5 text-gray-500 text-sm hover:bg-gray-100 rounded-lg">
                            Abbrechen
                          </button>
                        </form>
                      ) : (
                        <>
                          <button
                            onClick={() => setAddingKeywordId(collection.id)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" /> Keyword hinzufügen
                          </button>
                          {collection.items.length > 0 && (
                            <button
                              onClick={() => isBulkEditing ? saveBulkEdit(collection.id) : startBulkEdit(collection.id, collection.items)}
                              className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" /> {isBulkEditing ? 'Speichern' : 'Alle bearbeiten'}
                            </button>
                          )}
                          {isBulkEditing && (
                            <button
                              onClick={() => { setEditingKeywordsId(null); setBulkText(''); }}
                              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              Abbrechen
                            </button>
                          )}
                          {selCount > 0 && (
                            <>
                              <button
                                onClick={() => handleCopySelected(collection.items, false)}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                              >
                                <Copy className="w-3.5 h-3.5" /> {selCount} als Kommaliste
                              </button>
                              <button
                                onClick={() => handleCopySelected(collection.items, true)}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                              >
                                <List className="w-3.5 h-3.5" /> {selCount} als Liste
                              </button>
                              <button
                                onClick={() => { toggleItemsDone(collection.id, Array.from(selectedKeywords), true); setSelectedKeywords(new Set()); }}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> {selCount} abhaken
                              </button>
                              <button
                                onClick={() => { toggleItemsDone(collection.id, Array.from(selectedKeywords), false); setSelectedKeywords(new Set()); }}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                              >
                                <Circle className="w-3.5 h-3.5" /> {selCount} offen setzen
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>

                    {/* Bulk editing textarea */}
                    {isBulkEditing ? (
                      <div>
                        <textarea
                          value={bulkText}
                          onChange={(e) => setBulkText(e.target.value)}
                          rows={Math.min(20, collection.items.length + 3)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                          placeholder="Keyword&#9;Suchvolumen (pro Zeile, Tab-getrennt)"
                        />
                        <p className="text-xs text-gray-400 mt-1">Format: Keyword[Tab]Suchvolumen (ein Eintrag pro Zeile). Leere Zeilen werden ignoriert.</p>
                      </div>
                    ) : collection.items.length === 0 ? (
                      <p className="text-sm text-gray-400 italic py-2">Noch keine Keywords in dieser Sammlung</p>
                    ) : (
                      /* Keywords table */
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-2 py-2 w-8">
                                <input
                                  type="checkbox"
                                  checked={collection.items.length > 0 && collection.items.every(i => selectedKeywords.has(i.keyword))}
                                  onChange={() => toggleAllKeywords(collection.items)}
                                  className="rounded border-gray-300"
                                />
                              </th>
                              <th className="px-2 py-2 w-8 text-center text-xs font-semibold text-gray-600" title="Erledigt">
                                <CheckCircle className="w-3.5 h-3.5 mx-auto text-gray-400" />
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Keyword</th>
                              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Searches</th>
                              <th className="px-2 py-2 w-20"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {collection.items.map((item, idx) => (
                              <tr key={`${item.keyword}-${idx}`} className={`hover:bg-gray-50 ${item.done ? 'bg-green-50/50' : ''}`}>
                                <td className="px-2 py-1.5">
                                  <input
                                    type="checkbox"
                                    checked={selectedKeywords.has(item.keyword)}
                                    onChange={() => toggleKeyword(item.keyword)}
                                    className="rounded border-gray-300"
                                  />
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  <button
                                    onClick={() => toggleItemDone(collection.id, item.keyword)}
                                    className={`p-0.5 rounded transition-colors ${item.done ? 'text-green-600 hover:text-green-800' : 'text-gray-300 hover:text-green-500'}`}
                                    title={item.done ? 'Als offen markieren' : 'Als erledigt markieren'}
                                  >
                                    {item.done ? <CheckCircle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                                  </button>
                                </td>
                                <td className="px-3 py-1.5 text-sm">
                                  {item.id ? (
                                    <Link href={`/interests/${item.id}`} className={`hover:underline ${item.done ? 'text-gray-400 line-through' : 'text-red-700 hover:text-red-900'}`}>
                                      {item.keyword}
                                    </Link>
                                  ) : (
                                    <span className={item.done ? 'text-gray-400 line-through' : 'text-gray-800'}>{item.keyword}</span>
                                  )}
                                </td>
                                <td className={`px-3 py-1.5 text-sm text-right font-medium ${item.done ? 'text-gray-400' : 'text-red-700'}`}>
                                  {item.searches > 0 ? formatNumber(item.searches) : <span className="text-gray-300">-</span>}
                                </td>
                                <td className="px-2 py-1.5 text-right">
                                  <div className="flex items-center justify-end gap-0.5">
                                    <button
                                      onClick={() => handleCopySingle(item.keyword)}
                                      className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                                      title="Keyword kopieren"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => removeItem(collection.id, item.keyword)}
                                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                      title="Entfernen"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50 border-t border-gray-200">
                            <tr>
                              <td></td>
                              <td></td>
                              <td className="px-3 py-2 text-xs font-medium text-gray-500">
                                {collection.items.length} Keywords
                                {lookupLoading === collection.id && (
                                  <span className="inline-flex items-center gap-1 ml-2 text-amber-600">
                                    <Loader2 className="w-3 h-3 animate-spin" /> Suchvolumen wird geladen...
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-xs text-right font-medium text-gray-500">
                                {formatNumber(collection.items.reduce((sum, i) => sum + i.searches, 0))} total
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
