import React from 'react';
import { X, CheckCircle2, AlertTriangle, RefreshCw, GitBranch, ArrowRight } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <GitBranch className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Dependency Graph & Validation</h2>
              <p className="text-xs text-slate-400">Powered by Node.js graphlib dependency resolver</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition disabled:opacity-50"
              title="Re-run dependency check"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="overflow-y-auto p-6 space-y-5 text-sm">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-3">
              <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
              <p className="text-xs">Building directed graph & topological sort...</p>
            </div>
          ) : !analysis ? (
            <p className="text-center text-slate-400 py-8">No mods analyzed yet.</p>
          ) : (
            <>
              {/* Overall Status Banner */}
              <div
                className={`flex items-start space-x-3 rounded-xl p-4 border ${
                  analysis.isValid
                    ? 'border-emerald-800/40 bg-emerald-950/20 text-emerald-300'
                    : 'border-amber-800/40 bg-amber-950/20 text-amber-300'
                }`}
              >
                {analysis.isValid ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
                )}
                <div>
                  <h4 className="font-semibold text-sm">
                    {analysis.isValid
                      ? 'All Mod Dependencies Satisfied'
                      : 'Dependency Issues Detected'}
                  </h4>
                  <p className="text-xs mt-0.5 opacity-90">
                    {analysis.isValid
                      ? 'No cyclic dependencies or missing libraries found in your modpack.'
                      : 'Some mods in your pack require companion libraries or have conflicts.'}
                  </p>
                </div>
              </div>

              {/* Missing Dependencies Warning */}
              {analysis.missingDependencies.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400">
                    Missing Required Dependencies ({analysis.missingDependencies.length})
                  </h4>
                  <div className="space-y-2">
                    {analysis.missingDependencies.map((item, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-rose-900/40 bg-rose-950/10 p-3 text-xs"
                      >
                        <p className="font-medium text-rose-200">
                          <strong>{item.modName}</strong> requires:
                        </p>
                        <ul className="mt-1 list-disc list-inside text-rose-300 space-y-0.5">
                          {item.missing.map((dep, dIdx) => (
                            <li key={dIdx}>
                              {dep.name || dep.id}{' '}
                              <span className="text-[10px] text-rose-400 font-mono">({dep.dependencyType})</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cycles Warning */}
              {analysis.cycles.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Circular Dependency Cycles ({analysis.cycles.length})
                  </h4>
                  <div className="rounded-lg border border-amber-900/40 bg-amber-950/10 p-3 text-xs text-amber-200">
                    {analysis.cycles.map((cycle, idx) => (
                      <p key={idx} className="font-mono">
                        {cycle.join(' ➔ ')}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Computed Topological Installation / Load Order */}
              {analysis.installOrder.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Computed Installation Order (Topological Sort)
                  </h4>
                  <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    {analysis.installOrder.map((modName, idx) => (
                      <React.Fragment key={idx}>
                        <span className="rounded bg-slate-800 px-2 py-1 text-xs font-medium text-slate-200">
                          {idx + 1}. {modName}
                        </span>
                        {idx < analysis.installOrder.length - 1 && (
                          <ArrowRight className="h-3 w-3 text-slate-600" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-950/40 px-6 py-3 text-right">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
