import React, { useState } from 'react';
import { uploadImageFile } from '../services/api';

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
  const [editedName, setEditedName] = useState<string | null>(null);
  const [editedAvatar, setEditedAvatar] = useState<string | null>(null);
  const [editedEmail, setEditedEmail] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const nameInput = editedName ?? username;
  const avatarInput = editedAvatar ?? avatarUrl;
  const emailInput = editedEmail ?? email;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setIsUploadingAvatar(true);
    try {
      const uploadedUrl = await uploadImageFile(file);
      setEditedAvatar(uploadedUrl);
      await onUpdateProfile({ username: nameInput, avatarUrl: uploadedUrl });
      setStatusMessage('Profile picture uploaded and saved.');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload profile picture.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateProfile({ username: nameInput, avatarUrl: avatarInput });
    setEditedName(null);
    setEditedAvatar(null);
    setStatusMessage('Profile username and picture updated.');
  };

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    try {
      await onUpdateEmail(emailInput.trim());
      setEditedEmail(null);
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

  const handleConfirmedDelete = async () => {
    setIsDeleting(true);
    try {
      await onDeleteAccount();
    } finally {
      setIsDeleting(false);
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
          Share this code with friends so they can send you a friend request or invite you to modpacks:
        </p>
        <div className="mt-2 inline-block border border-neutral-700 bg-neutral-900 px-3 py-1.5 font-mono text-sm font-bold text-white">
          {friendCode}
        </div>
      </div>

      {/* Username & Profile Picture Upload */}
      <form
        onSubmit={handleSaveProfile}
        className="border border-neutral-800 bg-neutral-950 p-4 space-y-3"
      >
        <strong className="text-sm text-white block">Username &amp; Profile Picture</strong>

        <div className="flex items-center gap-3">
          <img
            src={avatarInput || '/MCMC.png'}
            alt={nameInput}
            className="h-14 w-14 border border-neutral-800 bg-neutral-900 object-contain shrink-0"
          />
          <div className="flex-1 space-y-2">
            <div>
              <label className="block text-neutral-400 mb-1">Username</label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setEditedName(e.target.value)}
                className="w-full border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-white"
              />
            </div>

            <div>
              <label className="block text-neutral-400 mb-1">Upload Profile Picture</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => void handleAvatarUpload(e)}
                className="block w-full text-[11px] text-neutral-300 file:mr-2 file:border file:border-neutral-700 file:bg-neutral-800 file:px-2.5 file:py-1 file:text-xs file:font-bold file:text-white hover:file:bg-neutral-700"
              />
              {isUploadingAvatar && (
                <p className="mt-1 text-[11px] text-neutral-400">Uploading profile picture...</p>
              )}
              {uploadError && <p className="mt-1 text-[11px] text-red-400">{uploadError}</p>}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isUploadingAvatar}
          className="border border-neutral-600 bg-neutral-800 px-3 py-1.5 font-bold text-white hover:bg-neutral-700 disabled:opacity-50"
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
            onChange={(e) => setEditedEmail(e.target.value)}
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

      {/* Delete Account with Are You Sure Check */}
      <div className="border border-neutral-800 bg-neutral-950 p-4 space-y-3">
        <strong className="text-sm text-white block">Delete Account</strong>
        <p className="text-neutral-400">Permanently delete your account and sign out.</p>

        {!confirmingDelete ? (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="border border-red-800 bg-red-950 px-3 py-1.5 font-bold text-red-200 hover:bg-red-900"
          >
            Delete Account
          </button>
        ) : (
          <div className="border border-red-800 bg-red-950/50 p-3 space-y-2.5">
            <p className="font-bold text-red-200">
              Are you sure you want to permanently delete your account? This action cannot be undone.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void handleConfirmedDelete()}
                className="border border-red-700 bg-red-900 px-3 py-1.5 font-bold text-white hover:bg-red-800 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete Account'}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setConfirmingDelete(false)}
                className="border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-neutral-300 hover:bg-neutral-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
