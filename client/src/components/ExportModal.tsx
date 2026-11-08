import React, { useState } from 'react';
import { exportModpackZip } from '../services/api';
import type { Modpack } from '../types/consts';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  modpack: Modpack;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, modpack }) => {
  const [format, setFormat] = useState<'curseforge' | 'modrinth'>('curseforge');
  const [isExporting, setIsExporting] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen) return null;

  const handleDownload = async () => {
    try {
      setIsExporting(true);
      setDownloadSuccess(false);

      const blob = await exportModpackZip(modpack, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${modpack.title.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}_${modpack.minecraftVersion}_${format}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setDownloadSuccess(true);
      setIsExporting(false);
    } catch (err) {
      console.error('Export error:', err);
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md border border-neutral-700 bg-neutral-950 text-xs text-neutral-200">
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <strong className="text-sm text-white">Export Modpack</strong>
          <button
            type="button"
            onClick={onClose}
            className="border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-neutral-200 hover:bg-neutral-800"
          >
            Close
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="border border-neutral-800 bg-neutral-900 p-3 space-y-1">
            <p>
              <strong>Title:</strong> {modpack.title}
            </p>
            <p>
              <strong>Minecraft Version:</strong> {modpack.minecraftVersion}
            </p>
            <p>
              <strong>Mod Loader:</strong> {modpack.modLoader}
            </p>
            <p>
              <strong>Mods:</strong> {modpack.mods.length}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block font-bold text-white">Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as 'curseforge' | 'modrinth')}
              className="w-full border border-neutral-700 bg-neutral-900 px-2.5 py-2 text-xs text-white"
            >
              <option value="curseforge">CurseForge Manifest (.zip)</option>
              <option value="modrinth">Modrinth (.mrpack / .zip)</option>
            </select>
          </div>

          {downloadSuccess && (
            <div className="border border-neutral-700 bg-neutral-900 p-2 text-neutral-200">
              Export complete. Download started.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-800 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-neutral-300 hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting || modpack.mods.length === 0}
            className="border border-neutral-600 bg-neutral-800 px-3 py-1.5 font-bold text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {isExporting ? 'Exporting...' : 'Download ZIP'}
          </button>
        </div>
      </div>
    </div>
  );
};
