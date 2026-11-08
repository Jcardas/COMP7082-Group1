import React, { useState } from 'react';
import type { FriendItem, UserPresence } from '../types';

interface CollaborationSidebarProps {
  currentUser: string;
  contributors: string[];
  activeUsers: UserPresence[];
  friends: FriendItem[];
  onInviteContributor: (usernameOrCode: string) => void;
}

export const CollaborationSidebar: React.FC<CollaborationSidebarProps> = ({
  currentUser,
  contributors,
  activeUsers,
  friends,
  onInviteContributor,
}) => {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [friendCodeInput, setFriendCodeInput] = useState('');

  const allContributors = Array.from(new Set([currentUser, ...contributors]));
  const onlineNames = new Set(activeUsers.map((u) => u.username));

  const handleInviteByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendCodeInput.trim()) return;
    onInviteContributor(friendCodeInput.trim());
    setFriendCodeInput('');
    setIsInviteOpen(false);
  };

  return (
    <div className="border border-neutral-800 bg-neutral-950 p-4 text-xs flex flex-col justify-between space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
          <strong className="text-sm text-white">Contributors</strong>
          <span className="text-neutral-400">{allContributors.length} members</span>
        </div>

        <ul className="space-y-1.5">
          {allContributors.map((member) => {
            const isOnline = onlineNames.has(member) || member === currentUser;
            return (
              <li
                key={member}
                className="flex items-center justify-between border border-neutral-900 bg-neutral-900/50 px-2.5 py-1.5"
              >
                <span className="font-bold text-neutral-200">
                  {member} {member === currentUser ? '(You)' : ''}
                </span>
                <span className="text-neutral-400">{isOnline ? 'Online' : 'Invited'}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <button
        type="button"
        onClick={() => setIsInviteOpen(true)}
        className="w-full border border-neutral-700 bg-neutral-800 px-3 py-2 font-bold text-white hover:bg-neutral-700"
      >
        Invite
      </button>

      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md border border-neutral-700 bg-neutral-950 p-4 text-xs text-neutral-200 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <strong className="text-sm text-white">Invite Collaborator</strong>
              <button
                type="button"
                onClick={() => setIsInviteOpen(false)}
                className="border border-neutral-700 bg-neutral-900 px-2 py-1"
              >
                Close
              </button>
            </div>

            {/* Invite from Friends List */}
            <div className="space-y-2">
              <label className="block font-bold text-neutral-300">Invite from Friends List</label>
              {friends.length === 0 ? (
                <p className="text-neutral-500">No friends in list.</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {friends.map((friend) => {
                    const alreadyAdded = allContributors.includes(friend.username);
                    return (
                      <div
                        key={friend.id}
                        className="flex items-center justify-between border border-neutral-800 bg-neutral-900 p-2"
                      >
                        <div>
                          <strong className="text-white">{friend.username}</strong>{' '}
                          <span className="text-neutral-400">({friend.friendCode})</span>
                        </div>
                        <button
                          type="button"
                          disabled={alreadyAdded}
                          onClick={() => {
                            onInviteContributor(friend.username);
                            setIsInviteOpen(false);
                          }}
                          className="border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-white disabled:opacity-50"
                        >
                          {alreadyAdded ? 'Added' : 'Invite'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Invite via Friend Code */}
            <form onSubmit={handleInviteByCode} className="space-y-2 border-t border-neutral-800 pt-3">
              <label className="block font-bold text-neutral-300">Invite via Friend Code</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={friendCodeInput}
                  onChange={(e) => setFriendCodeInput(e.target.value)}
                  placeholder="Enter Friend Code (e.g. MCMC-4821)..."
                  className="flex-1 border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-white"
                />
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
