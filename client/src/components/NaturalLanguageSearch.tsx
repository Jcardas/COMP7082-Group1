import React, { useState } from 'react';
import { COMMON_MC_VERSIONS, POPULAR_MOD_CATEGORIES } from '../types/consts';
import type { SearchFilterOptions } from '../services/api';

interface NaturalLanguageSearchProps {
  onSearch: (opts: SearchFilterOptions) => void;
  isLoading: boolean;
  selectedLoader: string;
  selectedVersion: string;
  selectedCategory: string;
  selectedSource: 'both' | 'modrinth' | 'curseforge';
  onLoaderChange: (loader: string) => void;
  onVersionChange: (version: string) => void;
  onCategoryChange: (category: string) => void;
  onSourceChange: (source: 'both' | 'modrinth' | 'curseforge') => void;
}

export const NaturalLanguageSearch: React.FC<NaturalLanguageSearchProps> = ({
  onSearch,
  isLoading,
  selectedLoader,
  selectedVersion,
  selectedCategory,
  selectedSource,
  onLoaderChange,
  onVersionChange,
  onCategoryChange,
  onSourceChange,
}) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({
      query,
      loader: selectedLoader,
      version: selectedVersion,
      category: selectedCategory,
      source: selectedSource,
      page: 1,
      limit: 10,
    });
  };

  return (
    <div className="border border-neutral-800 bg-neutral-950 p-4 text-xs space-y-3">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search mods (keyword or natural language query)..."
          className="flex-1 min-w-[220px] border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
        />

        {/* Source Selector: Modrinth, CurseForge, or Both */}
        <select
          value={selectedSource}
          onChange={(e) => {
            const val = e.target.value as 'both' | 'modrinth' | 'curseforge';
            onSourceChange(val);
            onSearch({
              query,
              loader: selectedLoader,
              version: selectedVersion,
              category: selectedCategory,
              source: val,
              page: 1,
              limit: 10,
            });
          }}
          className="border border-neutral-700 bg-neutral-900 px-2.5 py-2 text-xs text-white"
        >
          <option value="both">Both (CurseForge + Modrinth)</option>
          <option value="modrinth">Modrinth Only</option>
          <option value="curseforge">CurseForge Only</option>
        </select>

        {/* Modloader Selector */}
        <select
          value={selectedLoader}
          onChange={(e) => {
            const val = e.target.value;
            onLoaderChange(val);
            onSearch({
              query,
              loader: val,
              version: selectedVersion,
              category: selectedCategory,
              source: selectedSource,
              page: 1,
              limit: 10,
            });
          }}
          className="border border-neutral-700 bg-neutral-900 px-2.5 py-2 text-xs text-white"
        >
          <option value="forge">Forge</option>
          <option value="fabric">Fabric</option>
          <option value="neoforge">NeoForge</option>
          <option value="quilt">Quilt</option>
        </select>

        {/* Minecraft Version Selector */}
        <select
          value={selectedVersion}
          onChange={(e) => {
            const val = e.target.value;
            onVersionChange(val);
            onSearch({
              query,
              loader: selectedLoader,
              version: val,
              category: selectedCategory,
              source: selectedSource,
              page: 1,
              limit: 10,
            });
          }}
          className="border border-neutral-700 bg-neutral-900 px-2.5 py-2 text-xs text-white"
        >
          {COMMON_MC_VERSIONS.map((v) => (
            <option key={v} value={v}>
              MC {v}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={isLoading}
          className="border border-neutral-600 bg-neutral-800 px-4 py-2 text-xs font-bold text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* Popular Categories Filter */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-neutral-800 pt-2">
        <span className="text-neutral-400 mr-1">Categories:</span>
        {POPULAR_MOD_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => {
              onCategoryChange(cat);
              onSearch({
                query,
                loader: selectedLoader,
                version: selectedVersion,
                category: cat,
                source: selectedSource,
                page: 1,
                limit: 10,
              });
            }}
            className={`border px-2.5 py-1 capitalize ${
              selectedCategory === cat
                ? 'border-neutral-400 bg-neutral-800 text-white'
                : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
};
