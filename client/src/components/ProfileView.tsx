import React, { useState } from 'react';

interface ProfileViewProps {
  username: string;
  email: string;
  avatarUrl: string;
  friendCode: string;
  onUpdateProfile: (updates: { username?: string; avatarUrl?: string }) => Promise<void>;
  onUpdateEmail: (newEmail: string) => Promise<void>;
  onUpdatePassword: (newPassword: string) => Promise<void>;
  onDeleteAccount: () => Promise<void>;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  username,
  email,
  avatarUrl,
  friendCode,
  onUpdateProfile,
  onUpdateEmail,
  onUpdatePassword,
  onDeleteAccount,
}) => {
  const [nameInput, setNameInput] = useState(username);
  const [avatarInput, setAvatarInput] = useState(avatarUrl);
  const [emailInput, setEmailInput] = useState(email);
  const [passwordInput, setPasswordInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateProfile({ username: nameInput, avatarUrl: avatarInput });
    setStatusMessage('Profile username and picture updated.');
  };

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    try {
      await onUpdateEmail(emailInput.trim());
      setStatusMessage('Email change submitted.');
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Failed to update email.');
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;
    try {
      await onUpdatePassword(passwordInput.trim());
      setPasswordInput('');
      setStatusMessage('Password updated.');
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Failed to update password.');
    }
  };

  return (
    <div className="max-w-2xl space-y-6 text-xs">
      <div className="border-b border-neutral-800 pb-2">
        <h1 className="text-lg font-bold text-white">Profile Settings</h1>
      </div>

      {statusMessage && (
        <div className="border border-neutral-700 bg-neutral-900 p-3 text-white">
          {statusMessage}
        </div>
      )}

      {/* Friend Code Display */}
      <div className="border border-neutral-800 bg-neutral-950 p-4 space-y-1">
        <strong className="text-sm text-white block">Your Friend Code</strong>
        <p className="text-neutral-400">
          Share this code with friends so they can add you or invite you to modpacks:
        </p>
        <div className="mt-2 inline-block border border-neutral-700 bg-neutral-900 px-3 py-1.5 font-mono text-sm font-bold text-white">
          {friendCode}
        </div>
      </div>

      {/* Username & Profile Picture */}
      <form
        onSubmit={handleSaveProfile}
        className="border border-neutral-800 bg-neutral-950 p-4 space-y-3"
      >
        <strong className="text-sm text-white block">Username &amp; Profile Picture</strong>

        <div className="flex items-center gap-3">
          <img
            src={avatarInput || '/MCMC.png'}
            alt={nameInput}
            className="h-14 w-14 border border-neutral-800 bg-neutral-900 object-contain"
          />
          <div className="flex-1 space-y-2">
            <div>
              <label className="block text-neutral-400 mb-1">Username</label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-white"
              />
            </div>

            <div>
              <label className="block text-neutral-400 mb-1">Profile Picture URL</label>
              <input
                type="text"
                value={avatarInput}
                onChange={(e) => setAvatarInput(e.target.value)}
                className="w-full border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-white"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="border border-neutral-600 bg-neutral-800 px-3 py-1.5 font-bold text-white hover:bg-neutral-700"
        >
          Save Profile
        </button>
      </form>

      {/* Change Email */}
      <form
        onSubmit={handleSaveEmail}
        className="border border-neutral-800 bg-neutral-950 p-4 space-y-3"
      >
        <strong className="text-sm text-white block">Change Email</strong>
        <div>
          <label className="block text-neutral-400 mb-1">New Email Address</label>
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            className="w-full border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-white"
          />
        </div>
        <button
          type="submit"
          className="border border-neutral-600 bg-neutral-800 px-3 py-1.5 font-bold text-white hover:bg-neutral-700"
        >
          Update Email
        </button>
      </form>

      {/* Change Password */}
      <form
        onSubmit={handleSavePassword}
        className="border border-neutral-800 bg-neutral-950 p-4 space-y-3"
      >
        <strong className="text-sm text-white block">Change Password</strong>
        <div>
          <label className="block text-neutral-400 mb-1">New Password</label>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="Enter new password..."
            className="w-full border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-white"
          />
        </div>
        <button
          type="submit"
          className="border border-neutral-600 bg-neutral-800 px-3 py-1.5 font-bold text-white hover:bg-neutral-700"
        >
          Update Password
        </button>
      </form>

      {/* Delete Account */}
      <div className="border border-neutral-800 bg-neutral-950 p-4 space-y-2">
        <strong className="text-sm text-white block">Delete Account</strong>
        <p className="text-neutral-400">Permanently delete your account and sign out.</p>
        <button
          type="button"
          onClick={() => void onDeleteAccount()}
          className="border border-red-800 bg-red-950 px-3 py-1.5 font-bold text-red-200 hover:bg-red-900"
        >
          Delete Account
        </button>
      </div>
    </div>
  );
};
