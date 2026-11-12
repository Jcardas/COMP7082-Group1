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

const TAB_ROUTES: Record<ActiveTab, string> = { main: '/', modpack: '/', search: '/search', friends: '/friends', profile: '/profile' };

function pathToTab(pathname: string): ActiveTab {
  if (pathname.startsWith('/modpack/')) return 'modpack';
  if (pathname.startsWith('/search')) return 'search';
  if (pathname.startsWith('/friends')) return 'friends';
  if (pathname.startsWith('/profile')) return 'profile';
  return 'main';
}

export function App() {
  const auth = useAuth();
  const [lastModpackId, setLastModpackId] = useState(() => localStorage.getItem('mcmc_active_modpack_id') || '');
  const [lastModpackTitle, setLastModpackTitle] = useState(() => localStorage.getItem('mcmc_active_modpack_title') || '');
  const pack = useModpack(lastModpackId || 'demo-modpack', auth.displayName, auth.userId, auth.friendCode);
  const navigate = useNavigate();
  const location = useLocation();
  const redirectPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';

  const handleActiveModpackChange = useCallback((id: string, title: string) => {
    setLastModpackId(id);
    setLastModpackTitle(title);
    localStorage.setItem('mcmc_active_modpack_id', id);
    localStorage.setItem('mcmc_active_modpack_title', title);
  }, []);

  const handleSignOut = async () => {
    await auth.signOut();
    void navigate('/login');
  };

  return (
    <Routes>
      <Route
        path="/login"
        element={
          auth.isAuthenticated ? (
            <Navigate to={redirectPath} replace />
          ) : (
            <LoginPage onSuccess={() => { auth.markAuthenticated(); void navigate(redirectPath, { replace: true }); }} />
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
                onOpenActiveModpack={() => { if (lastModpackId) void navigate(`/modpack/${lastModpackId}`); }}
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
              onDeleteModpack={pack.deleteModpackProject}
              onInviteContributor={pack.inviteContributor}
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
              activeModpackId={lastModpackId || pack.modpack.id}
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
        <Route path="/friends" element={<FriendsView {...pack} onAddFriend={pack.createFriend} onRemoveFriend={pack.deleteFriend} onInviteFriendToModpack={pack.inviteContributor} />} />
        <Route path="/profile" element={<ProfileView username={auth.displayName} email={auth.email} avatarUrl={auth.avatarUrl} friendCode={auth.friendCode} onUpdateProfile={auth.updateProfile} onUpdateEmail={auth.updateUserEmail} onUpdatePassword={auth.updateUserPassword} onDeleteAccount={handleSignOut} />} />
        <Route path="*" element={<NotFoundView />} />
      </Route>
    </Routes>
  );
}

export default App;
