import React, { useState } from 'react';
import { uploadImageFile } from '../services/api';
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const [respondingInviteId, setRespondingInviteId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Create/Edit form state
  const [title, setTitle] = useState('');
  const [mcVersion, setMcVersion] = useState<string>('1.21.1');
  const [modLoader, setModLoader] = useState<Modpack['modLoader']>('forge');
  const [imageUrl, setImageUrl] = useState('/MCMC.png');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedInviteCodes, setSelectedInviteCodes] = useState<string[]>([]);
  const [inviteCodeInput, setInviteCodeInput] = useState('');

  const handleRespondInvite = async (inviteId: string, action: 'accept' | 'decline') => {
    const handler = action === 'accept' ? onAcceptInvite : onDeclineInvite;
    if (!handler) return;
    setInviteError(null);
    setRespondingInviteId(inviteId);
    try {
      await handler(inviteId);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : `Failed to ${action} modpack invitation`);
    } finally {
      setRespondingInviteId(null);
    }
  };

  const openCreateModal = () => {
    setTitle('');
    setMcVersion('1.21.1');
    setModLoader('forge');
    setImageUrl('/MCMC.png');
    setUploadError(null);
    setSelectedInviteCodes([]);
    setInviteCodeInput('');
    setIsCreateOpen(true);
  };

  const openEditModal = (pack: Modpack, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPack(pack);
    setTitle(pack.title);
    setImageUrl(pack.imageUrl || '/MCMC.png');
    setUploadError(null);
    setSelectedInviteCodes(pack.pendingInvites || []);
    setInviteCodeInput('');
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    void onDeleteModpack(id);
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setIsUploadingImage(true);
    try {
      const uploadedUrl = await uploadImageFile(file);
      setImageUrl(uploadedUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const toggleFriendInvite = (friendCode: string) => {
    const normalized = friendCode.trim().toUpperCase();
    setSelectedInviteCodes((prev) =>
      prev.includes(normalized) ? prev.filter((c) => c !== normalized) : [...prev, normalized]
    );
  };

  const handleAddInviteCode = () => {
    const trimmed = inviteCodeInput.trim().toUpperCase();
    if (!trimmed) return;
    if (!selectedInviteCodes.includes(trimmed)) {
      setSelectedInviteCodes((prev) => [...prev, trimmed]);
    }
    setInviteCodeInput('');
  };

  const formatInviteDisplay = (codeOrLabel: string): string => {
    const matchedFriend = friends.find(
      (f) => f.friendCode.toUpperCase() === codeOrLabel.toUpperCase()
    );
    return matchedFriend ? `${matchedFriend.username} (${matchedFriend.friendCode})` : codeOrLabel;
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isUploadingImage) return;
    const created = await onCreateModpack({
      title: title.trim(),
      imageUrl: imageUrl || '/MCMC.png',
      contributors: selectedInviteCodes,
      minecraftVersion: mcVersion,
      modLoader,
    });
    setIsCreateOpen(false);
    onSelectModpack(created);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPack || !title.trim() || isUploadingImage) return;
    await onEditModpack(editingPack.id, {
      title: title.trim(),
      imageUrl: imageUrl || '/MCMC.png',
      pendingInvites: selectedInviteCodes,
    });
    if (onInviteContributor) {
      const existingPending = editingPack.pendingInvites || [];
      for (const invitee of selectedInviteCodes) {
        if (!existingPending.includes(invitee)) {
          await onInviteContributor(editingPack.id, invitee);
        }
      }
    }
    setEditingPack(null);
  };

  const activePack = modpacks.find((p) => p.id === activeModpackId);

  const renderCollaboratorInviteSection = (isEdit = false) => (
    <div className="space-y-2.5 border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="flex items-center justify-between">
        <label className="font-bold text-neutral-200">Invite Collaborators</label>
        <span className="text-[11px] text-neutral-400">Accepts invite before joining</span>
      </div>

      {/* Clean Friends List */}
      <div className="space-y-1">
        <span className="block text-[11px] text-neutral-400">From Your Friends</span>
        {friends.length === 0 ? (
          <p className="border border-neutral-800 bg-neutral-950 px-2.5 py-2 text-neutral-500">
            No friends added yet. Use a friend code below to invite someone.
          </p>
        ) : (
          <div className="max-h-32 overflow-y-auto border border-neutral-800 bg-neutral-950 divide-y divide-neutral-800">
            {friends.map((f) => {
              const isSelected = selectedInviteCodes.some(
                (c) =>
                  c.toUpperCase() === f.friendCode.toUpperCase() ||
                  c.toLowerCase() === f.username.toLowerCase()
              );
              return (
                <div
                  key={f.id}
                  className="flex items-center justify-between px-2.5 py-1.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-white truncate">{f.username}</span>
                    <span className="font-mono text-[10px] text-neutral-500">
                      {f.friendCode}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleFriendInvite(f.friendCode)}
                    className={`border px-2 py-0.5 text-[11px] ${
                      isSelected
                        ? 'border-neutral-400 bg-neutral-800 font-bold text-white'
                        : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
                    }`}
                  >
                    {isSelected ? 'Invited ✓' : '+ Invite'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invite by Friend Code */}
      <div className="space-y-1 pt-1">
        <span className="block text-[11px] text-neutral-400">Invite by Friend Code</span>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={inviteCodeInput}
            onChange={(e) => setInviteCodeInput(e.target.value)}
            placeholder="Enter friend code (e.g. MCMC-4821)..."
            className="flex-1 border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 font-mono text-white"
          />
          <button
            type="button"
            onClick={handleAddInviteCode}
            className="border border-neutral-700 bg-neutral-800 px-3 py-1.5 font-bold text-white hover:bg-neutral-700"
          >
            {isEdit ? 'Add Invite' : 'Invite'}
          </button>
        </div>
      </div>

      {/* Queued Invitations */}
      {selectedInviteCodes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selectedInviteCodes.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1.5 border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-[11px] text-neutral-200"
            >
              <span>{formatInviteDisplay(code)}</span>
              <button
                type="button"
                onClick={() =>
                  setSelectedInviteCodes((prev) => prev.filter((item) => item !== code))
                }
                className="text-neutral-400 hover:text-white"
                aria-label={`Remove ${code}`}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );

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
        <div
          data-testid="pending-modpack-invites"
          className="border border-neutral-700 bg-neutral-950 p-3 text-xs space-y-2"
        >
          <strong className="text-white block">Pending Modpack Invitations</strong>
          {inviteError && (
            <div className="border border-red-800 bg-red-950/50 px-2.5 py-1.5 text-red-300">
              {inviteError}
            </div>
          )}
          <div className="space-y-1.5">
            {invites.map((inv) => {
              const isBusy = respondingInviteId === inv.id;
              return (
                <div
                  key={inv.id}
                  data-testid={`modpack-invite-${inv.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 border border-neutral-800 bg-neutral-900 p-2"
                >
                  <div>
                    <span className="font-bold text-white">{inv.modpackTitle}</span>{' '}
                    <span className="text-neutral-400">
                      — Invited by {inv.invitedBy}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {onAcceptInvite && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleRespondInvite(inv.id, 'accept')}
                        className="border border-neutral-600 bg-neutral-800 px-2.5 py-1 font-bold text-white hover:bg-neutral-700 disabled:opacity-50"
                      >
                        {isBusy ? 'Accepting...' : 'Accept & Join'}
                      </button>
                    )}
                    {onDeclineInvite && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleRespondInvite(inv.id, 'decline')}
                        className="border border-neutral-800 bg-neutral-950 px-2.5 py-1 text-neutral-400 hover:bg-neutral-900 disabled:opacity-50"
                      >
                        Decline
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid of active modpack projects + Create New Modpack button as the last entry */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modpacks.map((pack) => {
          const cleanCollaborators = (pack.contributors || []).filter((c) => !UUID_REGEX.test(c));
          return (
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
                  {cleanCollaborators.length} Collaborator{cleanCollaborators.length === 1 ? '' : 's'}
                  {pack.pendingInvites && pack.pendingInvites.length > 0
                    ? ` (${pack.pendingInvites.length} invited)`
                    : ''}
                </span>
              </div>
            </div>
          );
        })}

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
          <div className="w-full max-w-md border border-neutral-700 bg-neutral-950 p-4 text-xs text-neutral-200 max-h-[90vh] overflow-y-auto">
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

              {/* Modpack Image File Upload */}
              <div>
                <label className="block text-neutral-400 mb-1">Modpack Picture</label>
                <div className="flex items-center gap-3 border border-neutral-800 bg-neutral-900/50 p-2">
                  <img
                    src={imageUrl || '/MCMC.png'}
                    alt="Modpack preview"
                    className="h-12 w-12 shrink-0 border border-neutral-700 bg-neutral-900 object-contain"
                  />
                  <div className="flex-1 space-y-1">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(e) => void handleImageFileChange(e)}
                      className="block w-full text-[11px] text-neutral-300 file:mr-2 file:border file:border-neutral-700 file:bg-neutral-800 file:px-2.5 file:py-1 file:text-xs file:font-bold file:text-white hover:file:bg-neutral-700"
                    />
                    {isUploadingImage && (
                      <p className="text-[11px] text-neutral-400">Uploading image...</p>
                    )}
                    {uploadError && <p className="text-[11px] text-red-400">{uploadError}</p>}
                  </div>
                </div>
              </div>

              {renderCollaboratorInviteSection(false)}

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
                  disabled={isUploadingImage}
                  className="border border-neutral-600 bg-neutral-800 px-3 py-1.5 font-bold text-white disabled:opacity-50"
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
          <div className="w-full max-w-md border border-neutral-700 bg-neutral-950 p-4 text-xs text-neutral-200 max-h-[90vh] overflow-y-auto">
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

              {/* Modpack Image File Upload */}
              <div>
                <label className="block text-neutral-400 mb-1">Modpack Picture</label>
                <div className="flex items-center gap-3 border border-neutral-800 bg-neutral-900/50 p-2">
                  <img
                    src={imageUrl || '/MCMC.png'}
                    alt="Modpack preview"
                    className="h-12 w-12 shrink-0 border border-neutral-700 bg-neutral-900 object-contain"
                  />
                  <div className="flex-1 space-y-1">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(e) => void handleImageFileChange(e)}
                      className="block w-full text-[11px] text-neutral-300 file:mr-2 file:border file:border-neutral-700 file:bg-neutral-800 file:px-2.5 file:py-1 file:text-xs file:font-bold file:text-white hover:file:bg-neutral-700"
                    />
                    {isUploadingImage && (
                      <p className="text-[11px] text-neutral-400">Uploading image...</p>
                    )}
                    {uploadError && <p className="text-[11px] text-red-400">{uploadError}</p>}
                  </div>
                </div>
              </div>

              {renderCollaboratorInviteSection(true)}

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
                  disabled={isUploadingImage}
                  className="border border-neutral-600 bg-neutral-800 px-3 py-1.5 font-bold text-white disabled:opacity-50"
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
