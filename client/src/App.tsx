import { useState } from 'react';
import { ActiveModpackView } from './components/ActiveModpackView';
import { CollaborationSidebar } from './components/CollaborationSidebar';
import { ExportModal } from './components/ExportModal';
import { FriendsView } from './components/FriendsView';
import { LoginPage } from './components/LoginPage';
import { ModpackProjectsView } from './components/ModpackProjectsView';
import { Navbar, type ActiveTab } from './components/Navbar';
import { ProfileView } from './components/ProfileView';
import { SearchDiscoverView } from './components/SearchDiscoverView';
import { useAuth } from './hooks/useAuth';
import { useCollabSocket } from './hooks/useCollabSocket';
import { useDependencyAnalysis } from './hooks/useDependencyAnalysis';
import { useModpack } from './hooks/useModpack';

export function App() {
  const [modpackId, setModpackId] = useState('demo-modpack');
  const [activeTab, setActiveTab] = useState<ActiveTab>('main');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [showLoginPage, setShowLoginPage] = useState(true);

  const auth = useAuth();
  const pack = useModpack(modpackId, auth.displayName);
  const collab = useCollabSocket(modpackId, auth.displayName, {
    onModAdded: pack.applyRemoteModAdded,
    onModRemoved: pack.applyRemoteModRemoved,
    onModVoted: pack.applyRemoteModVoted,
    onModCommented: pack.applyRemoteModCommented,
  });
  useDependencyAnalysis(pack.modpack.mods);

  if (!auth.isAuthenticated && showLoginPage) {
    return <LoginPage onSuccess={() => setShowLoginPage(false)} />;
  }

  const handleSignOut = async () => {
    await auth.signOut();
    setShowLoginPage(true);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {collab.notification && (
        <div className="fixed bottom-4 right-4 z-50 border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white">
          {collab.notification}
        </div>
      )}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        currentUser={auth.displayName}
        isAuthenticated={auth.isAuthenticated}
        onSignOut={() => void handleSignOut()}
      />
      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-6 space-y-6">
        {activeTab === 'main' && (
          <ModpackProjectsView
            modpacks={pack.modpacks}
            friends={pack.friends}
            onSelectModpack={(selected) => {
              setModpackId(selected.id);
              pack.setModpack(selected);
              setActiveTab('modpack');
            }}
            onCreateModpack={pack.createNewModpack}
            onEditModpack={pack.editModpackProject}
            onDeleteModpack={pack.deleteModpackProject}
          />
        )}
        {activeTab === 'modpack' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <ActiveModpackView
                modpack={pack.modpack}
                currentUser={auth.displayName}
                recommendations={pack.recommendations}
                isLoadingRecs={pack.isLoadingRecs}
                installedModIds={pack.installedModIds}
                onRefreshRecommendations={pack.fetchRecommendations}
                onAddMod={pack.addMod}
                onRemoveMod={pack.removeMod}
                onVoteMod={pack.voteMod}
                onCommentMod={pack.commentMod}
                onOpenExport={() => setIsExportModalOpen(true)}
                onGoToSearch={() => setActiveTab('search')}
                onBackToProjects={() => setActiveTab('main')}
              />
            </div>
            <div className="lg:col-span-4">
              <CollaborationSidebar
                currentUser={auth.displayName}
                contributors={pack.modpack.contributors || []}
                activeUsers={collab.activeUsers}
                friends={pack.friends}
                onInviteContributor={(code) => void pack.inviteContributor(pack.modpack.id, code)}
              />
            </div>
          </div>
        )}
        {activeTab === 'search' && (
          <SearchDiscoverView
            {...pack}
            activeModpackId={pack.modpack.id}
            onSearch={pack.handleSearch}
            onLoaderChange={pack.updateLoader}
            onVersionChange={pack.updateVersion}
            onCategoryChange={pack.setSelectedCategory}
            onSourceChange={pack.setSelectedSource}
            onPageChange={pack.setSearchPage}
            onAddModToPack={pack.addModToTargetPack}
          />
        )}
        {activeTab === 'friends' && (
          <FriendsView
            friends={pack.friends}
            modpacks={pack.modpacks}
            onAddFriend={pack.createFriend}
            onRemoveFriend={pack.deleteFriend}
            onInviteFriendToModpack={pack.inviteContributor}
          />
        )}
        {activeTab === 'profile' && (
          <ProfileView
            username={auth.displayName}
            email={auth.email}
            avatarUrl={auth.avatarUrl}
            friendCode={auth.friendCode}
            onUpdateProfile={auth.updateProfile}
            onUpdateEmail={auth.updateUserEmail}
            onUpdatePassword={auth.updateUserPassword}
            onDeleteAccount={handleSignOut}
          />
        )}
      </main>
      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} modpack={pack.modpack} />
    </div>
  );
}

export default App;
