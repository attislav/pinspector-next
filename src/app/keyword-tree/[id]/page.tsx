'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, GitBranch, TreePine, AlertCircle } from 'lucide-react';
import { useKeywordTree } from '@/hooks/useKeywordTree';
import { KeywordTreeNode } from '@/components/keyword-tree/KeywordTreeNode';
import { formatNumber } from '@/lib/format';

export default function KeywordTreePage() {
  const params = useParams();
  const id = params.id as string;
  const tree = useKeywordTree(id);

  if (tree.loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (tree.error || !tree.rootNode) {
    return (
      <div className="max-w-7xl mx-auto">
        <Link href="/interests" className="flex items-center gap-2 text-gray-600 hover:text-red-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Zurück
        </Link>
        <div className="p-8 bg-red-50 rounded-xl text-center">
          <p className="text-red-700 font-medium">{tree.error || 'Idea nicht gefunden'}</p>
        </div>
      </div>
    );
  }

  const { rootNode, stats } = tree;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/interests/${id}`}
          className="flex items-center gap-2 text-gray-600 hover:text-red-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Zurück zu {rootNode.name}
        </Link>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <GitBranch className="w-6 h-6 text-purple-600" />
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                Keyword Tree
              </h1>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-lg text-gray-700 font-medium">{rootNode.name}</span>
              {rootNode.searches != null && (
                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  {formatNumber(rootNode.searches)} Suchen
                </span>
              )}
              {rootNode.language && (
                <span className="px-2 py-0.5 text-xs font-bold bg-gray-100 text-gray-600 rounded uppercase">
                  {rootNode.language}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-1.5 text-sm text-gray-600 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
          <TreePine className="w-4 h-4 text-purple-500" />
          <span className="font-medium">{stats.totalNodes}</span> Nodes
        </div>
        <div className="flex items-center gap-1.5 text-sm text-gray-600 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
          Tiefe: <span className="font-medium">{stats.maxDepth}</span>
        </div>
        {stats.loadingCount > 0 && (
          <div className="flex items-center gap-1.5 text-sm text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            {stats.loadingCount} laden...
          </div>
        )}
        {stats.errorCount > 0 && (
          <div className="flex items-center gap-1.5 text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">
            <AlertCircle className="w-3.5 h-3.5" />
            {stats.errorCount} Fehler
          </div>
        )}
      </div>

      {/* Tree */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 overflow-x-auto">
        <KeywordTreeNode
          node={rootNode}
          nodes={tree.nodes}
          onExpand={tree.expand}
          onCollapse={tree.collapse}
          onRetry={tree.retryNode}
        />
      </div>

      {/* Info */}
      <p className="text-xs text-gray-400 mt-4 text-center">
        Klicke auf einen Node um seine Pivots zu laden. Max {200} Nodes, {10} Level Tiefe.
      </p>
    </div>
  );
}
