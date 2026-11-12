// server/src/__tests__/zipExporter.test.ts
// Created by Jacob F on 2026-11-12
//
// Unit tests for the Modpack Zip & .mrpack Exporter Service.
// Verifies Modrinth Pack Format v1 compliance, SHA1/SHA512 hash resolution,
// CurseForge manifest integer formatting, and archiver stream output.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PassThrough } from 'stream';
import { Response } from 'express';
import {
  mapLoaderToModrinthKey,
  normalizeDownloadUrl,
  resolveModrinthPackFile,
  buildModrinthIndex,
  buildCurseForgeManifest,
  exportModpackZip,
} from '../services/zipExporter.js';
import * as modrinthService from '../services/modrinth.js';
import { Modpack } from '../types/consts.js';

// Mock the modrinth service so we can control version API responses deterministically
vi.mock('../services/modrinth.js', () => ({
  getModrinthProjectVersions: vi.fn(),
}));

/**
 * Sample 40-char SHA1 and 128-char SHA512 hex strings for spec compliance checks
 */
const MOCK_SHA1 = 'a'.repeat(40);
const MOCK_SHA512 = 'b'.repeat(128);

/**
 * Helper to create a test Modpack fixture
 */
function createSampleModpack(): Modpack {
  return {
    id: 'pack-101',
    title: 'Tech & Magic Pack!',
    description: 'A collaborative test modpack',
    imageUrl: '/MCMC.png',
    contributors: ['Alice', 'Bob'],
    minecraftVersion: '1.20.1',
    modLoader: 'fabric',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    mods: [
      {
        id: 'modrinth-AANobbMI',
        externalModId: 'AANobbMI',
        source: 'modrinth',
        slug: 'sodium',
        name: 'Sodium',
        summary: 'Modern rendering engine',
        downloads: 5000000,
        categories: ['optimization'],
        loaders: ['fabric'],
        gameVersions: ['1.20.1'],
        dependencies: [],
        votes: { yes: ['Alice'], no: [] },
        comments: [],
      },
      {
        id: 'curseforge-238222',
        externalModId: '238222',
        versionId: '4598765',
        source: 'curseforge',
        slug: 'jei',
        name: 'Just Enough Items',
        summary: 'Item and recipe viewing mod',
        downloads: 10000000,
        categories: ['utility'],
        loaders: ['fabric', 'forge'],
        gameVersions: ['1.20.1'],
        dependencies: [],
        votes: { yes: ['Bob'], no: [] },
        comments: [],
      } as any,
    ],
  };
}

describe('Zip Exporter Service - Manifests & Stream Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('mapLoaderToModrinthKey()', () => {
    it('maps internal loader identifiers to official Modrinth Pack Format v1 keys', () => {
      expect(mapLoaderToModrinthKey('fabric')).toBe('fabric-loader');
      expect(mapLoaderToModrinthKey('quilt')).toBe('quilt-loader');
      expect(mapLoaderToModrinthKey('neoforge')).toBe('neoforge');
      expect(mapLoaderToModrinthKey('forge')).toBe('forge');
    });
  });

  describe('normalizeDownloadUrl()', () => {
    it('preserves already percent-encoded URLs without double-encoding %2B to %252B', () => {
      const url =
        'https://cdn.modrinth.com/data/AANobbMI/versions/uMOpc5uV/sodium-neoforge-0.8.13%2Bmc1.21.1.jar';
      expect(normalizeDownloadUrl(url)).toBe(url);
    });

    it('encodes unencoded spaces in download URLs', () => {
      const url = 'https://cdn.modrinth.com/data/AANobbMI/versions/uMOpc5uV/my mod+1.21.1.jar';
      expect(normalizeDownloadUrl(url)).toBe(
        'https://cdn.modrinth.com/data/AANobbMI/versions/uMOpc5uV/my%20mod+1.21.1.jar'
      );
    });
  });

  describe('buildModrinthIndex()', () => {
    it('builds a spec-compliant Modrinth v1 manifest with resolved SHA1, SHA512, URL, and fileSize', async () => {
      // Mock Modrinth version API response for Sodium
      vi.mocked(modrinthService.getModrinthProjectVersions).mockResolvedValueOnce([
        {
          id: 'ver-sodium-1',
          project_id: 'AANobbMI',
          author_id: 'user-1',
          featured: true,
          name: 'Sodium 0.5.8',
          version_number: '0.5.8+mc1.20.1',
          game_versions: ['1.20.1'],
          loaders: ['fabric'],
          version_type: 'release',
          date_published: '2026-05-01T12:00:00Z',
          downloads: 100000,
          files: [
            {
              hashes: {
                sha1: MOCK_SHA1,
                sha512: MOCK_SHA512,
              },
              url: 'https://cdn.modrinth.com/data/AANobbMI/versions/ver-sodium-1/sodium-fabric-0.5.8.jar',
              filename: 'sodium-fabric-0.5.8.jar',
              primary: true,
              size: 845120,
            },
          ],
          dependencies: [],
        },
      ]);

      const pack = createSampleModpack();
      const index = await buildModrinthIndex(pack, {
        versionId: '2.1.0',
        loaderVersion: '0.16.9',
      });

      // Validate root Modrinth Pack Format v1 structure
      expect(index.formatVersion).toBe(1);
      expect(index.game).toBe('minecraft');
      expect(index.versionId).toBe('2.1.0');
      expect(index.name).toBe('Tech & Magic Pack!');
      expect(index.dependencies).toEqual({
        minecraft: '1.20.1',
        'fabric-loader': '0.16.9',
      });

      // Only the Modrinth mod should be included in modrinth.index.json files
      expect(index.files).toHaveLength(1);
      const sodiumFile = index.files[0];
      expect(sodiumFile.path).toBe('mods/sodium-fabric-0.5.8.jar');
      expect(sodiumFile.hashes.sha1).toBe(MOCK_SHA1);
      expect(sodiumFile.hashes.sha512).toBe(MOCK_SHA512);
      expect(sodiumFile.fileSize).toBe(845120);
      expect(sodiumFile.downloads).toEqual([
        'https://cdn.modrinth.com/data/AANobbMI/versions/ver-sodium-1/sodium-fabric-0.5.8.jar',
      ]);
      expect(sodiumFile.env).toEqual({
        client: 'required',
        server: 'required',
      });
    });

    it('does not double-encode %2B in Modrinth CDN download URLs', async () => {
      const modrinthCdnUrl =
        'https://cdn.modrinth.com/data/AANobbMI/versions/uMOpc5uV/sodium-neoforge-0.8.13%2Bmc1.21.1.jar';

      vi.mocked(modrinthService.getModrinthProjectVersions).mockResolvedValueOnce([
        {
          id: 'uMOpc5uV',
          project_id: 'AANobbMI',
          author_id: 'TEZXhE2U',
          featured: false,
          name: 'Sodium 0.8.13 for NeoForge 1.21.1',
          version_number: 'mc1.21.1-0.8.13-neoforge',
          game_versions: ['1.21.1'],
          loaders: ['neoforge'],
          version_type: 'release',
          date_published: '2026-08-28T20:55:02.593669Z',
          downloads: 1595535,
          files: [
            {
              hashes: {
                sha1: MOCK_SHA1,
                sha512: MOCK_SHA512,
              },
              url: modrinthCdnUrl,
              filename: 'sodium-neoforge-0.8.13+mc1.21.1.jar',
              primary: true,
              size: 1292934,
            },
          ],
          dependencies: [],
        },
      ]);

      const pack = createSampleModpack();
      pack.minecraftVersion = '1.21.1';
      pack.modLoader = 'neoforge';

      const index = await buildModrinthIndex(pack);
      expect(index.files).toHaveLength(1);
      expect(index.files[0].downloads).toEqual([modrinthCdnUrl]);
      expect(index.files[0].downloads[0]).not.toContain('%252B');
    });

    it('sanitizes dangerous filenames and generates deterministic fallback hashes when API is offline', async () => {
      // Simulate empty/offline API response
      vi.mocked(modrinthService.getModrinthProjectVersions).mockResolvedValue([]);

      const unsafeMod: any = {
        id: 'modrinth-unsafe',
        externalModId: 'unsafeId',
        source: 'modrinth',
        slug: '../../evil/path',
        name: 'Unsafe Mod',
      };

      const resolved = await resolveModrinthPackFile(unsafeMod, 'fabric', '1.20.1');

      expect(resolved).not.toBeNull();
      // Ensure path traversal '..' and slashes are stripped and locked inside mods/
      expect(resolved!.path.startsWith('mods/')).toBe(true);
      expect(resolved!.path).not.toContain('..');
      // Verify fallback cryptographic hashes match SHA-1 (40 chars) and SHA-512 (128 chars) lengths
      expect(resolved!.hashes.sha1).toMatch(/^[a-f0-9]{40}$/);
      expect(resolved!.hashes.sha512).toMatch(/^[a-f0-9]{128}$/);
      expect(resolved!.fileSize).toBeGreaterThan(0);
    });
  });

  describe('buildCurseForgeManifest()', () => {
    it('formats CurseForge projectID and fileID strictly as positive integers', () => {
      const pack = createSampleModpack();
      const manifest = buildCurseForgeManifest(pack, {
        versionId: '1.2.0',
        loaderVersion: '0.16.9',
      });

      expect(manifest.manifestType).toBe('minecraftModpack');
      expect(manifest.manifestVersion).toBe(1);
      expect(manifest.name).toBe('Tech & Magic Pack!');
      expect(manifest.version).toBe('1.2.0');
      expect(manifest.author).toBe('Alice, Bob');
      expect(manifest.minecraft.version).toBe('1.20.1');
      expect(manifest.minecraft.modLoaders[0]).toEqual({
        id: 'fabric-0.16.9',
        primary: true,
      });

      // Verify CurseForge mod entry has integer projectID and fileID
      expect(manifest.files).toHaveLength(1);
      expect(manifest.files[0]).toEqual({
        projectID: 238222,
        fileID: 4598765,
        required: true,
      });
    });
  });

  describe('exportModpackZip()', () => {
    it('streams a valid .mrpack archive buffer and sets Modrinth MIME headers', async () => {
      vi.mocked(modrinthService.getModrinthProjectVersions).mockResolvedValue([]);

      const pack = createSampleModpack();
      const stream = new PassThrough();
      const chunks: Buffer[] = [];

      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));

      // Attach mock Express Response methods onto the PassThrough stream
      const headers: Record<string, string> = {};
      const mockRes = Object.assign(stream, {
        setHeader: vi.fn((key: string, val: string) => {
          headers[key] = val;
        }),
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        headersSent: false,
      }) as unknown as Response;

      await exportModpackZip(pack, mockRes, { format: 'modrinth' });

      const finalBuffer = Buffer.concat(chunks);

      // Verify HTTP headers match .mrpack specification
      expect(headers['Content-Type']).toBe('application/x-modrinth-modpack+zip');
      expect(headers['Content-Disposition']).toContain('tech___magic_pack__v1.20.1.mrpack');

      // Verify a non-empty ZIP archive with PK magic bytes (0x50, 0x4b) was streamed
      expect(finalBuffer.length).toBeGreaterThan(100);
      expect(finalBuffer[0]).toBe(0x50); // 'P'
      expect(finalBuffer[1]).toBe(0x4b); // 'K'
    });
  });
});
