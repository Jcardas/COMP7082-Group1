import React from 'react';
import type { DependencyAnalysisResult } from '../types';

interface DependencyViewerProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: DependencyAnalysisResult | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export const DependencyViewer: React.FC<DependencyViewerProps> = ({
  isOpen,
  onClose,
  analysis,
  isLoading,
  onRefresh,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col border border-neutral-700 bg-neutral-950 text-xs text-neutral-200">
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <strong className="text-sm text-white">Dependency Analysis</strong>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
            >
              {isLoading ? 'Checking...' : 'Refresh'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-neutral-200 hover:bg-neutral-800"
            >
              Close
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <p className="text-neutral-400">Analyzing dependencies...</p>
          ) : !analysis ? (
            <p className="text-neutral-400">No dependency data available.</p>
          ) : (
            <>
              <div className="border border-neutral-800 bg-neutral-900 p-3">
                <strong className="text-white">
                  Status: {analysis.isValid ? 'VALID' : 'ISSUES DETECTED'}
                </strong>
              </div>

              {analysis.missingDependencies.length > 0 && (
                <div className="space-y-2">
                  <strong className="text-white">
                    Missing Dependencies ({analysis.missingDependencies.length})
                  </strong>
                  {analysis.missingDependencies.map((item, idx) => (
                    <div key={idx} className="border border-neutral-800 bg-neutral-900 p-2.5">
                      <p className="font-bold text-white">{item.modName}</p>
                      <ul className="mt-1 list-disc list-inside text-neutral-300">
                        {item.missing.map((dep, dIdx) => (
                          <li key={dIdx}>
                            {dep.name || dep.id} ({dep.dependencyType})
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {analysis.cycles.length > 0 && (
                <div className="space-y-2">
                  <strong className="text-white">
                    Circular Dependencies ({analysis.cycles.length})
                  </strong>
                  <div className="border border-neutral-800 bg-neutral-900 p-2.5">
                    {analysis.cycles.map((cycle, idx) => (
                      <p key={idx} className="font-mono">
                        {cycle.join(' -> ')}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {analysis.installOrder.length > 0 && (
                <div className="space-y-2">
                  <strong className="text-white">Topological Install Order</strong>
                  <ol className="list-decimal list-inside border border-neutral-800 bg-neutral-900 p-2.5 space-y-1">
                    {analysis.installOrder.map((modName, idx) => (
                      <li key={idx}>{modName}</li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
