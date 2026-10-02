import React from 'react';
import { Plus, Trash2, Box, ExternalLink, Download } from 'lucide-react';
import type { ModItem } from '../types';
import { formatDownloads, getModProjectUrl } from '../utils/format';

interface ModCardProps {
  mod: ModItem;
  isInstalled: boolean;
  onAdd: (mod: ModItem) => void;
  onRemove: (modId: string) => void;
  addedBy?: string;
}

export const ModCard: React.FC<ModCardProps> = ({
  mod,
  isInstalled,
  onAdd,
  onRemove,
  addedBy,
}) => {
  const projectUrl = getModProjectUrl(mod);

  return (
    <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/50 p-4 transition-all hover:border-slate-700 hover:bg-slate-900/80 hover:shadow-lg">
      <div className="space-y-3">
        {/* Header: Icon, Title, and Source Badge */}
        <div className="flex items-start gap-3">
          {mod.iconUrl ? (
            <img
              src={mod.iconUrl}
              alt={mod.name}
              className="h-12 w-12 rounded-lg object-cover ring-1 ring-slate-700/60 bg-slate-800 shrink-0"
              loading="lazy"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-400 ring-1 ring-slate-700/60">
              <Box className="h-6 w-6" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1.5">
              {/* Clickable link to Modrinth / Curseforge */}
              <a
                href={projectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-1 truncate text-sm font-bold text-slate-100 hover:text-emerald-400 transition"
                title={`Open ${mod.name} on ${mod.source}`}
              >
                <span className="truncate">{mod.name}</span>
                <ExternalLink className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100 transition" />
              </a>

              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  mod.source === 'modrinth'
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/40'
                    : 'bg-amber-950/80 text-amber-400 border border-amber-800/40'
                }`}
              >
                {mod.source}
              </span>
            </div>

            {/* Downloads count */}
            <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
              <Download className="h-3 w-3 text-slate-500" />
              <span>{formatDownloads(mod.downloads)}</span>
            </div>

            <p className="line-clamp-2 text-xs text-slate-300 mt-1 leading-relaxed">
              {mod.summary || 'No description provided.'}
            </p>
          </div>
        </div>

        {/* Categories / Tags */}
        {mod.categories && mod.categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {mod.categories.slice(0, 3).map((cat, idx) => (
              <span
                key={idx}
                className="rounded bg-slate-800/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-300 border border-slate-700/40"
              >
                {cat}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer: Added By / Loaders, and Action Button */}
      <div className="mt-3.5 flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs">
        {addedBy ? (
          <span className="text-[11px] text-slate-400">
            Added by <strong className="text-emerald-400">{addedBy}</strong>
          </span>
        ) : (
          <span className="text-[11px] text-slate-500">
            {mod.loaders?.length ? mod.loaders.slice(0, 2).join(', ') : 'Universal'}
          </span>
        )}

        {isInstalled ? (
          <button
            onClick={() => onRemove(mod.id)}
            className="flex items-center space-x-1 rounded-md border border-rose-900/60 bg-rose-950/30 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-900/60 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Remove</span>
          </button>
        ) : (
          <button
            onClick={() => onAdd(mod)}
            className="flex items-center space-x-1 rounded-md bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-500 transition active:scale-95 shadow"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add to Pack</span>
          </button>
        )}
      </div>
    </div>
  );
};
