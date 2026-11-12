import React, { useState } from 'react';
import { COMMON_MC_VERSIONS, type FriendItem, type Modpack, type ModpackInvite } from '../types/consts';

interface ModpackProjectsViewProps {
  modpacks: Modpack[];
  friends: FriendItem[];
  invites?: ModpackInvite[];
  activeModpackId?: string;
  onSelectModpack: (pack: Modpack) => void;
  onCreateModpack: (payload: {
    title: string;
    description?: string;
    imageUrl?: string;
    contributors?: string[];
    minecraftVersion: string;
    modLoader: Modpack['modLoader'];
  }) => Promise<Modpack>;
  onEditModpack: (
    id: string,
    payload: {
      title?: string;
      imageUrl?: string;
      contributors?: string[];
      pendingInvites?: string[];
    }
  ) => Promise<Modpack>;
  onDeleteModpack: (id: string) => Promise<void>;
  onInviteContributor?: (modpackId: string, usernameOrCode: string) => Promise<void>;
  onAcceptInvite?: (inviteId: string) => Promise<void>;
  onDeclineInvite?: (inviteId: string) => Promise<void>;
}

export const ModpackProjectsView: React.FC<ModpackProjectsViewProps> = ({
  modpacks,
  friends,
  invites = [],
  activeModpackId,
  onSelectModpack,
  onCreateModpack,
  onEditModpack,
  onDeleteModpack,
  onInviteContributor,
  onAcceptInvite,
  onDeclineInvite,
}) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPack, setEditingPack] = useState<Modpack | null>(null);

  // Create/Edit form state
  const [title, setTitle] = useState('');
  const [mcVersion, setMcVersion] = useState<string>('1.20.1');
  const [modLoader, setModLoader] = useState<Modpack['modLoader']>('forge');
  const [imageUrl, setImageUrl] = useState('/MCMC.png');
  const [selectedInvites, setSelectedInvites] = useState<string[]>([]);
  const [inviteInput, setInviteInput] = useState('');

  const openCreateModal = () => {
    setTitle('');
    setMcVersion('1.20.1');
    setModLoader('forge');
    setImageUrl('/MCMC.png');
    setSelectedInvites([]);
    setInviteInput('');
    setIsCreateOpen(true);
  };

  const openEditModal = (pack: Modpack, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPack(pack);
    setTitle(pack.title);
    setImageUrl(pack.imageUrl || '/MCMC.png');
    setSelectedInvites(pack.pendingInvites || []);
    setInviteInput('');
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    void onDeleteModpack(id);
  };

  const toggleFriendInvite = (username: string) => {
    setSelectedInvites((prev) =>
      prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username]
    );
  };

  const handleAddInviteInput = () => {
    const trimmed = inviteInput.trim();
    if (!trimmed) return;
    if (!selectedInvites.includes(trimmed)) {
      setSelectedInvites((prev) => [...prev, trimmed]);
    }
    setInviteInput('');
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const created = await onCreateModpack({
      title: title.trim(),
      imageUrl: imageUrl.trim() || '/MCMC.png',
      contributors: selectedInvites,
      minecraftVersion: mcVersion,
      modLoader,
    });
    setIsCreateOpen(false);
    onSelectModpack(created);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPack || !title.trim()) return;
    await onEditModpack(editingPack.id, {
      title: title.trim(),
      imageUrl: imageUrl.trim() || '/MCMC.png',
      pendingInvites: selectedInvites,
    });
    if (onInviteContributor) {
      const existingPending = editingPack.pendingInvites || [];
      for (const invitee of selectedInvites) {
        if (!existingPending.includes(invitee)) {
          await onInviteContributor(editingPack.id, invitee);
        }
      }
    }
    setEditingPack(null);
  };

  const activePack = modpacks.find((p) => p.id === activeModpackId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-2">
        <h1 className="text-lg font-bold text-white">Modpacks</h1>
        {activePack && (
          <button
            type="button"
            onClick={() => onSelectModpack(activePack)}
            className="border border-neutral-600 bg-neutral-800 px-3 py-1 text-xs font-bold text-white hover:bg-neutral-700"
          >
            Return to Editing: {activePack.title} &rarr;
          </button>
        )}
      </div>

      {/* Pending Modpack Invitations Banner */}
      {invites.length > 0 && (
        <div className="border border-neutral-700 bg-neutral-950 p-3 text-xs space-y-2">
          <strong className="text-white block">Pending Modpack Invitations</strong>
          <div className="space-y-1.5">
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-2 border border-neutral-800 bg-neutral-900 p-2"
              >
                <div>
                  <span className="font-bold text-white">{inv.modpackTitle}</span>{' '}
                  <span className="text-neutral-400">
                    — Invited {inv.invitedUser} by {inv.invitedBy}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {onAcceptInvite && (
                    <button
                      type="button"
                      onClick={() => void onAcceptInvite(inv.id)}
                      className="border border-neutral-600 bg-neutral-800 px-2.5 py-1 font-bold text-white hover:bg-neutral-700"
                    >
                      Accept &amp; Join
                    </button>
                  )}
                  {onDeclineInvite && (
                    <button
                      type="button"
                      onClick={() => void onDeclineInvite(inv.id)}
                      className="border border-neutral-800 bg-neutral-950 px-2.5 py-1 text-neutral-400 hover:bg-neutral-900"
                    >
                      Decline
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid of active modpack projects + Create New Modpack button as the last entry */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modpacks.map((pack) => (
          <div
            key={pack.id}
            onClick={() => onSelectModpack(pack)}
            className="group relative flex cursor-pointer flex-col justify-between border border-neutral-800 bg-neutral-950 p-4 hover:border-neutral-600"
          >
            {/* Hover Edit and Delete buttons */}
            <div className="invisible absolute right-2 top-2 flex gap-1 group-hover:visible">
              <button
                type="button"
                onClick={(e) => openEditModal(pack, e)}
                className="border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-800"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={(e) => handleDeleteClick(pack.id, e)}
                className="border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-800"
              >
                Delete
              </button>
            </div>

            <div className="flex items-center gap-3">
              <img
                src={pack.imageUrl || '/MCMC.png'}
                alt={pack.title}
                className="h-12 w-12 border border-neutral-800 bg-neutral-900 object-contain"
              />
              <div>
                <h2 className="font-bold text-white">{pack.title}</h2>
                <p className="text-xs text-neutral-400">
                  MC {pack.minecraftVersion} | {pack.modLoader.toUpperCase()}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-neutral-800 pt-2 text-xs text-neutral-400">
              <span>{pack.mods.length} Mods</span>
              <span>
                {(pack.contributors || []).length} Collaborators
                {pack.pendingInvites && pack.pendingInvites.length > 0
                  ? ` (${pack.pendingInvites.length} invited)`
                  : ''}
              </span>
            </div>
          </div>
        ))}

        {/* Create New Modpack Button as the last entry in the grid */}
        <button
          type="button"
          onClick={openCreateModal}
          className="flex min-h-[120px] flex-col items-center justify-center border border-dashed border-neutral-700 bg-neutral-950 p-4 text-sm font-bold text-neutral-300 hover:border-neutral-500 hover:text-white"
        >
          + Create New Modpack
        </button>
      </div>

      {/* Create Modpack Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md border border-neutral-700 bg-neutral-950 p-4 text-xs text-neutral-200">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <strong className="text-sm text-white">Create New Modpack</strong>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="border border-neutral-700 bg-neutral-900 px-2 py-1"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-3 space-y-3">
              <div>
                <label className="block text-neutral-400 mb-1">Modpack Name</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter modpack name..."
                  className="w-full border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-neutral-400 mb-1">Minecraft Version</label>
                  <select
                    value={mcVersion}
                    onChange={(e) => setMcVersion(e.target.value)}
                    className="w-full border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-white"
                  >
                    {COMMON_MC_VERSIONS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-400 mb-1">Modloader</label>
                  <select
                    value={modLoader}
                    onChange={(e) => setModLoader(e.target.value as Modpack['modLoader'])}
                    className="w-full border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-white"
                  >
                    <option value="forge">Forge</option>
                    <option value="fabric">Fabric</option>
                    <option value="neoforge">NeoForge</option>
                    <option value="quilt">Quilt</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-neutral-400 mb-1">Modpack Picture URL</label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="/MCMC.png or image URL"
                  className="w-full border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-neutral-400">
                  Invite Collaborators (Sends Invitation to Join)
                </label>
                {friends.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {friends.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => toggleFriendInvite(f.username)}
                        className={`border px-2 py-1 ${
                          selectedInvites.includes(f.username)
                            ? 'border-neutral-400 bg-neutral-800 text-white'
                            : 'border-neutral-800 bg-neutral-900 text-neutral-400'
                        }`}
                      >
                        {f.username} ({f.friendCode})
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={inviteInput}
                    onChange={(e) => setInviteInput(e.target.value)}
                    placeholder="Friend username or friend code..."
                    className="flex-1 border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddInviteInput}
                    className="border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-white"
                  >
                    Invite
                  </button>
                </div>

                {selectedInvites.length > 0 && (
                  <p className="text-neutral-400">
                    Pending Invites to Send: {selectedInvites.join(', ')}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t border-neutral-800 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="border border-neutral-700 bg-neutral-900 px-3 py-1.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="border border-neutral-600 bg-neutral-800 px-3 py-1.5 font-bold text-white"
                >
                  Create Modpack
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modpack Modal */}
      {editingPack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md border border-neutral-700 bg-neutral-950 p-4 text-xs text-neutral-200">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <strong className="text-sm text-white">Edit Modpack</strong>
              <button
                type="button"
                onClick={() => setEditingPack(null)}
                className="border border-neutral-700 bg-neutral-900 px-2 py-1"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-3 space-y-3">
              <div>
                <label className="block text-neutral-400 mb-1">Modpack Name</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-white"
                />
              </div>

              <div>
                <label className="block text-neutral-400 mb-1">Modpack Picture URL</label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-neutral-400">
                  Invite New Collaborators (Sends Invite)
                </label>
                {friends.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {friends.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => toggleFriendInvite(f.username)}
                        className={`border px-2 py-1 ${
                          selectedInvites.includes(f.username)
                            ? 'border-neutral-400 bg-neutral-800 text-white'
                            : 'border-neutral-800 bg-neutral-900 text-neutral-400'
                        }`}
                      >
                        {f.username}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={inviteInput}
                    onChange={(e) => setInviteInput(e.target.value)}
                    placeholder="Invite user by name or friend code..."
                    className="flex-1 border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddInviteInput}
                    className="border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-white"
                  >
                    Send Invite
                  </button>
                </div>

                {selectedInvites.length > 0 && (
                  <p className="text-neutral-400">Pending Invites: {selectedInvites.join(', ')}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t border-neutral-800 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingPack(null)}
                  className="border border-neutral-700 bg-neutral-900 px-3 py-1.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="border border-neutral-600 bg-neutral-800 px-3 py-1.5 font-bold text-white"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
