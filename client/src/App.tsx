import { useCallback, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { FriendsView } from './components/FriendsView';
import { LoginPage } from './components/LoginPage';
import { ModpackProjectsView } from './components/ModpackProjectsView';
import { Navbar, type ActiveTab } from './components/Navbar';
import { ProfileView } from './components/ProfileView';
import { SearchDiscoverView } from './components/SearchDiscoverView';
import { useAuth } from './hooks/useAuth';
import { useModpack } from './hooks/useModpack';
import { ModpackWorkspaceRoute } from './routes/ModpackWorkspaceRoute';
import { NotFoundView } from './routes/NotFoundView';
import { ProtectedRoute } from './routes/ProtectedRoute';

const TAB_ROUTES: Record<ActiveTab, string> = {
  main: '/',
  modpack: '/',
  search: '/search',
  friends: '/friends',
  profile: '/profile',
};

function pathToTab(pathname: string): ActiveTab {
  if (pathname.startsWith('/modpack/')) return 'modpack';
  if (pathname.startsWith('/search')) return 'search';
  if (pathname.startsWith('/friends')) return 'friends';
  if (pathname.startsWith('/profile')) return 'profile';
  return 'main';
}

export function App() {
  const auth = useAuth();
  const storageIdKey = `mcmc_active_modpack_id_${auth.userId}`;
  const storageTitleKey = `mcmc_active_modpack_title_${auth.userId}`;

  const [selectedByUser, setSelectedByUser] = useState<
    Record<string, { id: string; title: string }>
  >({});

  const storedSelection =
    auth.isAuthenticated && auth.userId
      ? selectedByUser[auth.userId] || {
          id: localStorage.getItem(storageIdKey) || '',
          title: localStorage.getItem(storageTitleKey) || '',
        }
      : { id: '', title: '' };

  const pack = useModpack(storedSelection.id, auth.displayName, auth.userId, auth.friendCode);
  const navigate = useNavigate();
  const location = useLocation();
  const redirectPath =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';

  // Derive verified active modpack (clears automatically if not accessible or deleted)
  const verifiedPack = pack.modpacksLoaded
    ? pack.modpacks.find((p) => p.id === storedSelection.id)
    : undefined;
  const lastModpackId = pack.modpacksLoaded ? verifiedPack?.id || '' : storedSelection.id;
  const lastModpackTitle = pack.modpacksLoaded
    ? verifiedPack?.title || ''
    : storedSelection.title;

  const handleActiveModpackChange = useCallback(
    (id: string, title: string) => {
      if (auth.userId) {
        setSelectedByUser((prev) => ({ ...prev, [auth.userId]: { id, title } }));
      }
      if (id) {
        localStorage.setItem(storageIdKey, id);
        localStorage.setItem(storageTitleKey, title);
      } else {
        localStorage.removeItem(storageIdKey);
        localStorage.removeItem(storageTitleKey);
      }
    },
    [auth.userId, storageIdKey, storageTitleKey]
  );

  const handleSignOut = async () => {
    handleActiveModpackChange('', '');
    await auth.signOut();
    void navigate('/login');
  };

  const handleDeleteAccount = async () => {
    handleActiveModpackChange('', '');
    await auth.deleteAccount();
    void navigate('/login');
  };

  const handleDeleteModpack = async (id: string) => {
    await pack.deleteModpackProject(id);
    if (lastModpackId === id) {
      handleActiveModpackChange('', '');
    }
  };

  return (
    <Routes>
      <Route
        path="/login"
        element={
          auth.isAuthenticated ? (
            <Navigate to={redirectPath} replace />
          ) : (
            <LoginPage
              onSuccess={() => {
                auth.markAuthenticated();
                void navigate(redirectPath, { replace: true });
              }}
            />
          )
        }
      />
      <Route
        element={
          <ProtectedRoute isAuthenticated={auth.isAuthenticated} isLoading={auth.isLoading}>
            <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
              <Navbar
                activeTab={pathToTab(location.pathname)}
                onTabChange={(tab) => void navigate(TAB_ROUTES[tab])}
                currentUser={auth.displayName}
                isAuthenticated={auth.isAuthenticated}
                activeModpackId={lastModpackId || undefined}
                activeModpackTitle={lastModpackTitle || undefined}
                canGoBack={location.pathname !== '/'}
                onGoBack={() => void navigate(-1)}
                onOpenActiveModpack={() => {
                  if (lastModpackId) void navigate(`/modpack/${lastModpackId}`);
                }}
                onSignOut={() => void handleSignOut()}
              />
              <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-6 space-y-6">
                <Outlet />
              </main>
            </div>
          </ProtectedRoute>
        }
      >
        <Route
          path="/"
          element={
            <ModpackProjectsView
              {...pack}
              activeModpackId={lastModpackId || undefined}
              onSelectModpack={(selected) => {
                handleActiveModpackChange(selected.id, selected.title);
                void navigate(`/modpack/${selected.id}`);
              }}
              onCreateModpack={pack.createNewModpack}
              onEditModpack={pack.editModpackProject}
              onDeleteModpack={handleDeleteModpack}
              onInviteContributor={pack.inviteContributor}
              onAcceptInvite={pack.acceptInvite}
              onDeclineInvite={pack.declineInvite}
            />
          }
        />
        <Route
          path="/modpack/:id"
          element={
            <ModpackWorkspaceRoute
              currentUser={auth.displayName}
              currentUserId={auth.userId}
              currentFriendCode={auth.friendCode}
              onActiveModpackChange={handleActiveModpackChange}
            />
          }
        />
        <Route
          path="/search"
          element={
            <SearchDiscoverView
              {...pack}
              activeModpackId={lastModpackId || ''}
              onSearch={pack.handleSearch}
              onLoaderChange={pack.updateLoader}
              onVersionChange={pack.updateVersion}
              onCategoryChange={pack.setSelectedCategory}
              onSourceChange={pack.setSelectedSource}
              onPageChange={pack.setSearchPage}
              onAddModToPack={pack.addModToTargetPack}
            />
          }
        />
        <Route
          path="/friends"
          element={
            <FriendsView
              friends={pack.friends}
              incomingFriendRequests={pack.incomingFriendRequests}
              outgoingFriendRequests={pack.outgoingFriendRequests}
              modpacks={pack.modpacks}
              invites={pack.invites}
              onSendFriendRequest={pack.sendFriendRequest}
              onAcceptFriendRequest={pack.acceptFriendRequest}
              onDeclineFriendRequest={pack.declineFriendRequest}
              onRemoveFriend={pack.deleteFriend}
              onInviteFriendToModpack={pack.inviteContributor}
              onAcceptInvite={pack.acceptInvite}
              onDeclineInvite={pack.declineInvite}
            />
          }
        />
        <Route
          path="/profile"
          element={
            <ProfileView
              username={auth.displayName}
              email={auth.email}
              avatarUrl={auth.avatarUrl}
              friendCode={auth.friendCode}
              onUpdateProfile={auth.updateProfile}
              onUpdateEmail={auth.updateUserEmail}
              onUpdatePassword={auth.updateUserPassword}
              onDeleteAccount={handleDeleteAccount}
            />
          }
        />
        <Route path="*" element={<NotFoundView />} />
      </Route>
    </Routes>
  );
}

export default App;
