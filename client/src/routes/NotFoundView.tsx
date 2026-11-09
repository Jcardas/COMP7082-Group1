import React from 'react';
import { useNavigate } from 'react-router-dom';

interface NotFoundViewProps {
  message?: string;
  modpackId?: string;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({ message, modpackId }) => {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-lg border border-neutral-800 bg-neutral-950 p-6 text-center text-sm text-neutral-200 space-y-4">
      <h1 className="text-xl font-bold text-white">404 — Page Not Found</h1>
      <p className="text-xs text-neutral-400">
        {message ||
          (modpackId
            ? `Modpack "${modpackId}" could not be found or no longer exists.`
            : 'The page or modpack workspace you requested does not exist.')}
      </p>
      <div className="flex justify-center gap-2 pt-2 text-xs">
        <button
          type="button"
          onClick={() => void navigate('/')}
          className="border border-neutral-600 bg-neutral-800 px-3 py-1.5 font-bold text-white hover:bg-neutral-700"
        >
          Return to Modpack Dashboard
        </button>
      </div>
    </div>
  );
};
