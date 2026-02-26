'use client';

import { useState, useCallback, useEffect } from 'react';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import type { Idea, KlpPivot } from '@/types/database';

export interface TreeNode {
  id: string;
  name: string;
  url: string;
  searches: number | null;
  language: string | null;
  pivots: KlpPivot[];
  childIds: string[];
  status: 'collapsed' | 'loading' | 'expanded' | 'error';
  depth: number;
  parentId: string | null;
  isCircular?: boolean;
  error?: string;
}

const MAX_DEPTH = 10;
const MAX_NODES = 200;
const SCRAPE_DELAY = 300;

function extractIdFromUrl(url: string): string | null {
  const match = url.match(/\/ideas\/[^/]+\/(\d+)/);
  return match ? match[1] : null;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function useKeywordTree(rootId: string) {
  const [nodes, setNodes] = useState<Map<string, TreeNode>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load root idea
  useEffect(() => {
    let cancelled = false;

    async function loadRoot() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchWithTimeout(`/api/interests/${rootId}`);
        if (!res.ok) throw new Error('Idea nicht gefunden');
        const idea: Idea = await res.json();

        if (cancelled) return;

        const rootNode: TreeNode = {
          id: idea.id,
          name: idea.name,
          url: idea.url || '',
          searches: idea.searches,
          language: idea.language,
          pivots: idea.klp_pivots || [],
          childIds: [],
          status: 'collapsed',
          depth: 0,
          parentId: null,
        };

        setNodes(new Map([[idea.id, rootNode]]));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Fehler beim Laden');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRoot();
    return () => { cancelled = true; };
  }, [rootId]);

  // Check if an ID exists anywhere in the ancestor chain of a node
  const isAncestor = useCallback((nodeId: string, targetId: string, nodesMap: Map<string, TreeNode>): boolean => {
    let current = nodesMap.get(nodeId);
    while (current?.parentId) {
      if (current.parentId === targetId) return true;
      current = nodesMap.get(current.parentId);
    }
    return false;
  }, []);

  const expand = useCallback(async (nodeId: string) => {
    setNodes(prev => {
      const node = prev.get(nodeId);
      if (!node || node.status === 'loading') return prev;

      // If already expanded with children, just collapse
      if (node.status === 'expanded') {
        const next = new Map(prev);
        next.set(nodeId, { ...node, status: 'collapsed' });
        return next;
      }

      // If was collapsed but already has children loaded, re-expand instantly
      if (node.childIds.length > 0) {
        const next = new Map(prev);
        next.set(nodeId, { ...node, status: 'expanded' });
        return next;
      }

      // Set loading
      const next = new Map(prev);
      next.set(nodeId, { ...node, status: 'loading' });
      return next;
    });

    // Check if we can skip the async work (already has children)
    const currentNode = nodes.get(nodeId);
    if (!currentNode || currentNode.childIds.length > 0 || currentNode.status === 'expanded') return;

    const node = nodes.get(nodeId);
    if (!node) return;

    if (node.depth >= MAX_DEPTH) {
      setNodes(prev => {
        const next = new Map(prev);
        const n = next.get(nodeId);
        if (n) next.set(nodeId, { ...n, status: 'error', error: 'Maximale Tiefe erreicht' });
        return next;
      });
      return;
    }

    if (node.pivots.length === 0) {
      setNodes(prev => {
        const next = new Map(prev);
        const n = next.get(nodeId);
        if (n) next.set(nodeId, { ...n, status: 'expanded', childIds: [] });
        return next;
      });
      return;
    }

    const childIds: string[] = [];
    const newChildren: TreeNode[] = [];

    for (let i = 0; i < node.pivots.length; i++) {
      const pivot = node.pivots[i];

      // Check node limit
      if (nodes.size + newChildren.length >= MAX_NODES) break;

      const pivotId = extractIdFromUrl(pivot.url);

      if (!pivotId) {
        // Can't extract ID, create placeholder error node
        continue;
      }

      // Check if already in tree (circular reference)
      const existsInTree = nodes.has(pivotId) || newChildren.some(c => c.id === pivotId);
      if (existsInTree) {
        childIds.push(pivotId);
        // Mark as circular if it's not this node's own entry
        if (!newChildren.some(c => c.id === pivotId)) {
          // Already exists in tree from another branch
          setNodes(prev => {
            const existing = prev.get(pivotId);
            if (existing && !existing.isCircular) {
              const next = new Map(prev);
              // Don't modify existing, just track in childIds
              return next;
            }
            return prev;
          });
        }
        continue;
      }

      // Scrape the pivot
      try {
        const res = await fetchWithTimeout('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: pivot.url,
            skipIfRecent: true,
            language: node.language,
          }),
        }, 35000);

        const result = await res.json();

        if (result.success && result.idea) {
          const childNode: TreeNode = {
            id: result.idea.id,
            name: result.idea.name,
            url: result.idea.url || pivot.url,
            searches: result.idea.searches,
            language: result.idea.language,
            pivots: result.idea.klp_pivots || [],
            childIds: [],
            status: 'collapsed',
            depth: node.depth + 1,
            parentId: nodeId,
          };
          newChildren.push(childNode);
          childIds.push(childNode.id);
        } else {
          // Create error node
          const errorNode: TreeNode = {
            id: pivotId,
            name: pivot.name,
            url: pivot.url,
            searches: null,
            language: null,
            pivots: [],
            childIds: [],
            status: 'error',
            depth: node.depth + 1,
            parentId: nodeId,
            error: result.error || 'Scrape fehlgeschlagen',
          };
          newChildren.push(errorNode);
          childIds.push(errorNode.id);
        }
      } catch (err) {
        const errorNode: TreeNode = {
          id: pivotId,
          name: pivot.name,
          url: pivot.url,
          searches: null,
          language: null,
          pivots: [],
          childIds: [],
          status: 'error',
          depth: node.depth + 1,
          parentId: nodeId,
          error: err instanceof Error ? err.message : 'Netzwerkfehler',
        };
        newChildren.push(errorNode);
        childIds.push(errorNode.id);
      }

      // Delay between scrapes
      if (i < node.pivots.length - 1) {
        await sleep(SCRAPE_DELAY);
      }
    }

    // Batch update state
    setNodes(prev => {
      const next = new Map(prev);
      for (const child of newChildren) {
        // Check again for circulars that appeared during async
        if (next.has(child.id) && child.id !== nodeId) {
          // Already exists, mark in childIds but don't overwrite
          continue;
        }
        next.set(child.id, child);
      }
      const n = next.get(nodeId);
      if (n) {
        next.set(nodeId, { ...n, status: 'expanded', childIds });
      }
      return next;
    });
  }, [nodes, isAncestor]);

  const collapse = useCallback((nodeId: string) => {
    setNodes(prev => {
      const node = prev.get(nodeId);
      if (!node) return prev;
      const next = new Map(prev);
      next.set(nodeId, { ...node, status: 'collapsed' });
      return next;
    });
  }, []);

  const retryNode = useCallback(async (nodeId: string) => {
    const node = nodes.get(nodeId);
    if (!node || node.status !== 'error' || !node.parentId) return;

    // Set loading
    setNodes(prev => {
      const next = new Map(prev);
      const n = next.get(nodeId);
      if (n) next.set(nodeId, { ...n, status: 'loading', error: undefined });
      return next;
    });

    try {
      const res = await fetchWithTimeout('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: node.url,
          skipIfRecent: true,
          language: node.language,
        }),
      }, 35000);

      const result = await res.json();

      if (result.success && result.idea) {
        setNodes(prev => {
          const next = new Map(prev);
          next.set(nodeId, {
            ...node,
            name: result.idea.name,
            searches: result.idea.searches,
            language: result.idea.language,
            pivots: result.idea.klp_pivots || [],
            status: 'collapsed',
            error: undefined,
          });
          return next;
        });
      } else {
        setNodes(prev => {
          const next = new Map(prev);
          next.set(nodeId, { ...node, status: 'error', error: result.error || 'Scrape fehlgeschlagen' });
          return next;
        });
      }
    } catch (err) {
      setNodes(prev => {
        const next = new Map(prev);
        next.set(nodeId, { ...node, status: 'error', error: err instanceof Error ? err.message : 'Netzwerkfehler' });
        return next;
      });
    }
  }, [nodes]);

  // Computed stats
  const totalNodes = nodes.size;
  const maxDepth = Math.max(0, ...Array.from(nodes.values()).map(n => n.depth));
  const loadingCount = Array.from(nodes.values()).filter(n => n.status === 'loading').length;
  const errorCount = Array.from(nodes.values()).filter(n => n.status === 'error').length;
  const rootNode = nodes.get(rootId) || null;

  return {
    nodes,
    rootNode,
    loading,
    error,
    expand,
    collapse,
    retryNode,
    stats: { totalNodes, maxDepth, loadingCount, errorCount },
  };
}
