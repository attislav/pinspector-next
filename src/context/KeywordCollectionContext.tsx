'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { KeywordCollection } from '@/types/database';

interface KeywordCollectionContextType {
  collections: KeywordCollection[];
  createCollection: (name: string, keywords?: string[]) => KeywordCollection;
  deleteCollection: (id: string) => void;
  renameCollection: (id: string, name: string) => void;
  addKeywords: (collectionId: string, keywords: string[]) => void;
  removeKeyword: (collectionId: string, keyword: string) => void;
  updateKeywords: (collectionId: string, keywords: string[]) => void;
}

const STORAGE_KEY = 'pinspector-keyword-collections';

const KeywordCollectionContext = createContext<KeywordCollectionContextType>({
  collections: [],
  createCollection: () => ({ id: '', name: '', keywords: [], createdAt: '', updatedAt: '' }),
  deleteCollection: () => {},
  renameCollection: () => {},
  addKeywords: () => {},
  removeKeyword: () => {},
  updateKeywords: () => {},
});

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function KeywordCollectionProvider({ children }: { children: ReactNode }) {
  const [collections, setCollections] = useState<KeywordCollection[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setCollections(JSON.parse(saved));
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
    }
  }, [collections, loaded]);

  const createCollection = useCallback((name: string, keywords: string[] = []): KeywordCollection => {
    const now = new Date().toISOString();
    const collection: KeywordCollection = {
      id: generateId(),
      name,
      keywords,
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

  const addKeywords = useCallback((collectionId: string, keywords: string[]) => {
    setCollections(prev => prev.map(c => {
      if (c.id !== collectionId) return c;
      const existing = new Set(c.keywords);
      const newKeywords = keywords.filter(k => !existing.has(k));
      if (newKeywords.length === 0) return c;
      return { ...c, keywords: [...c.keywords, ...newKeywords], updatedAt: new Date().toISOString() };
    }));
  }, []);

  const removeKeyword = useCallback((collectionId: string, keyword: string) => {
    setCollections(prev => prev.map(c =>
      c.id === collectionId
        ? { ...c, keywords: c.keywords.filter(k => k !== keyword), updatedAt: new Date().toISOString() }
        : c
    ));
  }, []);

  const updateKeywords = useCallback((collectionId: string, keywords: string[]) => {
    setCollections(prev => prev.map(c =>
      c.id === collectionId
        ? { ...c, keywords, updatedAt: new Date().toISOString() }
        : c
    ));
  }, []);

  return (
    <KeywordCollectionContext.Provider value={{
      collections, createCollection, deleteCollection, renameCollection,
      addKeywords, removeKeyword, updateKeywords,
    }}>
      {children}
    </KeywordCollectionContext.Provider>
  );
}

export function useKeywordCollections() {
  return useContext(KeywordCollectionContext);
}
