import React, { useState } from 'react';
import type { FriendItem, Modpack } from '../types';

interface FriendsViewProps {
  friends: FriendItem[];
  modpacks: Modpack[];
  onAddFriend: (payload: { username?: string; friendCode: string }) => Promise<FriendItem>;
  onRemoveFriend: (id: string) => Promise<void>;
  onInviteFriendToModpack: (modpackId: string, username: string) => Promise<void>;
}

export const FriendsView: React.FC<FriendsViewProps> = ({
  friends,
  modpacks,
  onAddFriend,
  onRemoveFriend,
  onInviteFriendToModpack,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [friendUsername, setFriendUsername] = useState('');
  const [friendCode, setFriendCode] = useState('');

  const [viewingFriend, setViewingFriend] = useState<FriendItem | null>(null);
  const [invitingFriend, setInvitingFriend] = useState<FriendItem | null>(null);
  const [selectedModpackId, setSelectedModpackId] = useState<string>(modpacks[0]?.id || '');
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendCode.trim() && !friendUsername.trim()) return;
    await onAddFriend({
      username: friendUsername.trim() || undefined,
      friendCode: friendCode.trim() || `MCMC-${Math.floor(1000 + Math.random() * 9000)}`,
    });
    setFriendUsername('');
    setFriendCode('');
    setIsAddModalOpen(false);
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitingFriend || !selectedModpackId) return;
    await onInviteFriendToModpack(selectedModpackId, invitingFriend.username);
    setInviteMessage(`Invited ${invitingFriend.username} to modpack.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <h1 className="text-lg font-bold text-white">Friends</h1>
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="border border-neutral-600 bg-neutral-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-neutral-700"
        >
          + Add Friend
        </button>
      </div>

      {friends.length === 0 ? (
        <div className="border border-neutral-800 bg-neutral-950 p-6 text-center text-xs text-neutral-400">
          No friends added yet.
        </div>
      ) : (
        <div className="space-y-2">
          {friends.map((friend) => (
            <div
              key={friend.id}
              className="flex flex-wrap items-center justify-between gap-4 border border-neutral-800 bg-neutral-950 p-3 text-xs"
            >
              <div className="flex items-center gap-3">
                <img
                  src={friend.avatarUrl || '/MCMC.png'}
                  alt={friend.username}
                  className="h-10 w-10 border border-neutral-800 bg-neutral-900 object-contain"
                />
                <div>
                  <strong className="text-sm text-white">{friend.username}</strong>
                  <p className="text-neutral-400">Friend Code: {friend.friendCode}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewingFriend(friend)}
                  className="border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-neutral-200 hover:bg-neutral-800"
                >
                  View Profile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInvitingFriend(friend);
                    setSelectedModpackId(modpacks[0]?.id || 'demo-modpack');
                    setInviteMessage(null);
                  }}
                  className="border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-neutral-200 hover:bg-neutral-800"
                >
                  Invite to Modpack
                </button>
                <button
                  type="button"
                  onClick={() => void onRemoveFriend(friend.id)}
                  className="border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-neutral-300 hover:bg-neutral-800"
                >
                  Remove Friend
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Friend Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md border border-neutral-700 bg-neutral-950 p-4 text-xs text-neutral-200 space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <strong className="text-sm text-white">Add Friend</strong>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="border border-neutral-700 bg-neutral-900 px-2 py-1"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div>
                <label className="block text-neutral-400 mb-1">Friend Code</label>
                <input
                  type="text"
                  required
                  value={friendCode}
                  onChange={(e) => setFriendCode(e.target.value)}
                  placeholder="e.g. MCMC-4821"
                  className="w-full border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-white"
                />
              </div>

              <div>
                <label className="block text-neutral-400 mb-1">Username (Optional)</label>
                <input
                  type="text"
                  value={friendUsername}
                  onChange={(e) => setFriendUsername(e.target.value)}
                  placeholder="Enter friend username..."
                  className="w-full border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-neutral-800 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="border border-neutral-700 bg-neutral-900 px-3 py-1.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="border border-neutral-600 bg-neutral-800 px-3 py-1.5 font-bold text-white"
                >
                  Add Friend
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Friend Profile Modal */}
      {viewingFriend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md border border-neutral-700 bg-neutral-950 p-4 text-xs text-neutral-200 space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <strong className="text-sm text-white">Friend Profile</strong>
              <button
                type="button"
                onClick={() => setViewingFriend(null)}
                className="border border-neutral-700 bg-neutral-900 px-2 py-1"
              >
                Close
              </button>
            </div>

            <div className="flex items-center gap-3">
              <img
                src={viewingFriend.avatarUrl || '/MCMC.png'}
                alt={viewingFriend.username}
                className="h-14 w-14 border border-neutral-800 bg-neutral-900 object-contain"
              />
              <div>
                <p className="text-sm font-bold text-white">{viewingFriend.username}</p>
                <p className="text-neutral-400">Friend Code: {viewingFriend.friendCode}</p>
              </div>
            </div>

            <p className="border border-neutral-800 bg-neutral-900 p-2.5 text-neutral-300">
              {viewingFriend.bio || 'No bio provided.'}
            </p>
          </div>
        </div>
      )}

      {/* Invite Friend to Modpack Modal */}
      {invitingFriend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md border border-neutral-700 bg-neutral-950 p-4 text-xs text-neutral-200 space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <strong className="text-sm text-white">
                Invite {invitingFriend.username} to Modpack
              </strong>
              <button
                type="button"
                onClick={() => setInvitingFriend(null)}
                className="border border-neutral-700 bg-neutral-900 px-2 py-1"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-3">
              <div>
                <label className="block text-neutral-400 mb-1">Select Modpack</label>
                <select
                  value={selectedModpackId}
                  onChange={(e) => setSelectedModpackId(e.target.value)}
                  className="w-full border border-neutral-700 bg-neutral-900 px-2.5 py-2 text-white"
                >
                  {modpacks.map((pack) => (
                    <option key={pack.id} value={pack.id}>
                      {pack.title} (MC {pack.minecraftVersion} - {pack.modLoader.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              {inviteMessage && (
                <div className="border border-neutral-700 bg-neutral-900 p-2 text-white">
                  {inviteMessage}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-neutral-800 pt-3">
                <button
                  type="button"
                  onClick={() => setInvitingFriend(null)}
                  className="border border-neutral-700 bg-neutral-900 px-3 py-1.5"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="border border-neutral-600 bg-neutral-800 px-3 py-1.5 font-bold text-white"
                >
                  Send Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
