import React from 'react';

export type ActiveTab = 'main' | 'modpack' | 'search' | 'friends' | 'profile';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  currentUser: string;
  isAuthenticated?: boolean;
  onSignOut?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  currentUser,
  onSignOut,
}) => {
  return (
    <header className="w-full border-b border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-neutral-200">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => onTabChange('main')}
          className="flex items-center gap-2 text-left"
        >
          <img src="/MCMC.png" alt="MCMC Logo" className="h-8 w-8 object-contain" />
          <strong className="font-bold text-white">MCMC</strong>
        </button>

        <nav className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onTabChange('main')}
            className={`border px-3 py-1 text-xs ${
              activeTab === 'main' || activeTab === 'modpack'
                ? 'border-neutral-400 bg-neutral-800 text-white'
                : 'border-neutral-800 bg-neutral-900 text-neutral-400'
            }`}
          >
            Modpack
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
  );
};
