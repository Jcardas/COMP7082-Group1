// server/src/controllers/exportController.ts
// Created by Jacob F on 2026-11-08
//
// Controller handling modpack archive stream generation (.zip / .mrpack).

import { Request, Response } from 'express';
import { exportModpackZip } from '../services/zipExporter.js';

/**
 * POST /api/modpacks/:id/export
 * Streams a CurseForge (.zip) or Modrinth (.mrpack) archive to the client
 */
export async function exportModpack(req: Request, res: Response) {
  try {
    const { modpack, format = 'curseforge' } = req.body;
    await exportModpackZip(modpack, res, { format });
  } catch (error) {
    console.error('Export error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to export modpack' });
    }
  }
}
