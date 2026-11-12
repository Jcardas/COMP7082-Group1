import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ActiveModpackView } from '../components/ActiveModpackView';
import { CollaborationSidebar } from '../components/CollaborationSidebar';
import { ExportModal } from '../components/ExportModal';
import { useCollabSocket } from '../hooks/useCollabSocket';
import { useDependencyAnalysis } from '../hooks/useDependencyAnalysis';
import { useModpack } from '../hooks/useModpack';
import { NotFoundView } from './NotFoundView';

interface ModpackWorkspaceRouteProps {
  currentUser: string;
  currentUserId: string;
  currentFriendCode: string;
  onActiveModpackChange?: (id: string, title: string) => void;
}

export const ModpackWorkspaceRoute: React.FC<ModpackWorkspaceRouteProps> = ({
  currentUser,
  currentUserId,
  currentFriendCode,
  onActiveModpackChange,
}) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const resolvedId = id || 'demo-modpack';
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const pack = useModpack(resolvedId, currentUser, currentUserId, currentFriendCode);
  const collab = useCollabSocket(resolvedId, currentUser, {
    onModAdded: pack.applyRemoteModAdded,
    onModRemoved: pack.applyRemoteModRemoved,
    onModVoted: pack.applyRemoteModVoted,
    onModCommented: pack.applyRemoteModCommented,
  });
  useDependencyAnalysis(pack.modpack.mods);

  useEffect(() => {
    if (!pack.isNotFound && pack.modpack.id) {
      onActiveModpackChange?.(pack.modpack.id, pack.modpack.title);
    }
  }, [onActiveModpackChange, pack.isNotFound, pack.modpack.id, pack.modpack.title]);

  if (pack.isNotFound) {
    return <NotFoundView modpackId={resolvedId} />;
  }

  return (
    <>
      {collab.notification && (
        <div className="fixed bottom-4 right-4 z-50 border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white">
          {collab.notification}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <ActiveModpackView
            modpack={pack.modpack}
            currentUser={currentUser}
            recommendations={pack.recommendations}
            isLoadingRecs={pack.isLoadingRecs}
            installedModIds={pack.installedModIds}
            onRefreshRecommendations={pack.fetchRecommendations}
            onAddMod={pack.addMod}
            onRemoveMod={pack.removeMod}
            onVoteMod={pack.voteMod}
            onCommentMod={pack.commentMod}
            onOpenExport={() => setIsExportModalOpen(true)}
            onGoToSearch={() => void navigate('/search')}
            onBackToProjects={() => void navigate('/')}
          />
        </div>
        <div className="lg:col-span-4">
          <CollaborationSidebar
            currentUser={currentUser}
            contributors={pack.modpack.contributors || []}
            pendingInvites={pack.modpack.pendingInvites || []}
            invites={pack.invites.filter((inv) => inv.modpackId === pack.modpack.id)}
            activeUsers={collab.activeUsers}
            friends={pack.friends}
            onInviteContributor={(code) => void pack.inviteContributor(pack.modpack.id, code)}
            onAcceptInvite={(inviteId) => void pack.acceptInvite(inviteId)}
            onDeclineInvite={(inviteId) => void pack.declineInvite(inviteId)}
          />
        </div>
      </div>

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        modpack={pack.modpack}
      />
    </>
  );
};
