import React, { useState } from 'react';
import type { SearchFilterOptions } from '../services/api';
import { resolveModDependencies } from '../services/api';
import type { ModItem, Modpack } from '../types';
import { formatDownloads, getModProjectUrl } from '../utils/format';
import { NaturalLanguageSearch } from './NaturalLanguageSearch';

interface SearchDiscoverViewProps {
  searchResults: ModItem[];
  searchSource: string;
  isSearching: boolean;
  selectedLoader: string;
  selectedVersion: string;
  selectedCategory: string;
  selectedSource: 'both' | 'modrinth' | 'curseforge';
  searchPage: number;
  searchTotal: number;
  modpacks: Modpack[];
  activeModpackId: string;
  onSearch: (opts: SearchFilterOptions) => void;
  onLoaderChange: (loader: string) => void;
  onVersionChange: (version: string) => void;
  onCategoryChange: (category: string) => void;
  onSourceChange: (source: 'both' | 'modrinth' | 'curseforge') => void;
  onPageChange: (page: number) => void;
  onAddModToPack: (mod: ModItem, targetPackId: string) => Promise<{ addedDeps: ModItem[] }>;
}

export const SearchDiscoverView: React.FC<SearchDiscoverViewProps> = ({
  searchResults,
  searchSource,
  isSearching,
  selectedLoader,
  selectedVersion,
  selectedCategory,
  selectedSource,
  searchPage,
  searchTotal,
  modpacks,
  activeModpackId,
  onSearch,
  onLoaderChange,
  onVersionChange,
  onCategoryChange,
  onSourceChange,
  onPageChange,
  onAddModToPack,
}) => {
  const [modalMod, setModalMod] = useState<ModItem | null>(null);
  const [selectedPackId, setSelectedPackId] = useState<string>(activeModpackId);
  const [previewDeps, setPreviewDeps] = useState<ModItem[]>([]);
  const [isCheckingDeps, setIsCheckingDeps] = useState(false);
  const [installNotice, setInstallNotice] = useState<string | null>(null);

  const openAddModal = async (mod: ModItem) => {
    const initialPackId = activeModpackId || modpacks[0]?.id || 'demo-modpack';
    setModalMod(mod);
    setSelectedPackId(initialPackId);
    setInstallNotice(null);
    setPreviewDeps([]);

    const pack = modpacks.find((p) => p.id === initialPackId);
    if (pack) {
      setIsCheckingDeps(true);
      const deps = await resolveModDependencies(mod, pack.modLoader, pack.minecraftVersion);
      setPreviewDeps(deps);
      setIsCheckingDeps(false);
    }
  };

  const handlePackSelectChange = async (newPackId: string) => {
    setSelectedPackId(newPackId);
    setInstallNotice(null);
    if (!modalMod) return;
    const pack = modpacks.find((p) => p.id === newPackId);
    if (pack) {
      setIsCheckingDeps(true);
      const deps = await resolveModDependencies(modalMod, pack.modLoader, pack.minecraftVersion);
      setPreviewDeps(deps);
      setIsCheckingDeps(false);
    }
  };

  const targetPack = modpacks.find((p) => p.id === selectedPackId);

  const isLoaderCompatible =
    !targetPack ||
    !modalMod?.loaders ||
    modalMod.loaders.length === 0 ||
    modalMod.loaders.some((l) => l.toLowerCase() === targetPack.modLoader.toLowerCase());

  const isVersionCompatible =
    !targetPack ||
    !modalMod?.gameVersions ||
    modalMod.gameVersions.length === 0 ||
    modalMod.gameVersions.includes(targetPack.minecraftVersion);

  const isCompatible = isLoaderCompatible && isVersionCompatible;

  const handleConfirmAdd = async () => {
    if (!modalMod || !selectedPackId) return;
    const { addedDeps } = await onAddModToPack(modalMod, selectedPackId);
    if (addedDeps.length > 0) {
      setInstallNotice(
        `Added "${modalMod.name}" along with required dependencies: ${addedDeps
          .map((d) => d.name)
          .join(', ')}.`
      );
    } else {
      setInstallNotice(`Added "${modalMod.name}" to modpack.`);
    }
  };

  // Show strictly 10 rows per page
  const visibleRows = searchResults.slice(0, 10);
  const totalPages = Math.max(1, Math.ceil(searchTotal / 10));

  return (
    <div className="space-y-4">
      <NaturalLanguageSearch
        onSearch={onSearch}
        isLoading={isSearching}
        selectedLoader={selectedLoader}
        selectedVersion={selectedVersion}
        selectedCategory={selectedCategory}
        selectedSource={selectedSource}
        onLoaderChange={onLoaderChange}
        onVersionChange={onVersionChange}
        onCategoryChange={onCategoryChange}
        onSourceChange={onSourceChange}
      />

      <div className="flex items-center justify-between text-xs text-neutral-400">
        <span>
          Showing {visibleRows.length} of {searchTotal} results (Page {searchPage} of {totalPages})
        </span>
        {searchSource && <span>Engine: {searchSource}</span>}
      </div>

      {isSearching ? (
        <div className="border border-neutral-800 bg-neutral-950 p-6 text-center text-xs text-neutral-400">
          Searching mods...
        </div>
      ) : visibleRows.length > 0 ? (
        <div className="space-y-2">
          {/* 10 Rows of Entries */}
          {visibleRows.map((mod) => {
            const projectUrl = getModProjectUrl(mod);
            return (
              <div
                key={mod.id}
                className="flex flex-wrap items-center justify-between gap-4 border border-neutral-800 bg-neutral-950 p-3 text-xs"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <img
                    src={mod.iconUrl || '/MCMC.png'}
                    alt={mod.name}
                    className="h-12 w-12 shrink-0 border border-neutral-800 bg-neutral-900 object-contain"
                  />
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={projectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-bold text-white underline"
                      >
                        {mod.name}
                      </a>
                      {/* Modrinth tag is green, CurseForge is orange */}
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
                    <p className="text-neutral-300">{mod.summary}</p>

                    <div className="text-neutral-400">
                      {formatDownloads(mod.downloads)}
                      {mod.loaders && mod.loaders.length > 0
                        ? ` | Loaders: ${mod.loaders.slice(0, 3).join(', ')}`
                        : ''}
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={() => void openAddModal(mod)}
                    className="border border-neutral-600 bg-neutral-800 px-3 py-1.5 font-bold text-white hover:bg-neutral-700"
                  >
                    Add to Modpack
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border border-neutral-800 bg-neutral-950 p-6 text-center text-xs text-neutral-400">
          No mods found.
        </div>
      )}

      {/* Pagination Widget (10 rows per page) */}
      <div className="flex items-center justify-between border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-xs">
        <button
          type="button"
          disabled={searchPage <= 1 || isSearching}
          onClick={() => {
            const prev = Math.max(1, searchPage - 1);
            onPageChange(prev);
            onSearch({ page: prev, limit: 10 });
          }}
          className="border border-neutral-700 bg-neutral-900 px-3 py-1 text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
        >
          Previous 10 Rows
        </button>

        <span className="text-neutral-400">
          Page <strong className="text-white">{searchPage}</strong> of {totalPages}
        </span>

        <button
          type="button"
          disabled={searchPage >= totalPages || isSearching}
          onClick={() => {
            const next = searchPage + 1;
            onPageChange(next);
            onSearch({ page: next, limit: 10 });
          }}
          className="border border-neutral-700 bg-neutral-900 px-3 py-1 text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
        >
          Next 10 Rows
        </button>
      </div>

      {/* Add to Modpack Modal */}
      {modalMod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md border border-neutral-700 bg-neutral-950 p-4 text-xs text-neutral-200 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <strong className="text-sm text-white">Add Mod to Modpack</strong>
              <button
                type="button"
                onClick={() => setModalMod(null)}
                className="border border-neutral-700 bg-neutral-900 px-2 py-1"
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="font-bold text-white">{modalMod.name}</p>
                <p className="text-neutral-400">{modalMod.summary}</p>
              </div>

              <div>
                <label className="block text-neutral-400 mb-1">Select Target Modpack</label>
                <select
                  value={selectedPackId}
                  onChange={(e) => void handlePackSelectChange(e.target.value)}
                  className="w-full border border-neutral-700 bg-neutral-900 px-2.5 py-2 text-white"
                >
                  {modpacks.map((pack) => (
                    <option key={pack.id} value={pack.id}>
                      {pack.title} (MC {pack.minecraftVersion} - {pack.modLoader.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Compatibility Status */}
              <div className="border border-neutral-800 bg-neutral-900 p-2.5 space-y-1">
                <p>
                  <strong>Compatibility Check: </strong>
                  <span className={isCompatible ? 'text-green-400' : 'text-orange-400'}>
                    {isCompatible
                      ? 'Compatible with selected modpack'
                      : 'Warning: Mod metadata may not explicitly list this loader/version'}
                  </span>
                </p>
              </div>

              {/* Dependencies Notice */}
              <div className="border border-neutral-800 bg-neutral-900 p-2.5 space-y-1">
                <strong className="block text-white">Required Dependencies to Install:</strong>
                {isCheckingDeps ? (
                  <p className="text-neutral-400">Checking dependencies...</p>
                ) : previewDeps.length === 0 ? (
                  <p className="text-neutral-400">No additional required dependencies.</p>
                ) : (
                  <ul className="list-disc list-inside text-neutral-300">
                    {previewDeps.map((dep) => (
                      <li key={dep.id}>{dep.name} (Will be automatically installed)</li>
                    ))}
                  </ul>
                )}
              </div>

              {installNotice && (
                <div className="border border-neutral-600 bg-neutral-900 p-2.5 text-white">
                  {installNotice}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-neutral-800 pt-3">
              <button
                type="button"
                onClick={() => setModalMod(null)}
                className="border border-neutral-700 bg-neutral-900 px-3 py-1.5"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmAdd()}
                disabled={isCheckingDeps}
                className="border border-neutral-600 bg-neutral-800 px-3 py-1.5 font-bold text-white hover:bg-neutral-700 disabled:opacity-50"
              >
                Confirm &amp; Add Mod
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
