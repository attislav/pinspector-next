'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { KeywordCollection, KeywordCollectionItem } from '@/types/database';

interface KeywordCollectionContextType {
  collections: KeywordCollection[];
  createCollection: (name: string, items?: KeywordCollectionItem[]) => KeywordCollection;
  deleteCollection: (id: string) => void;
  renameCollection: (id: string, name: string) => void;
  addItems: (collectionId: string, items: KeywordCollectionItem[]) => void;
  removeItem: (collectionId: string, keyword: string) => void;
  updateItems: (collectionId: string, items: KeywordCollectionItem[]) => void;
}

const STORAGE_KEY = 'pinspector-keyword-collections';

const KeywordCollectionContext = createContext<KeywordCollectionContextType>({
  collections: [],
  createCollection: () => ({ id: '', name: '', items: [], createdAt: '', updatedAt: '' }),
  deleteCollection: () => {},
  renameCollection: () => {},
  addItems: () => {},
  removeItem: () => {},
  updateItems: () => {},
});

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

interface LegacyCollection {
  id: string;
  name: string;
  keywords?: string[];
  items?: KeywordCollectionItem[];
  createdAt: string;
  updatedAt: string;
}

function migrateCollections(data: LegacyCollection[]): KeywordCollection[] {
  return data.map(c => {
    // Migrate old format (keywords: string[]) to new format (items: KeywordCollectionItem[])
    if (c.keywords && !c.items) {
      return {
        id: c.id,
        name: c.name,
        items: c.keywords.map(k => ({ keyword: k, searches: 0 })),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    }
    return {
      id: c.id,
      name: c.name,
      items: c.items || [],
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  });
}

export function KeywordCollectionProvider({ children }: { children: ReactNode }) {
  const [collections, setCollections] = useState<KeywordCollection[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setCollections(migrateCollections(JSON.parse(saved)));
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
    }
  }, [collections, loaded]);

  const createCollection = useCallback((name: string, items: KeywordCollectionItem[] = []): KeywordCollection => {
    const now = new Date().toISOString();
    const collection: KeywordCollection = {
      id: generateId(),
      name,
      items,
      createdAt: now,
      updatedAt: now,
    };
    setCollections(prev => [...prev, collection]);
    return collection;
  }, []);

  const deleteCollection = useCallback((id: string) => {
    setCollections(prev => prev.filter(c => c.id !== id));
  }, []);

  const renameCollection = useCallback((id: string, name: string) => {
    setCollections(prev => prev.map(c =>
      c.id === id ? { ...c, name, updatedAt: new Date().toISOString() } : c
    ));
  }, []);

  const addItems = useCallback((collectionId: string, newItems: KeywordCollectionItem[]) => {
    setCollections(prev => prev.map(c => {
      if (c.id !== collectionId) return c;
      const existing = new Set(c.items.map(i => i.keyword));
      const toAdd = newItems.filter(i => !existing.has(i.keyword));
      if (toAdd.length === 0) return c;
      return { ...c, items: [...c.items, ...toAdd], updatedAt: new Date().toISOString() };
    }));
  }, []);

  const removeItem = useCallback((collectionId: string, keyword: string) => {
    setCollections(prev => prev.map(c =>
      c.id === collectionId
        ? { ...c, items: c.items.filter(i => i.keyword !== keyword), updatedAt: new Date().toISOString() }
        : c
    ));
  }, []);

  const updateItems = useCallback((collectionId: string, items: KeywordCollectionItem[]) => {
    setCollections(prev => prev.map(c =>
      c.id === collectionId
        ? { ...c, items, updatedAt: new Date().toISOString() }
        : c
    ));
  }, []);

  return (
    <KeywordCollectionContext.Provider value={{
      collections, createCollection, deleteCollection, renameCollection,
      addItems, removeItem, updateItems,
    }}>
      {children}
    </KeywordCollectionContext.Provider>
  );
}

export function useKeywordCollections() {
  return useContext(KeywordCollectionContext);
}
