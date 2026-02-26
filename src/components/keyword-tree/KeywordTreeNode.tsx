'use client';

import Link from 'next/link';
import { ChevronRight, ChevronDown, Loader2, RotateCcw, Undo2 } from 'lucide-react';
import { formatNumber } from '@/lib/format';
import type { TreeNode } from '@/hooks/useKeywordTree';

interface KeywordTreeNodeProps {
  node: TreeNode;
  nodes: Map<string, TreeNode>;
  onExpand: (id: string) => void;
  onCollapse: (id: string) => void;
  onRetry: (id: string) => void;
}

export function KeywordTreeNode({ node, nodes, onExpand, onCollapse, onRetry }: KeywordTreeNodeProps) {
  // Check if this node is referenced as circular (exists elsewhere in tree with different parent)
  const isCircularRef = node.isCircular;
  const hasChildren = node.pivots.length > 0;
  const isExpandable = hasChildren && !isCircularRef && node.status !== 'error';

  const handleToggle = () => {
    if (!isExpandable) return;
    if (node.status === 'expanded') {
      onCollapse(node.id);
    } else {
      onExpand(node.id);
    }
  };

  return (
    <div>
      <div
        className={`group flex items-center gap-1.5 md:gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors ${
          node.status === 'error' ? 'bg-red-50/50' : ''
        }`}
      >
        {/* Expand/Collapse button */}
        <button
          onClick={handleToggle}
          disabled={!isExpandable || node.status === 'loading'}
          className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded transition-colors ${
            isExpandable
              ? 'text-gray-500 hover:text-gray-800 hover:bg-gray-200 cursor-pointer'
              : 'text-gray-300 cursor-default'
          }`}
        >
          {node.status === 'loading' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
          ) : isCircularRef ? (
            <Undo2 className="w-3.5 h-3.5 text-gray-400" />
          ) : node.status === 'expanded' ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Name */}
        <Link
          href={`/interests/${node.id}`}
          className={`text-sm font-medium truncate ${
            isCircularRef
              ? 'text-gray-400'
              : node.status === 'error'
                ? 'text-red-600'
                : 'text-gray-800 hover:text-red-700 hover:underline'
          }`}
        >
          {node.name}
        </Link>

        {/* Badges */}
        {node.searches != null && (
          <span className="flex-shrink-0 text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
            {formatNumber(node.searches)}
          </span>
        )}

        {node.pivots.length > 0 && !isCircularRef && (
          <span className="flex-shrink-0 text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
            {node.pivots.length} Pivots
          </span>
        )}

        {isCircularRef && (
          <span className="flex-shrink-0 text-xs text-gray-400 italic">
            bereits im Baum
          </span>
        )}

        {/* Error + Retry */}
        {node.status === 'error' && (
          <>
            <span className="flex-shrink-0 text-xs text-red-500 truncate max-w-[200px]" title={node.error}>
              {node.error}
            </span>
            <button
              onClick={() => onRetry(node.id)}
              className="flex-shrink-0 text-xs text-red-600 hover:text-red-800 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-red-100 transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Retry
            </button>
          </>
        )}
      </div>

      {/* Children */}
      {node.status === 'expanded' && node.childIds.length > 0 && (
        <div className="ml-4 md:ml-6 border-l-2 border-gray-200 pl-1">
          {node.childIds.map(childId => {
            const childNode = nodes.get(childId);
            if (!childNode) return null;

            // Check if child is circular (exists in tree with a different parent)
            const isChildCircular = childNode.parentId !== node.id;

            return (
              <KeywordTreeNode
                key={childId}
                node={isChildCircular ? { ...childNode, isCircular: true } : childNode}
                nodes={nodes}
                onExpand={onExpand}
                onCollapse={onCollapse}
                onRetry={onRetry}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
