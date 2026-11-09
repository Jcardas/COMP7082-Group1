import React, { useState } from 'react';
import type { FriendItem, ModpackInvite, UserPresence } from '../types/consts';

interface CollaborationSidebarProps {
  currentUser: string;
  contributors: string[];
  pendingInvites?: string[];
  invites?: ModpackInvite[];
  activeUsers: UserPresence[];
  friends: FriendItem[];
  onInviteContributor: (usernameOrCode: string) => void;
  onAcceptInvite?: (inviteId: string) => void;
  onDeclineInvite?: (inviteId: string) => void;
}

export const CollaborationSidebar: React.FC<CollaborationSidebarProps> = ({
  currentUser,
  contributors,
  pendingInvites = [],
  invites = [],
  activeUsers,
  friends,
  onInviteContributor,
  onAcceptInvite,
  onDeclineInvite,
}) => {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [inviteStatusMessage, setInviteStatusMessage] = useState<string | null>(null);

  const acceptedContributors = Array.from(new Set([currentUser, ...contributors]));
  const onlineNames = new Set(activeUsers.map((u) => u.username));

  const handleInviteByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendCodeInput.trim()) return;
    const target = friendCodeInput.trim();
    onInviteContributor(target);
    setFriendCodeInput('');
    setInviteStatusMessage(`Invitation sent to ${target}. Waiting for them to accept.`);
  };

  return (
    <div className="border border-neutral-800 bg-neutral-950 p-4 text-xs flex flex-col justify-between space-y-4">
      <div className="space-y-4">
        {/* Accepted Contributors */}
        <div className="space-y-2">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <strong className="text-sm text-white">Contributors</strong>
            <span className="text-neutral-400">{acceptedContributors.length} joined</span>
          </div>

          <ul className="space-y-1.5">
            {acceptedContributors.map((member) => {
              const isOnline = onlineNames.has(member) || member === currentUser;
              return (
                <li
                  key={member}
                  className="flex items-center justify-between border border-neutral-900 bg-neutral-900/50 px-2.5 py-1.5"
                >
                  <span className="font-bold text-neutral-200">
                    {member} {member === currentUser ? '(You)' : ''}
                  </span>
                  <span className="text-neutral-400">{isOnline ? 'Online' : 'Collaborator'}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Pending Invitations (Not yet added to the modpack) */}
        {(pendingInvites.length > 0 || invites.length > 0) && (
          <div className="space-y-2 border-t border-neutral-800 pt-3">
            <div className="flex items-center justify-between">
              <strong className="text-neutral-300">Pending Invitations</strong>
              <span className="text-neutral-500">{pendingInvites.length} pending</span>
            </div>

            <ul className="space-y-1.5">
              {pendingInvites.map((invitee) => {
                const matchingInvite = invites.find(
                  (inv) =>
                    inv.invitedUser.toLowerCase() === invitee.toLowerCase() &&
                    inv.status === 'pending'
                );
                return (
                  <li
                    key={invitee}
                    className="flex flex-wrap items-center justify-between gap-2 border border-neutral-800 bg-neutral-900/40 px-2.5 py-1.5"
                  >
                    <div>
                      <span className="text-neutral-300">{invitee}</span>
                      <span className="ml-1.5 text-[10px] text-neutral-500">(Invited)</span>
                    </div>

                    {matchingInvite && onAcceptInvite && onDeclineInvite && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onAcceptInvite(matchingInvite.id)}
                          className="border border-neutral-600 bg-neutral-800 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-neutral-700"
                        >
                          Accept Join
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeclineInvite(matchingInvite.id)}
                          className="border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-[11px] text-neutral-400 hover:bg-neutral-800"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          setInviteStatusMessage(null);
          setIsInviteOpen(true);
        }}
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

            {inviteStatusMessage && (
              <div className="border border-neutral-700 bg-neutral-900 p-2.5 text-white">
                {inviteStatusMessage}
              </div>
            )}

            {/* Invite from Friends List */}
            <div className="space-y-2">
              <label className="block font-bold text-neutral-300">Invite from Friends List</label>
              {friends.length === 0 ? (
                <p className="text-neutral-500">No friends in list.</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {friends.map((friend) => {
                    const alreadyJoined = acceptedContributors.includes(friend.username);
                    const alreadyInvited = pendingInvites.includes(friend.username);
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
                          disabled={alreadyJoined || alreadyInvited}
                          onClick={() => {
                            onInviteContributor(friend.username);
                            setInviteStatusMessage(
                              `Invitation sent to ${friend.username}. They will be added once they accept.`
                            );
                          }}
                          className="border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-white disabled:opacity-50"
                        >
                          {alreadyJoined
                            ? 'Joined'
                            : alreadyInvited
                              ? 'Invite Sent'
                              : 'Send Invite'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Invite via Friend Code */}
            <form
              onSubmit={handleInviteByCode}
              className="space-y-2 border-t border-neutral-800 pt-3"
            >
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
