import React, { useState } from 'react';
import {
  Download,
  ExternalLink,
  Layers,
  MessageSquare,
  Package,
  Plus,
  Search,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { Modpack } from '../types';
import { formatDownloads, getModProjectUrl } from '../utils/format';

interface ActiveModpackViewProps {
  modpack: Modpack;
  currentUser: string;
  onRemoveMod: (modId: string) => void;
  onVoteMod: (modId: string, vote: 'yes' | 'no') => void;
  onCommentMod: (modId: string, text: string) => void;
  onOpenExport: () => void;
  onOpenDependencies: () => void;
  onGoToSearch: () => void;
}

export const ActiveModpackView: React.FC<ActiveModpackViewProps> = ({
  modpack,
  currentUser,
  onRemoveMod,
  onVoteMod,
  onCommentMod,
  onOpenExport,
  onOpenDependencies,
  onGoToSearch,
}) => {
  const [filterText, setFilterText] = useState('');
  const [expandedCommentsModId, setExpandedCommentsModId] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  const filteredMods = modpack.mods.filter((mod) => {
    const query = filterText.toLowerCase();
    return (
      mod.name.toLowerCase().includes(query) ||
      mod.summary.toLowerCase().includes(query) ||
      mod.categories.some((c) => c.toLowerCase().includes(query))
    );
  });

  const totalDownloads = modpack.mods.reduce((acc, m) => acc + (m.downloads || 0), 0);

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
      <div className="relative overflow-hidden rounded-2xl border border-violet-900/40 bg-gradient-to-r from-[#0d1226] via-[#11183c]/90 to-[#1e1447]/60 p-6 sm:p-8 shadow-xl shadow-black/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center space-x-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 text-violet-400 ring-1 ring-violet-500/40 shadow-inner">
                <Package className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">{modpack.title}</h1>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              {modpack.description || 'Collaboratively crafted Minecraft modpack with real-time peer reviews and dependency validation.'}
            </p>

            {/* Quick Stats Pill Strip */}
            <div className="flex flex-wrap items-center gap-2 pt-2 text-xs font-medium">
              <span className="rounded-lg bg-slate-900/90 px-3 py-1 text-slate-200 border border-slate-800">
                🎮 Minecraft <strong className="text-blue-400">{modpack.minecraftVersion}</strong>
              </span>
              <span className="rounded-lg bg-slate-900/90 px-3 py-1 text-slate-200 border border-slate-800 uppercase">
                ⚙️ <strong className="text-violet-400">{modpack.modLoader}</strong>
              </span>
              <span className="rounded-lg bg-slate-900/90 px-3 py-1 text-slate-200 border border-slate-800">
                📦 <strong className="text-white">{modpack.mods.length}</strong> mods proposed
              </span>
              <span className="rounded-lg bg-slate-900/90 px-3 py-1 text-slate-200 border border-slate-800">
                ⬇️ <strong className="text-fuchsia-400">{formatDownloads(totalDownloads)}</strong> combined
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={onOpenDependencies}
              className="flex items-center space-x-2 rounded-xl border border-slate-700 bg-slate-800/90 px-4 py-2.5 text-xs font-bold text-slate-200 hover:border-violet-500/60 hover:bg-slate-700 hover:text-white transition shadow-sm cursor-pointer"
            >
              <Layers className="h-4 w-4 text-blue-400" />
              <span>Verify Dependencies</span>
            </button>
            <button
              onClick={onOpenExport}
              className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-5 py-2.5 text-xs font-bold text-white hover:from-blue-500 hover:to-violet-500 transition shadow-lg shadow-blue-900/30 active:scale-95 cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Export Modpack</span>
            </button>
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="pointer-events-none absolute -bottom-12 -right-12 h-64 w-64 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="pointer-events-none absolute -top-12 -left-12 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl" />
      </div>

      {/* Filter / Search within installed mods */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder={`Filter ${modpack.mods.length} installed mods by title, category, or summary...`}
            className="w-full rounded-xl border border-slate-800 bg-[#0d1226]/80 py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30 shadow-inner"
          />
        </div>

        <button
          onClick={onGoToSearch}
          className="flex items-center space-x-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-violet-500/50 hover:bg-slate-700 hover:text-white transition shadow-sm cursor-pointer"
        >
          <Plus className="h-4 w-4 text-violet-400" />
          <span>Add More Mods</span>
        </button>
      </div>

      {/* Mod List */}
      {modpack.mods.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center text-slate-400">
          <Package className="mx-auto h-12 w-12 text-slate-600 mb-3" />
          <h3 className="text-base font-bold text-white">Your Collaborative Modpack is Empty</h3>
          <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
            Search for mods using our AI Natural Language Search or explore our smart recommendations to collaborate with your team!
          </p>
          <button
            onClick={onGoToSearch}
            className="mt-6 inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-5 py-2.5 text-xs font-bold text-white hover:from-blue-500 hover:to-violet-500 transition shadow-lg shadow-blue-900/30 active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Discover & Add Mods</span>
          </button>
        </div>
      ) : filteredMods.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 p-8 text-center text-slate-400">
          <p className="text-sm">No proposed mods match "{filterText}".</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMods.map((mod) => {
            const projectUrl = getModProjectUrl(mod);
            const yesVotes = mod.votes?.yes || [];
            const noVotes = mod.votes?.no || [];
            const totalVotes = yesVotes.length + noVotes.length;
            const approvalRate =
              totalVotes > 0 ? Math.round((yesVotes.length / totalVotes) * 100) : 100;
            const hasVotedYes = yesVotes.includes(currentUser);
            const hasVotedNo = noVotes.includes(currentUser);
            const isCommentsOpen = expandedCommentsModId === mod.id;
            const commentCount = mod.comments?.length || 0;

            return (
              <div
                key={mod.id}
                className="rounded-2xl border border-slate-800/80 bg-[#0d1226]/70 p-4 sm:p-5 transition hover:border-violet-600/40 hover:bg-[#111630]/90 shadow-sm"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Left: Icon & Details */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {mod.iconUrl ? (
                      <img
                        src={mod.iconUrl}
                        alt={mod.name}
                        className="h-14 w-14 rounded-xl object-cover ring-1 ring-slate-700/60 bg-slate-800 shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-400 ring-1 ring-slate-700/60">
                        <Package className="h-7 w-7" />
                      </div>
                    )}

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Clickable Mod Title */}
                        <a
                          href={projectUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex items-center gap-1.5 text-base font-bold text-white hover:text-blue-400 transition"
                          title={`View ${mod.name} on ${mod.source}`}
                        >
                          <span className="truncate">{mod.name}</span>
                          <ExternalLink className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 transition shrink-0" />
                        </a>

                        {/* Source Tag */}
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            mod.source === 'modrinth'
                              ? 'bg-blue-950/80 text-blue-300 border border-blue-800/40'
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
                            Suggested by <strong className="text-violet-400">{mod.addedBy}</strong>
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
                              className="rounded-md bg-slate-900/80 px-2 py-0.5 text-[10px] font-medium text-slate-300 border border-slate-800"
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
                        className={`flex items-center space-x-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                          hasVotedYes
                            ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow shadow-blue-900/40'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-blue-400'
                        }`}
                        title={yesVotes.length > 0 ? `Voted yes: ${yesVotes.join(', ')}` : 'Vote Yes'}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                        <span>{yesVotes.length}</span>
                      </button>

                      {/* No Vote */}
                      <button
                        onClick={() => onVoteMod(mod.id, 'no')}
                        className={`flex items-center space-x-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
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
                        <span className="text-[11px] font-semibold text-violet-400">
                          {approvalRate}% Approval
                        </span>
                      )}

                      <button
                        onClick={() => onRemoveMod(mod.id)}
                        className="flex items-center space-x-1 rounded-lg border border-rose-900/40 bg-rose-950/20 px-2.5 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-900/50 hover:text-white transition cursor-pointer"
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
                      className="flex items-center space-x-1.5 text-xs font-semibold text-slate-400 hover:text-violet-400 transition cursor-pointer"
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
                                <span className="font-bold text-violet-400">{comment.user}</span>
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
                          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={!(commentInputs[mod.id] || '').trim()}
                          className="flex items-center space-x-1 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:from-blue-500 hover:to-violet-500 disabled:opacity-40 transition shadow cursor-pointer"
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
