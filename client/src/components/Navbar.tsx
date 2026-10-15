import React from 'react';
import { Download, Layers, Users, Sparkles, Package, Compass } from 'lucide-react';
import type { UserPresence } from '../types';

export type ActiveTab = 'pack' | 'search' | 'recommendations';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  minecraftVersion: string;
  modLoader: string;
  activeUsers: UserPresence[];
  currentUser: string;
  onOpenExport: () => void;
  onOpenDependencies: () => void;
  modCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  minecraftVersion,
  modLoader,
  activeUsers,
  currentUser,
  onOpenExport,
  onOpenDependencies,
  modCount,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#090d1f]/90 backdrop-blur-md shadow-lg shadow-black/40">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand / Logo using MCMC.png */}
        <div className="flex items-center space-x-3">
          <div className="relative group">
            <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 opacity-60 blur-xs transition group-hover:opacity-100" />
            <img
              src="/MCMC.png"
              alt="MCMC Logo"
              className="relative h-10 w-10 rounded-xl object-contain bg-slate-950 p-0.5 ring-1 ring-violet-500/40 shadow-inner"
            />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-black tracking-tight bg-gradient-to-r from-blue-400 via-violet-300 to-fuchsia-400 bg-clip-text text-transparent flex items-center gap-1.5">
                MCMC
                <span className="text-[10px] font-bold tracking-wider text-fuchsia-300 bg-fuchsia-950/80 px-2 py-0.5 rounded-full border border-fuchsia-700/50 shadow-sm shadow-fuchsia-900/30">
                  LIVE
                </span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium truncate hidden sm:block">
              Minecraft Collaborative Modpack Creator •{' '}
              <span className="text-blue-300 font-semibold">MC {minecraftVersion}</span> ({modLoader})
            </p>
          </div>
        </div>

        {/* Center Prominent Navigation Tabs */}
        <nav className="flex items-center space-x-1 rounded-xl bg-slate-950/80 p-1 border border-slate-800/80 shadow-inner">
          <button
            onClick={() => onTabChange('pack')}
            className={`flex items-center space-x-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'pack'
                ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-md shadow-violet-900/40'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Package className="h-4 w-4" />
            <span>Active Modpack</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                activeTab === 'pack' ? 'bg-violet-950 text-violet-200' : 'bg-slate-800 text-violet-400'
              }`}
            >
              {modCount}
            </span>
          </button>

          <button
            onClick={() => onTabChange('search')}
            className={`flex items-center space-x-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'search'
                ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-md shadow-violet-900/40'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Compass className="h-4 w-4" />
            <span>Search & AI</span>
          </button>

          <button
            onClick={() => onTabChange('recommendations')}
            className={`flex items-center space-x-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'recommendations'
                ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-md shadow-violet-900/40'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="h-4 w-4 text-fuchsia-400" />
            <span className="hidden sm:inline">Recommendations</span>
            <span className="sm:hidden">Recs</span>
          </button>
        </nav>

        {/* Right Action Controls & Active Users */}
        <div className="flex items-center space-x-2.5">
          {/* Active Collaborators Presence */}
          <div
            className="hidden md:flex items-center space-x-1.5 rounded-full bg-slate-800/80 px-3 py-1 text-xs border border-slate-700/60"
            title={`Active group: ${activeUsers.map((u) => u.username).join(', ')}`}
          >
            <Users className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-slate-300 font-medium">{activeUsers.length} online</span>
            <div className="flex -space-x-1 ml-1 overflow-hidden" title={`You: ${currentUser}`}>
              {activeUsers.slice(0, 4).map((u) => (
                <div
                  key={u.socketId}
                  title={u.username}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white border border-slate-900"
                  style={{ backgroundColor: u.color }}
                >
                  {u.username.substring(0, 1).toUpperCase()}
                </div>
              ))}
            </div>
          </div>

          {/* Dependency Graph Modal Trigger */}
          <button
            onClick={onOpenDependencies}
            className="flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-violet-500/50 hover:bg-slate-700 hover:text-white transition cursor-pointer"
            title="Inspect graphlib dependency graph & cycle check"
          >
            <Layers className="h-4 w-4 text-blue-400" />
            <span className="hidden lg:inline">Dependencies</span>
          </button>

          {/* Export to Zip Button */}
          <button
            onClick={onOpenExport}
            className="flex items-center space-x-1.5 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-blue-900/30 hover:from-blue-500 hover:to-violet-500 transition active:scale-95 cursor-pointer"
            title="Export to CurseForge/Modrinth zip"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>
      </div>
    </header>
  );
};
