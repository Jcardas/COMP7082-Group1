import { useEffect, useState } from 'react';
import {
  Flame,
  MessageSquare,
  Package,
  Send,
  Sparkles,
} from 'lucide-react';
import { ActiveModpackView } from './components/ActiveModpackView';
import { DependencyViewer } from './components/DependencyViewer';
import { ExportModal } from './components/ExportModal';
import { ModCard } from './components/ModCard';
import { NaturalLanguageSearch } from './components/NaturalLanguageSearch';
import { Navbar, type ActiveTab } from './components/Navbar';
import { analyzeDependencies, getModpack, getRecommendations, searchMods } from './services/api';
import { socket } from './services/socket';
import type {
  DependencyAnalysisResult,
  ModComment,
  ModItem,
  Modpack,
  UserPresence,
} from './types';

// Mock temporary session user for demo real-time collaboration
const DEFAULT_USER = `Crafter_${Math.floor(100 + Math.random() * 900)}`;
const USER_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'];
const ASSIGNED_COLOR = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];

export function App() {
  const [currentUser] = useState<string>(DEFAULT_USER);
  const [userColor] = useState<string>(ASSIGNED_COLOR);
  const [modpackId] = useState<string>('demo-modpack');

  // Navigation & Active View
  const [activeTab, setActiveTab] = useState<ActiveTab>('pack');

  // Core Modpack State
  const [modpack, setModpack] = useState<Modpack>({
    id: 'demo-modpack',
    title: 'Collaborative Minecraft Pack',
    description: 'A custom Minecraft modpack created with teammates featuring automation, adventure, and optimizations!',
    minecraftVersion: '1.20.1',
    modLoader: 'forge',
    mods: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Selected global filters
  const [selectedLoader, setSelectedLoader] = useState<string>('forge');
  const [selectedVersion, setSelectedVersion] = useState<string>('1.20.1');

  // Search & Filter State
  const [searchResults, setSearchResults] = useState<ModItem[]>([]);
  const [searchSource, setSearchSource] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);

  // Recommendations State
  const [recommendations, setRecommendations] = useState<ModItem[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);

  // Collaboration State
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
  const [messages, setMessages] = useState<Array<{ id: string; user: string; text: string; time: string }>>([]);
  const [chatInput, setChatInput] = useState('');

  // Modals & Analysis
  const [isDepModalOpen, setIsDepModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [depAnalysis, setDepAnalysis] = useState<DependencyAnalysisResult | null>(null);
  const [isAnalyzingDeps, setIsAnalyzingDeps] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleSearch = async (query: string, loader: string, version: string) => {
    try {
      setIsSearching(true);
      const data = await searchMods(query, loader, version);
      setSearchResults(data.results);
      setSearchSource(data.source);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchRecommendations = async () => {
    try {
      setIsLoadingRecs(true);
      const recs = await getRecommendations(modpack.mods, selectedLoader, selectedVersion);
      setRecommendations(recs);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
    } finally {
      setIsLoadingRecs(false);
    }
  };

  const runDependencyCheck = async () => {
    try {
      setIsAnalyzingDeps(true);
      const result = await analyzeDependencies(modpack.mods);
      setDepAnalysis(result);
    } catch (err) {
      console.error('Dependency check failed:', err);
    } finally {
      setIsAnalyzingDeps(false);
    }
  };

  // Initial Load & Socket Collaboration Setup
  useEffect(() => {
    getModpack(modpackId)
      .then((pack) => {
        if (pack) {
          setModpack(pack);
          setSelectedLoader(pack.modLoader);
          setSelectedVersion(pack.minecraftVersion);
        }
      })
      .catch((err) => console.warn('Could not fetch modpack from server:', err));

    // Connect to Room
    socket.emit('join_room', {
      modpackId,
      username: currentUser,
      color: userColor,
    });

    // Initial search for popular starter mods
    handleSearch('', selectedLoader, selectedVersion);

    // Listeners
    socket.on('room_users', (users: UserPresence[]) => {
      setActiveUsers(users);
    });

    socket.on('mod_added', ({ mod, user }: { mod: ModItem; user: string }) => {
      setModpack((prev) => {
        if (prev.mods.some((m) => m.id === mod.id)) return prev;
        return {
          ...prev,
          mods: [...prev.mods, { ...mod, addedBy: user, votes: mod.votes || { yes: [user], no: [] } }],
        };
      });
      showNotification(`➕ ${user} proposed "${mod.name}"`);
    });

    socket.on('mod_removed', ({ modId, user }: { modId: string; user: string }) => {
      setModpack((prev) => ({
        ...prev,
        mods: prev.mods.filter((m) => m.id !== modId),
      }));
      showNotification(`🗑️ ${user} removed a mod`);
    });

    socket.on('mod_voted', ({ modId, vote, user }: { modId: string; vote: 'yes' | 'no'; user: string }) => {
      setModpack((prev) => ({
        ...prev,
        mods: prev.mods.map((mod) => {
          if (mod.id !== modId) return mod;
          const currentVotes = mod.votes || { yes: [], no: [] };
          let newYes = [...currentVotes.yes];
          let newNo = [...currentVotes.no];

          if (vote === 'yes') {
            if (newYes.includes(user)) {
              newYes = newYes.filter((u) => u !== user);
            } else {
              newYes.push(user);
              newNo = newNo.filter((u) => u !== user);
            }
          } else {
            if (newNo.includes(user)) {
              newNo = newNo.filter((u) => u !== user);
            } else {
              newNo.push(user);
              newYes = newYes.filter((u) => u !== user);
            }
          }

          return { ...mod, votes: { yes: newYes, no: newNo } };
        }),
      }));
      showNotification(`🗳️ ${user} voted ${vote.toUpperCase()} on a mod`);
    });

    socket.on('mod_commented', ({ modId, comment }: { modId: string; comment: ModComment }) => {
      setModpack((prev) => ({
        ...prev,
        mods: prev.mods.map((mod) => {
          if (mod.id !== modId) return mod;
          return {
            ...mod,
            comments: [...(mod.comments || []), comment],
          };
        }),
      }));
      showNotification(`💬 ${comment.user} commented on a mod`);
    });

    socket.on('chat_message', (msg) => {
      setMessages((prev) => [...prev.slice(-30), msg]);
    });

    return () => {
      socket.off('room_users');
      socket.off('mod_added');
      socket.off('mod_removed');
      socket.off('mod_voted');
      socket.off('mod_commented');
      socket.off('chat_message');
    };
  }, [modpackId, currentUser, userColor]);

  // Re-fetch recommendations and re-verify dependencies on mods change
  useEffect(() => {
    runDependencyCheck();
    fetchRecommendations();
  }, [modpack.mods.length, selectedLoader, selectedVersion]);

  // Actions
  const handleAddMod = (mod: ModItem) => {
    const modWithUser: ModItem = {
      ...mod,
      addedBy: currentUser,
      votes: { yes: [currentUser], no: [] },
      comments: [],
    };

    setModpack((prev) => {
      if (prev.mods.some((m) => m.id === mod.id)) return prev;
      return {
        ...prev,
        mods: [...prev.mods, modWithUser],
      };
    });

    socket.emit('mod_add', {
      modpackId,
      mod: modWithUser,
      user: currentUser,
    });
  };

  const handleRemoveMod = (modId: string) => {
    setModpack((prev) => ({
      ...prev,
      mods: prev.mods.filter((m) => m.id !== modId),
    }));

    socket.emit('mod_remove', {
      modpackId,
      modId,
      user: currentUser,
    });
  };

  const handleVoteMod = (modId: string, vote: 'yes' | 'no') => {
    // Optimistic update
    setModpack((prev) => ({
      ...prev,
      mods: prev.mods.map((mod) => {
        if (mod.id !== modId) return mod;
        const currentVotes = mod.votes || { yes: [], no: [] };
        let newYes = [...currentVotes.yes];
        let newNo = [...currentVotes.no];

        if (vote === 'yes') {
          if (newYes.includes(currentUser)) {
            newYes = newYes.filter((u) => u !== currentUser);
          } else {
            newYes.push(currentUser);
            newNo = newNo.filter((u) => u !== currentUser);
          }
        } else {
          if (newNo.includes(currentUser)) {
            newNo = newNo.filter((u) => u !== currentUser);
          } else {
            newNo.push(currentUser);
            newYes = newYes.filter((u) => u !== currentUser);
          }
        }

        return { ...mod, votes: { yes: newYes, no: newNo } };
      }),
    }));

    socket.emit('mod_vote', {
      modpackId,
      modId,
      vote,
      user: currentUser,
    });
  };

  const handleCommentMod = (modId: string, text: string) => {
    const newComment: ModComment = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      user: currentUser,
      text,
      createdAt: new Date().toISOString(),
    };

    setModpack((prev) => ({
      ...prev,
      mods: prev.mods.map((mod) => {
        if (mod.id !== modId) return mod;
        return {
          ...mod,
          comments: [...(mod.comments || []), newComment],
        };
      }),
    }));

    socket.emit('mod_comment', {
      modpackId,
      modId,
      comment: newComment,
    });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    socket.emit('chat_message', {
      modpackId,
      user: currentUser,
      text: chatInput.trim(),
    });

    setChatInput('');
  };

  const installedModIds = new Set(modpack.mods.map((m) => m.id));

  return (
    <div className="min-h-screen bg-[#070913] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.12),rgba(255,255,255,0))] text-slate-100 flex flex-col font-sans">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-2 rounded-xl border border-violet-500/50 bg-[#0d1226]/95 px-4 py-3 text-sm font-semibold text-violet-200 shadow-2xl shadow-violet-950/60 backdrop-blur-md animate-in slide-in-from-bottom-2">
          <span>{notification}</span>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        minecraftVersion={selectedVersion}
        modLoader={selectedLoader}
        activeUsers={activeUsers}
        currentUser={currentUser}
        onOpenExport={() => setIsExportModalOpen(true)}
        onOpenDependencies={() => {
          runDependencyCheck();
          setIsDepModalOpen(true);
        }}
        modCount={modpack.mods.length}
      />

      {/* Main Workspace Body */}
      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* TAB 1: ACTIVE MODPACK (Prominent Primary View) */}
        {activeTab === 'pack' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <ActiveModpackView
                modpack={modpack}
                currentUser={currentUser}
                onRemoveMod={handleRemoveMod}
                onVoteMod={handleVoteMod}
                onCommentMod={handleCommentMod}
                onOpenDependencies={() => {
                  runDependencyCheck();
                  setIsDepModalOpen(true);
                }}
                onOpenExport={() => setIsExportModalOpen(true)}
                onGoToSearch={() => setActiveTab('search')}
              />
            </div>

            {/* Sidebar: Group Chat & Real-Time Presence */}
            <div className="lg:col-span-4 space-y-4">
              {/* Quick Jump to AI Discovery Card */}
              <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-br from-[#0d1226] to-[#070913] p-5 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-blue-500/40 via-violet-500/40 to-transparent" />
                <div className="flex items-center space-x-2 text-violet-400">
                  <Sparkles className="h-5 w-5" />
                  <h3 className="text-sm font-bold text-white">Need more mods?</h3>
                </div>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  Use our Natural Language AI search to describe your ideal gameplay or check tailored recommendations.
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setActiveTab('search')}
                    className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 py-2 text-xs font-bold text-white hover:from-blue-500 hover:to-violet-500 transition shadow-md shadow-blue-900/30 cursor-pointer"
                  >
                    AI Search
                  </button>
                  <button
                    onClick={() => setActiveTab('recommendations')}
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 py-2 text-xs font-bold text-slate-200 hover:border-violet-500/50 hover:bg-slate-700 transition cursor-pointer"
                  >
                    Recommendations
                  </button>
                </div>
              </div>

              {/* Team Chat Box */}
              <div className="rounded-2xl border border-slate-800/80 bg-[#0d1226]/70 p-4 shadow-xl backdrop-blur-sm">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="h-4 w-4 text-blue-400" />
                    <h3 className="font-bold text-xs text-white uppercase tracking-wider">Group Chat</h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Logged in as {currentUser}</span>
                </div>

                <div className="mt-3 h-64 overflow-y-auto space-y-2 pr-1 text-xs">
                  {messages.length === 0 ? (
                    <p className="text-center text-slate-500 py-16 text-[11px] italic">
                      No messages yet. Chat with teammates in real-time as you curate the modpack!
                    </p>
                  ) : (
                    messages.map((m) => (
                      <div key={m.id} className="rounded-xl bg-slate-950/60 p-2.5 border border-slate-800/60">
                        <span className="font-bold text-violet-400 text-[10px] block">
                          {m.user}:
                        </span>
                        <p className="text-slate-300 mt-0.5 leading-relaxed">{m.text}</p>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleSendMessage} className="mt-3 flex gap-1.5">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Message your teammates..."
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-3 py-2 text-xs font-bold text-white hover:from-blue-500 hover:to-violet-500 transition shadow cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SEARCH & AI DISCOVER */}
        {activeTab === 'search' && (
          <div className="space-y-6">
            {/* Natural Language Prompt Search Bar */}
            <NaturalLanguageSearch
              onSearch={handleSearch}
              isLoading={isSearching}
              selectedLoader={selectedLoader}
              selectedVersion={selectedVersion}
              onLoaderChange={(loader) => {
                setSelectedLoader(loader);
                setModpack((prev) => ({ ...prev, modLoader: loader as any }));
              }}
              onVersionChange={(ver) => {
                setSelectedVersion(ver);
                setModpack((prev) => ({ ...prev, minecraftVersion: ver }));
              }}
            />

            {/* Search Results Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-violet-400" />
                <h2 className="text-base font-bold text-white">
                  {searchResults.length > 0 ? 'Search Results' : 'Featured Mods'}
                </h2>
                <span className="text-xs text-slate-400 font-mono">({searchResults.length} mods found)</span>
              </div>
              {searchSource && (
                <span className="text-xs text-slate-400 bg-slate-900/90 px-2.5 py-1 rounded-lg border border-slate-800">
                  Search Engine: <strong className="text-violet-400">{searchSource}</strong>
                </span>
              )}
            </div>

            {/* Results Grid */}
            {isSearching ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-violet-500 border-t-transparent" />
                <p className="text-sm font-medium">Extracting concepts & querying mod repositories...</p>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {searchResults.map((mod) => (
                  <ModCard
                    key={mod.id}
                    mod={mod}
                    isInstalled={installedModIds.has(mod.id)}
                    onAdd={handleAddMod}
                    onRemove={handleRemoveMod}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center text-slate-400">
                <Package className="mx-auto h-10 w-10 text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-slate-300">No mods found matching your query.</p>
                <p className="text-xs text-slate-500 mt-1">Try typing a sentence describing the gameplay you want or broaden your keywords.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SMART RECOMMENDATIONS */}
        {activeTab === 'recommendations' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <Flame className="h-5 w-5 text-fuchsia-400" />
                  <h2 className="text-lg font-bold text-white">Smart Recommendations</h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Companion mods, addons, and popular ecosystem staples tailored to your active pack.
                </p>
              </div>

              <button
                onClick={fetchRecommendations}
                disabled={isLoadingRecs}
                className="self-start sm:self-auto rounded-xl bg-slate-800/90 border border-slate-700 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-violet-500/50 hover:bg-slate-700 transition cursor-pointer"
              >
                {isLoadingRecs ? 'Analyzing...' : 'Refresh Recs'}
              </button>
            </div>

            {isLoadingRecs ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-violet-500 border-t-transparent" />
                <p className="text-sm font-medium">Calculating companion synergy & category overlaps...</p>
              </div>
            ) : recommendations.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recommendations.map((mod) => (
                  <ModCard
                    key={mod.id}
                    mod={mod}
                    isInstalled={installedModIds.has(mod.id)}
                    onAdd={handleAddMod}
                    onRemove={handleRemoveMod}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center text-slate-400">
                <Flame className="mx-auto h-10 w-10 text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-slate-300">All recommended mods already installed!</p>
                <p className="text-xs text-slate-500 mt-1">Add mods from different categories to explore more companion suggestions.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Dependency Modal */}
      <DependencyViewer
        isOpen={isDepModalOpen}
        onClose={() => setIsDepModalOpen(false)}
        analysis={depAnalysis}
        isLoading={isAnalyzingDeps}
        onRefresh={runDependencyCheck}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        modpack={modpack}
      />
    </div>
  );
}
export default App;
