import React, { useState } from 'react';
import type { ModItem, Modpack } from '../types';
import { formatDownloads, getModProjectUrl } from '../utils/format';
import { ModCard } from './ModCard';

interface ActiveModpackViewProps {
  modpack: Modpack;
  currentUser: string;
  recommendations: ModItem[];
  isLoadingRecs: boolean;
  installedModIds: Set<string>;
  onRefreshRecommendations: () => void;
  onAddMod: (mod: ModItem) => void;
  onRemoveMod: (modId: string) => void;
  onVoteMod: (modId: string, vote: 'yes' | 'no') => void;
  onCommentMod: (modId: string, text: string) => void;
  onOpenExport: () => void;
  onGoToSearch: () => void;
  onBackToProjects?: () => void;
}

export const ActiveModpackView: React.FC<ActiveModpackViewProps> = ({
  modpack,
  currentUser,
  recommendations,
  isLoadingRecs,
  installedModIds,
  onRefreshRecommendations,
  onAddMod,
  onRemoveMod,
  onVoteMod,
  onCommentMod,
  onOpenExport,
  onGoToSearch,
  onBackToProjects,
}) => {
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [expandedCommentsModId, setExpandedCommentsModId] = useState<string | null>(null);

  const handleCommentSubmit = (modId: string, e: React.FormEvent) => {
    e.preventDefault();
    const text = (commentInputs[modId] || '').trim();
    if (!text) return;

    onCommentMod(modId, text);
    setCommentInputs((prev) => ({ ...prev, [modId]: '' }));
  };

  return (
    <div className="space-y-6">
      <div className="border border-neutral-800 bg-neutral-950 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={modpack.imageUrl || '/MCMC.png'}
              alt={modpack.title}
              className="h-12 w-12 border border-neutral-800 bg-neutral-900 object-contain"
            />
            <div>
              <h1 className="text-lg font-bold text-white">{modpack.title}</h1>
              <p className="text-xs text-neutral-400">
                MC {modpack.minecraftVersion} | Loader: {modpack.modLoader.toUpperCase()} | Mods:{' '}
                {modpack.mods.length}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {onBackToProjects && (
              <button
                type="button"
                onClick={onBackToProjects}
                className="border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-neutral-300 hover:bg-neutral-800"
              >
                All Modpacks
              </button>
            )}
            <button
              type="button"
              onClick={onGoToSearch}
              className="border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-neutral-200 hover:bg-neutral-800"
            >
              Add Mods
            </button>
            <button
              type="button"
              onClick={onOpenExport}
              className="border border-neutral-600 bg-neutral-800 px-3 py-1.5 font-bold text-white hover:bg-neutral-700"
            >
              Export Modpack
            </button>
          </div>
        </div>
      </div>

      {/* Installed Mods List */}
      {modpack.mods.length === 0 ? (
        <div className="border border-neutral-800 bg-neutral-950 p-6 text-center text-sm text-neutral-400">
          <p>No mods in this modpack.</p>
          <button
            type="button"
            onClick={onGoToSearch}
            className="mt-3 border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"
          >
            Go to Search
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {modpack.mods.map((mod) => {
            const projectUrl = getModProjectUrl(mod);
            const yesVotes = mod.votes?.yes || [];
            const noVotes = mod.votes?.no || [];
            const hasVotedYes = yesVotes.includes(currentUser);
            const hasVotedNo = noVotes.includes(currentUser);
            const commentCount = mod.comments?.length || 0;
            const isCommentsOpen = expandedCommentsModId === mod.id;

            return (
              <div key={mod.id} className="border border-neutral-800 bg-neutral-950 p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <img
                      src={mod.iconUrl || '/MCMC.png'}
                      alt={mod.name}
                      className="h-10 w-10 border border-neutral-800 bg-neutral-900 object-contain shrink-0"
                    />
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
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
                        {mod.addedBy && (
                          <span className="text-xs text-neutral-400">Added by: {mod.addedBy}</span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-300">{mod.summary}</p>
                      <div className="text-xs text-neutral-400">
                        {formatDownloads(mod.downloads)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => onVoteMod(mod.id, 'yes')}
                      className={`border px-2.5 py-1 ${
                        hasVotedYes
                          ? 'border-neutral-300 bg-neutral-800 text-white'
                          : 'border-neutral-800 bg-neutral-900 text-neutral-400'
                      }`}
                    >
                      Yes ({yesVotes.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => onVoteMod(mod.id, 'no')}
                      className={`border px-2.5 py-1 ${
                        hasVotedNo
                          ? 'border-neutral-300 bg-neutral-800 text-white'
                          : 'border-neutral-800 bg-neutral-900 text-neutral-400'
                      }`}
                    >
                      No ({noVotes.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveMod(mod.id)}
                      className="border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-neutral-300 hover:bg-neutral-800"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="mt-3 border-t border-neutral-800 pt-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setExpandedCommentsModId(isCommentsOpen ? null : mod.id)}
                    className="text-neutral-400 underline hover:text-neutral-200"
                  >
                    Comments ({commentCount})
                  </button>

                  {isCommentsOpen && (
                    <div className="mt-2 space-y-2 border border-neutral-800 bg-neutral-900 p-3">
                      {commentCount === 0 ? (
                        <p className="text-neutral-500">No comments.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {mod.comments!.map((comment) => (
                            <div
                              key={comment.id}
                              className="border-b border-neutral-800 pb-1 last:border-b-0"
                            >
                              <span className="font-bold text-neutral-200">{comment.user}: </span>
                              <span className="text-neutral-300">{comment.text}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <form
                        onSubmit={(e) => handleCommentSubmit(mod.id, e)}
                        className="flex gap-2 pt-1"
                      >
                        <input
                          type="text"
                          value={commentInputs[mod.id] || ''}
                          onChange={(e) =>
                            setCommentInputs((prev) => ({
                              ...prev,
                              [mod.id]: e.target.value,
                            }))
                          }
                          placeholder="Add comment..."
                          className="flex-1 border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-white"
                        />
                        <button
                          type="submit"
                          className="border border-neutral-700 bg-neutral-800 px-3 py-1 text-xs text-white"
                        >
                          Post
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dynamic Recommendations at the Bottom of the Modlist */}
      <div className="border-t border-neutral-800 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <strong className="text-sm text-white">Recommended Mods</strong>
            <p className="text-xs text-neutral-400">
              Automatically updated based on your current modlist. Required dependencies are
              installed automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefreshRecommendations}
            disabled={isLoadingRecs}
            className="border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
          >
            {isLoadingRecs ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {isLoadingRecs ? (
          <div className="border border-neutral-800 bg-neutral-950 p-4 text-center text-xs text-neutral-400">
            Loading recommendations...
          </div>
        ) : recommendations.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {recommendations.map((mod) => (
              <ModCard
                key={mod.id}
                mod={mod}
                isInstalled={installedModIds.has(mod.id)}
                onAdd={onAddMod}
                onRemove={onRemoveMod}
              />
            ))}
          </div>
        ) : (
          <div className="border border-neutral-800 bg-neutral-950 p-4 text-center text-xs text-neutral-400">
            No additional recommendations available.
          </div>
        )}
      </div>
    </div>
  );
};
