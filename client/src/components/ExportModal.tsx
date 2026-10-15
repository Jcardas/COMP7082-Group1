import React, { useState } from 'react';
import { Download, FileArchive, Loader2, X, CheckCircle2 } from 'lucide-react';
import { exportModpackZip } from '../services/api';
import type { Modpack } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  modpack: Modpack;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  modpack,
}) => {
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
      setTimeout(() => {
        setIsExporting(false);
      }, 1500);
    } catch (err) {
      console.error('Export error:', err);
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0d1226] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30">
              <FileArchive className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Export Modpack Zip</h2>
              <p className="text-xs text-slate-400">Packaged on-the-fly with Node.js archiver</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Modpack Summary
            </label>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs space-y-1 text-slate-300">
              <p><strong className="text-white">Title:</strong> {modpack.title}</p>
              <p><strong className="text-white">Minecraft Version:</strong> {modpack.minecraftVersion}</p>
              <p><strong className="text-white">Mod Loader:</strong> {modpack.modLoader}</p>
              <p><strong className="text-white">Installed Mods:</strong> {modpack.mods.length} mods</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Target Launcher Format
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setFormat('curseforge')}
                className={`rounded-lg border p-3 text-left transition cursor-pointer ${
                  format === 'curseforge'
                    ? 'border-violet-500 bg-violet-950/30 text-violet-300 ring-1 ring-violet-500/40'
                    : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
                }`}
              >
                <strong className="block text-white">CurseForge Manifest</strong>
                <span className="text-[11px] text-slate-400">Compatible with CurseForge App & Prism Launcher</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('modrinth')}
                className={`rounded-lg border p-3 text-left transition cursor-pointer ${
                  format === 'modrinth'
                    ? 'border-violet-500 bg-violet-950/30 text-violet-300 ring-1 ring-violet-500/40'
                    : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
                }`}
              >
                <strong className="block text-white">Modrinth (.mrpack)</strong>
                <span className="text-[11px] text-slate-400">Compatible with Modrinth App & Prism Launcher</span>
              </button>
            </div>
          </div>

          {downloadSuccess && (
            <div className="flex items-center space-x-2 rounded-lg border border-blue-800/40 bg-blue-950/20 p-3 text-xs text-blue-300">
              <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0" />
              <span>Zip archive created and download started!</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-2 border-t border-slate-800 bg-[#090d1f] px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={isExporting || modpack.mods.length === 0}
            className="flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-900/30 hover:from-blue-500 hover:to-violet-500 disabled:opacity-50 transition cursor-pointer"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Archiving...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Download .zip</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
