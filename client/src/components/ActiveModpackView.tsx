import React, { useState } from 'react';
import {
  Package,
  ExternalLink,
  Download,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Send,
  Trash2,
  Box,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';
import type { Modpack } from '../types';
import { formatDownloads, getModProjectUrl } from '../utils/format';

interface ActiveModpackViewProps {
  modpack: Modpack;
  currentUser: string;
  onRemoveMod: (modId: string) => void;
  onVoteMod: (modId: string, vote: 'yes' | 'no') => void;
  onCommentMod: (modId: string, text: string) => void;
  onOpenDependencies: () => void;
  onOpenExport: () => void;
  onGoToSearch: () => void;
}

export const ActiveModpackView: React.FC<ActiveModpackViewProps> = ({
  modpack,
  currentUser,
  onRemoveMod,
  onVoteMod,
  onCommentMod,
  onOpenDependencies,
  onOpenExport,
  onGoToSearch,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [expandedCommentsModId, setExpandedCommentsModId] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  const totalDownloads = modpack.mods.reduce((acc, m) => acc + (m.downloads || 0), 0);

  const filteredMods = modpack.mods.filter((m) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.summary.toLowerCase().includes(q) ||
      (m.categories || []).some((c) => c.toLowerCase().includes(q))
    );
  });

  const handleCommentSubmit = (modId: string, e: React.FormEvent) => {
    e.preventDefault();
    const text = (commentInputs[modId] || '').trim();
    if (!text) return;
    onCommentMod(modId, text);
    setCommentInputs((prev) => ({ ...prev, [modId]: '' }));
  };

  return (
    <div className="space-y-6">
      {/* Prominent Modpack Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/40 p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center space-x-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40">
                <Package className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">{modpack.title}</h1>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              {modpack.description || 'Collaboratively crafted Minecraft modpack with real-time peer reviews and dependency validation.'}
            </p>

            {/* Quick Stats Pill Strip */}
            <div className="flex flex-wrap items-center gap-2 pt-2 text-xs font-medium">
              <span className="rounded-lg bg-slate-800/90 px-3 py-1 text-slate-200 border border-slate-700/60">
                🎮 Minecraft <strong className="text-emerald-400">{modpack.minecraftVersion}</strong>
              </span>
              <span className="rounded-lg bg-slate-800/90 px-3 py-1 text-slate-200 border border-slate-700/60 uppercase">
                ⚙️ <strong className="text-emerald-400">{modpack.modLoader}</strong>
              </span>
              <span className="rounded-lg bg-slate-800/90 px-3 py-1 text-slate-200 border border-slate-700/60">
                📦 <strong className="text-white">{modpack.mods.length}</strong> mods proposed
              </span>
              <span className="rounded-lg bg-slate-800/90 px-3 py-1 text-slate-200 border border-slate-700/60">
                ⬇️ <strong className="text-emerald-400">{formatDownloads(totalDownloads)}</strong> combined
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={onOpenDependencies}
              className="flex items-center space-x-2 rounded-xl border border-slate-700 bg-slate-800/90 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition shadow-sm"
            >
              <Layers className="h-4 w-4 text-emerald-400" />
              <span>Verify Dependencies</span>
            </button>
            <button
              onClick={onOpenExport}
              className="flex items-center space-x-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-lg active:scale-95"
            >
              <Download className="h-4 w-4" />
              <span>Export Modpack</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter / Search within installed mods */}
      {modpack.mods.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter installed mods..."
              className="w-full rounded-xl border border-slate-800 bg-slate-900/80 py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span>
              Showing <strong className="text-white">{filteredMods.length}</strong> of{' '}
              <strong className="text-white">{modpack.mods.length}</strong> mods
            </span>
          </div>
        </div>
      )}

      {/* Mods Grid */}
      {modpack.mods.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center">
          <Package className="h-16 w-16 text-slate-600 mb-4" />
          <h2 className="text-lg font-bold text-white">Your Active Modpack is Empty</h2>
          <p className="max-w-md text-sm text-slate-400 mt-1">
            Search for mods using our AI Natural Language Search or explore our smart recommendations to collaborate with your team!
          </p>
          <button
            onClick={onGoToSearch}
            className="mt-6 flex items-center space-x-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-lg active:scale-95"
          >
            <Sparkles className="h-4 w-4" />
            <span>Discover & Add Mods</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMods.map((mod) => {
            const projectUrl = getModProjectUrl(mod);
            const yesVotes = mod.votes?.yes || [];
            const noVotes = mod.votes?.no || [];
            const hasVotedYes = yesVotes.includes(currentUser);
            const hasVotedNo = noVotes.includes(currentUser);
            const totalVotes = yesVotes.length + noVotes.length;
            const approvalRate = totalVotes > 0 ? Math.round((yesVotes.length / totalVotes) * 100) : 100;
            const isCommentsOpen = expandedCommentsModId === mod.id;
            const commentCount = mod.comments?.length || 0;

            return (
              <div
                key={mod.id}
                className="group relative rounded-2xl border border-slate-800 bg-slate-900/70 p-5 transition-all hover:border-slate-700 hover:bg-slate-900/90 hover:shadow-xl"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                  {/* Left: Icon, Main Info, Description */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {mod.iconUrl ? (
                      <img
                        src={mod.iconUrl}
                        alt={mod.name}
                        className="h-14 w-14 rounded-xl object-cover ring-1 ring-slate-700/80 bg-slate-800 shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-400 ring-1 ring-slate-700/80">
                        <Box className="h-7 w-7" />
                      </div>
                    )}

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Clickable Mod Title */}
                        <a
                          href={projectUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex items-center gap-1.5 text-base font-bold text-white hover:text-emerald-400 transition"
                          title={`View ${mod.name} on ${mod.source}`}
                        >
                          <span className="truncate">{mod.name}</span>
                          <ExternalLink className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 transition shrink-0" />
                        </a>

                        {/* Source Tag */}
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            mod.source === 'modrinth'
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/40'
                              : 'bg-amber-950/80 text-amber-400 border border-amber-800/40'
                          }`}
                        >
                          {mod.source}
                        </span>

                        {/* Downloads */}
                        <span className="inline-flex items-center gap-1 rounded bg-slate-800/90 px-2 py-0.5 text-[11px] font-medium text-slate-300">
                          <Download className="h-3 w-3 text-slate-400" />
                          {formatDownloads(mod.downloads)}
                        </span>

                        {/* Added by */}
                        {mod.addedBy && (
                          <span className="text-[11px] text-slate-400">
                            Suggested by <strong className="text-emerald-400">{mod.addedBy}</strong>
                          </span>
                        )}
                      </div>

                      {/* Brief Description */}
                      <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                        {mod.summary || 'No description available for this mod.'}
                      </p>

                      {/* Category Pills */}
                      {mod.categories && mod.categories.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pt-1">
                          {mod.categories.map((cat, idx) => (
                            <span
                              key={idx}
                              className="rounded-md bg-slate-800/80 px-2 py-0.5 text-[10px] font-medium text-slate-300 border border-slate-700/40"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Voting & Remove Controls */}
                  <div className="flex flex-wrap lg:flex-col items-end justify-between gap-3 shrink-0 border-t lg:border-t-0 border-slate-800/80 pt-3 lg:pt-0">
                    {/* Voting Controls */}
                    <div className="flex items-center space-x-2 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 px-1 font-medium">Vote:</span>

                      {/* Yes Vote */}
                      <button
                        onClick={() => onVoteMod(mod.id, 'yes')}
                        className={`flex items-center space-x-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                          hasVotedYes
                            ? 'bg-emerald-600 text-white shadow'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-emerald-400'
                        }`}
                        title={yesVotes.length > 0 ? `Voted yes: ${yesVotes.join(', ')}` : 'Vote Yes'}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                        <span>{yesVotes.length}</span>
                      </button>

                      {/* No Vote */}
                      <button
                        onClick={() => onVoteMod(mod.id, 'no')}
                        className={`flex items-center space-x-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                          hasVotedNo
                            ? 'bg-rose-600 text-white shadow'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-rose-400'
                        }`}
                        title={noVotes.length > 0 ? `Voted no: ${noVotes.join(', ')}` : 'Vote No'}
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                        <span>{noVotes.length}</span>
                      </button>
                    </div>

                    {/* Approval Rating & Remove Button */}
                    <div className="flex items-center space-x-3">
                      {totalVotes > 0 && (
                        <span className="text-[11px] font-semibold text-emerald-400">
                          {approvalRate}% Approval
                        </span>
                      )}

                      <button
                        onClick={() => onRemoveMod(mod.id)}
                        className="flex items-center space-x-1 rounded-lg border border-rose-900/40 bg-rose-950/20 px-2.5 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-900/50 hover:text-white transition"
                        title="Remove mod from pack"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Mod Discussion / Comments Section */}
                <div className="mt-4 border-t border-slate-800/80 pt-3">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() =>
                        setExpandedCommentsModId(isCommentsOpen ? null : mod.id)
                      }
                      className="flex items-center space-x-1.5 text-xs font-semibold text-slate-400 hover:text-emerald-400 transition"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Collaborator Discussion ({commentCount})</span>
                      {isCommentsOpen ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>

                    {commentCount > 0 && !isCommentsOpen && (
                      <span className="text-[11px] text-slate-500 italic">
                        Latest: "{mod.comments![mod.comments!.length - 1].text.substring(0, 40)}..."
                      </span>
                    )}
                  </div>

                  {/* Expanded Comments Thread */}
                  {isCommentsOpen && (
                    <div className="mt-3 space-y-3 rounded-xl bg-slate-950/60 p-4 border border-slate-800/60">
                      {/* Comments List */}
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {commentCount === 0 ? (
                          <p className="text-xs text-slate-500 italic py-2">
                            No comments yet. Share your thoughts or compatibility notes on this mod with your team!
                          </p>
                        ) : (
                          mod.comments!.map((comment) => (
                            <div
                              key={comment.id}
                              className="rounded-lg bg-slate-900/90 p-2.5 border border-slate-800/80 text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-emerald-400">{comment.user}</span>
                                <span className="text-[10px] text-slate-500">
                                  {new Date(comment.createdAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <p className="text-slate-200">{comment.text}</p>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Add Comment Input */}
                      <form
                        onSubmit={(e) => handleCommentSubmit(mod.id, e)}
                        className="flex items-center gap-2 pt-1"
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
                          placeholder={`Add a note or review for ${mod.name}...`}
                          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={!(commentInputs[mod.id] || '').trim()}
                          className="flex items-center space-x-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-40 transition shadow"
                        >
                          <Send className="h-3 w-3" />
                          <span>Post</span>
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
    </div>
  );
};
