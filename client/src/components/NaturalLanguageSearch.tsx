import React, { useState } from 'react';
import { Sparkles, Filter } from 'lucide-react';
import { COMMON_MC_VERSIONS } from '../types';

interface NaturalLanguageSearchProps {
  onSearch: (query: string, loader: string, version: string) => void;
  isLoading: boolean;
  selectedLoader: string;
  selectedVersion: string;
  onLoaderChange: (loader: string) => void;
  onVersionChange: (version: string) => void;
}

const PROMPT_SUGGESTIONS = [
  '⚡ High performance & optimization mods for smooth FPS',
  '🧙 Magic spells, spellbooks, and enchanting shrines',
  '⚙️ Create tech automation, machinery & trains',
  '🏰 Dungeons, boss fights and adventurous RPG loot',
  '🌾 Cozy farming, expanded cooking, and peaceful wildlife',
  '🗺️ Biome overhaul and expansive world terrain',
];

export const NaturalLanguageSearch: React.FC<NaturalLanguageSearchProps> = ({
  onSearch,
  isLoading,
  selectedLoader,
  selectedVersion,
  onLoaderChange,
  onVersionChange,
}) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query, selectedLoader, selectedVersion);
  };

  const handleSuggestionClick = (prompt: string) => {
    // Strip leading emoji
    const cleanPrompt = prompt.replace(/^[\p{Emoji}\s]+/u, '');
    setQuery(cleanPrompt);
    onSearch(cleanPrompt, selectedLoader, selectedVersion);
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl backdrop-blur-md">
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Search Bar */}
        <div className="relative flex items-center">
          <div className="pointer-events-none absolute left-4 flex items-center text-emerald-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search with AI: e.g. 'I want lightweight performance mods and biome overhaul'..."
            className="w-full rounded-xl border border-slate-700/80 bg-slate-950/80 py-3.5 pl-12 pr-32 text-sm text-slate-100 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition shadow-inner"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="absolute right-2 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition shadow active:scale-95"
          >
            {isLoading ? 'Searching...' : 'AI Search'}
          </button>
        </div>

        {/* Filters and Suggestions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Natural Language Prompt Pills */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto py-1">
            <span className="text-slate-400 flex items-center gap-1 mr-1 font-medium">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" /> Prompts:
            </span>
            {PROMPT_SUGGESTIONS.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSuggestionClick(item)}
                className="rounded-full border border-slate-700/70 bg-slate-800/60 px-3 py-1 text-slate-300 hover:border-emerald-500/60 hover:bg-slate-700 hover:text-white transition shadow-sm"
              >
                {item}
              </button>
            ))}
          </div>

          {/* Loader & Version selectors */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center space-x-1.5 rounded-lg border border-slate-700/80 bg-slate-800/80 px-2.5 py-1.5">
              <Filter className="h-3.5 w-3.5 text-emerald-400" />
              <select
                value={selectedLoader}
                onChange={(e) => onLoaderChange(e.target.value)}
                className="bg-transparent text-slate-200 outline-none font-medium cursor-pointer"
              >
                <option value="forge" className="bg-slate-900">Forge</option>
                <option value="fabric" className="bg-slate-900">Fabric</option>
                <option value="neoforge" className="bg-slate-900">NeoForge</option>
                <option value="quilt" className="bg-slate-900">Quilt</option>
              </select>
            </div>

            <div className="flex items-center space-x-1.5 rounded-lg border border-slate-700/80 bg-slate-800/80 px-2.5 py-1.5">
              <span className="text-slate-400 font-medium">MC:</span>
              <select
                value={selectedVersion}
                onChange={(e) => onVersionChange(e.target.value)}
                className="bg-transparent text-slate-200 outline-none font-medium cursor-pointer"
              >
                {COMMON_MC_VERSIONS.map((v) => (
                  <option key={v} value={v} className="bg-slate-900">
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
