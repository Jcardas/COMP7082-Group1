import React from 'react';
import { Box, Download, Layers, Users, Sparkles, Package, Compass } from 'lucide-react';
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
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-900/95 backdrop-blur-md shadow-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 ring-1 ring-emerald-500/40 shadow-inner">
            <Box className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-extrabold tracking-tight text-white flex items-center gap-1.5">
                MCMC
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-700/50">
                  LIVE
                </span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium truncate hidden sm:block">
              Minecraft Collaborative Modpack Creator •{' '}
              <span className="text-slate-200">MC {minecraftVersion}</span> ({modLoader})
            </p>
          </div>
        </div>

        {/* Center Prominent Navigation Tabs */}
        <nav className="flex items-center space-x-1 rounded-xl bg-slate-950/80 p-1 border border-slate-800/80">
          <button
            onClick={() => onTabChange('pack')}
            className={`flex items-center space-x-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'pack'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Package className="h-4 w-4" />
            <span>Active Modpack</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                activeTab === 'pack' ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-800 text-emerald-400'
              }`}
            >
              {modCount}
            </span>
          </button>

          <button
            onClick={() => onTabChange('search')}
            className={`flex items-center space-x-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'search'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Compass className="h-4 w-4" />
            <span>Search & AI</span>
          </button>

          <button
            onClick={() => onTabChange('recommendations')}
            className={`flex items-center space-x-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'recommendations'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="h-4 w-4 text-amber-400" />
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
            className="flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition"
            title="Inspect graphlib dependency graph & cycle check"
          >
            <Layers className="h-4 w-4 text-emerald-400" />
            <span className="hidden lg:inline">Dependencies</span>
          </button>

          {/* Export to Zip Button */}
          <button
            onClick={onOpenExport}
            className="flex items-center space-x-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-500 transition active:scale-95"
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
