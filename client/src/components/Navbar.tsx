import React from 'react';

export type ActiveTab = 'main' | 'modpack' | 'search' | 'friends' | 'profile';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  currentUser: string;
  isAuthenticated?: boolean;
  activeModpackId?: string;
  activeModpackTitle?: string;
  canGoBack?: boolean;
  onGoBack?: () => void;
  onOpenActiveModpack?: () => void;
  onSignOut?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  currentUser,
  activeModpackId,
  activeModpackTitle,
  canGoBack,
  onGoBack,
  onOpenActiveModpack,
  onSignOut,
}) => {
  return (
    <div className="w-full">
      <header className="w-full border-b border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-neutral-200">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onTabChange('main')}
              className="flex items-center gap-2 text-left"
            >
              <img src="/MCMC.png" alt="MCMC Logo" className="h-8 w-8 object-contain" />
              <strong className="font-bold text-white">MCMC</strong>
            </button>

            {canGoBack && onGoBack && (
              <button
                type="button"
                onClick={onGoBack}
                className="border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
              >
                &larr; Back
              </button>
            )}
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onTabChange('main')}
              className={`border px-3 py-1 text-xs ${
                activeTab === 'main'
                  ? 'border-neutral-400 bg-neutral-800 text-white'
                  : 'border-neutral-800 bg-neutral-900 text-neutral-400'
              }`}
            >
              Modpacks
            </button>

            <button
              type="button"
              onClick={() => onTabChange('search')}
              className={`border px-3 py-1 text-xs ${
                activeTab === 'search'
                  ? 'border-neutral-400 bg-neutral-800 text-white'
                  : 'border-neutral-800 bg-neutral-900 text-neutral-400'
              }`}
            >
              Search
            </button>

            <button
              type="button"
              onClick={() => onTabChange('friends')}
              className={`border px-3 py-1 text-xs ${
                activeTab === 'friends'
                  ? 'border-neutral-400 bg-neutral-800 text-white'
                  : 'border-neutral-800 bg-neutral-900 text-neutral-400'
              }`}
            >
              Friends
            </button>

            <button
              type="button"
              onClick={() => onTabChange('profile')}
              className={`border px-3 py-1 text-xs ${
                activeTab === 'profile'
                  ? 'border-neutral-400 bg-neutral-800 text-white'
                  : 'border-neutral-800 bg-neutral-900 text-neutral-400'
              }`}
            >
              Profile ({currentUser})
            </button>
          </nav>

          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={onSignOut}
              className="border border-neutral-700 bg-neutral-900 px-3 py-1 text-neutral-200 hover:bg-neutral-800"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Secondary Navbar below Main Navbar showing Currently Editing Modpack */}
      {activeModpackId && onOpenActiveModpack && (
        <div
          data-testid="editing-subnavbar"
          className="w-full border-b border-neutral-800 bg-neutral-900/80 px-4 py-2 text-xs text-neutral-300"
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-neutral-400">Currently Editing Modpack:</span>
              <button
                type="button"
                onClick={onOpenActiveModpack}
                className={`font-bold hover:underline ${
                  activeTab === 'modpack' ? 'text-white' : 'text-neutral-200'
                }`}
              >
                {activeModpackTitle || activeModpackId}
              </button>
            </div>
            {activeTab !== 'modpack' && (
              <button
                type="button"
                onClick={onOpenActiveModpack}
                className="border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs text-white hover:bg-neutral-700"
              >
                Open Workspace &rarr;
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
