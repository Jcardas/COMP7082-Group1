import React from 'react';
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
    <div className="flex flex-col justify-between border border-neutral-800 bg-neutral-950 p-3 text-xs">
      <div className="flex items-start gap-3">
        <img
          src={mod.iconUrl || '/MCMC.png'}
          alt={mod.name}
          className="h-12 w-12 shrink-0 border border-neutral-800 bg-neutral-900 object-contain"
        />

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <a
              href={projectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-white underline"
            >
              {mod.name}
            </a>
            <span
              className={`border px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                mod.source === 'modrinth'
                  ? 'border-green-700 bg-green-950 text-green-400'
                  : 'border-orange-700 bg-orange-950 text-orange-400'
              }`}
            >
              {mod.source}
            </span>
          </div>

          {/* Description above the download count */}
          <p className="text-neutral-300 line-clamp-2">{mod.summary}</p>

          <div className="text-neutral-400">
            {formatDownloads(mod.downloads)}
            {typeof mod.similarity === 'number' && mod.similarity > 0
              ? ` | Match: ${Math.round(mod.similarity * 100)}%`
              : ''}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-neutral-800 pt-2">
        <span className="text-neutral-500">
          {addedBy ? `By ${addedBy}` : mod.loaders?.slice(0, 2).join(', ') || 'Universal'}
        </span>

        {isInstalled ? (
          <button
            type="button"
            onClick={() => onRemove(mod.id)}
            className="border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-neutral-300 hover:bg-neutral-800"
          >
            Remove
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onAdd(mod)}
            className="border border-neutral-600 bg-neutral-800 px-2.5 py-1 text-white hover:bg-neutral-700"
          >
            Add to Modpack
          </button>
        )}
      </div>
    </div>
  );
};
