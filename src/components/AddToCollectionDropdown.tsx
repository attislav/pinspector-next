'use client';

import { useState, useRef, useEffect } from 'react';
import { FolderPlus, Plus, Check } from 'lucide-react';
import { useKeywordCollections } from '@/context/KeywordCollectionContext';
import { KeywordCollectionItem } from '@/types/database';

interface AddToCollectionDropdownProps {
  items: KeywordCollectionItem[];
  label?: string;
}

export function AddToCollectionDropdown({ items, label }: AddToCollectionDropdownProps) {
  const { collections, createCollection, addItems } = useKeywordCollections();
  const [open, setOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowNew(false);
        setNewName('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (showNew && inputRef.current) inputRef.current.focus();
  }, [showNew]);

  const handleAddToExisting = (collectionId: string, collectionName: string) => {
    addItems(collectionId, items);
    setFeedback(`${items.length} Keywords zu "${collectionName}" hinzugefügt`);
    setTimeout(() => { setFeedback(null); setOpen(false); }, 1500);
  };

  const handleCreateNew = () => {
    if (!newName.trim()) return;
    const collection = createCollection(newName.trim(), items);
    setFeedback(`"${collection.name}" erstellt mit ${items.length} Keywords`);
    setNewName('');
    setShowNew(false);
    setTimeout(() => { setFeedback(null); setOpen(false); }, 1500);
  };

  if (items.length === 0) return null;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors text-sm"
        title="Zur Sammlung hinzufügen"
      >
        <FolderPlus className="w-4 h-4" />
        {label || 'Sammlung'}
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
            <p className="text-xs text-gray-500 font-medium">
              {items.length} Keyword{items.length !== 1 ? 's' : ''} hinzufügen zu:
            </p>
          </div>

          {feedback ? (
            <div className="px-3 py-4 flex items-center gap-2 text-green-700 text-sm">
              <Check className="w-4 h-4" /> {feedback}
            </div>
          ) : (
            <>
              <div className="max-h-48 overflow-y-auto">
                {collections.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-gray-400 italic">Noch keine Sammlungen vorhanden</p>
                ) : (
                  collections.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleAddToExisting(c.id, c.name)}
                      className="w-full px-3 py-2 text-left hover:bg-amber-50 transition-colors flex items-center justify-between group"
                    >
                      <span className="text-sm text-gray-800 truncate">{c.name}</span>
                      <span className="text-xs text-gray-400 group-hover:text-amber-600 shrink-0 ml-2">
                        {c.items.length} Keywords
                      </span>
                    </button>
                  ))
                )}
              </div>

              <div className="border-t border-gray-200">
                {showNew ? (
                  <form onSubmit={(e) => { e.preventDefault(); handleCreateNew(); }} className="p-2 flex gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Name der Sammlung..."
                      className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!newName.trim()}
                      className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded hover:bg-amber-700 disabled:opacity-50 transition-colors"
                    >
                      OK
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => setShowNew(true)}
                    className="w-full px-3 py-2 text-left text-sm text-amber-700 hover:bg-amber-50 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Neue Sammlung erstellen
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
