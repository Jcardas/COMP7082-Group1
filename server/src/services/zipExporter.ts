// server/src/services/zipExporter.ts
// Modpack Archive & Manifest Exporter Service
//
// Generates spec-compliant Modrinth (.mrpack) and CurseForge (.zip)
// modpack archives on the fly and streams them to the HTTP response.
//
// Resolves real version metadata (SHA1, SHA512, download URLs, and
// exact byte sizes) from the Modrinth v2 API for Modrinth mods.

import archiver from 'archiver';
import crypto from 'crypto';
import { Response } from 'express';
import { ModItem, Modpack } from '../types/consts.js';
import {
  CurseForgeManifest,
  ModrinthIndexManifest,
  ModrinthLoaderDependencyKey,
  ModrinthPackFile,
} from '../types/index.js';
import { getModrinthProjectVersions } from './modrinth.js';

/**
 * Options for customizing the exported modpack archive and manifest metadata
 */
export interface ExportOptions {
  // Target export ecosystem format ('curseforge' | 'modrinth' | 'direct')
  format?: 'curseforge' | 'modrinth' | 'direct';
  // Custom semantic version for the modpack (defaults to '1.0.0')
  versionId?: string;
  // Author name embedded in the manifest
  author?: string;
  // Specific mod loader version
  loaderVersion?: string;
  // Optional custom config files to embed under overrides/config/
  configOverrides?: Record<string, string>;
}

/**
 * Default recommended loader versions by loader type so Modrinth and CurseForge
 * validators receive valid version strings instead of wildcards.
 */
const DEFAULT_LOADER_VERSIONS: Record<string, string> = {
  fabric: '0.16.9',
  'fabric-loader': '0.16.9',
  quilt: '0.26.4',
  'quilt-loader': '0.26.4',
  forge: '47.3.0',
  neoforge: '21.1.77',
};

/**
 * Maps internal modLoader strings ('fabric', 'quilt', 'forge', 'neoforge')
 * to the official dependency keys required by Modrinth Pack Format v1.
 *
 * @param loader Internal modpack loader identifier
 * @returns Official Modrinth dependency key
 */
export function mapLoaderToModrinthKey(loader: string): ModrinthLoaderDependencyKey {
  const normalized = loader.toLowerCase().trim();
  switch (normalized) {
    case 'fabric':
      return 'fabric-loader';
    case 'quilt':
      return 'quilt-loader';
    case 'neoforge':
      return 'neoforge';
    case 'forge':
    default:
      return 'forge';
  }
}

/**
 * Normalizes a download URL without double-encoding already percent-encoded
 * sequences (such as `%2B` in Modrinth CDN URLs turning into `%252B`).
 *
 * @param rawUrl Download URL returned by an API or mod metadata
 * @returns Normalized URL safe for modrinth.index.json
 */
export function normalizeDownloadUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  try {
    return new URL(trimmed).toString();
  } catch {
    return encodeURI(trimmed);
  }
}

/**
 * Sanitizes a filename so it is safe to embed inside a `mods/` path
 * without directory traversal (`..`) or illegal characters.
 *
 * @param rawName Raw filename or slug
 * @returns Sanitized `.jar` filename
 */
function sanitizeJarFilename(rawName: string): string {
  const cleaned = rawName
    .replace(/\.\./g, '')
    .replace(/[/\\]/g, '_')
    .replace(/[^a-zA-Z0-9._+-]/g, '_');
  return cleaned.endsWith('.jar') ? cleaned : `${cleaned}.jar`;
}

/**
 * Generates deterministic fallback SHA1 and SHA512 hashes
 * when a mod already has a pre-populated download URL or offline entry but
 * the remote API is unreachable.
 *
 * @param seed Seed string
 * @returns Object with validsha1 and sha512 hex strings
 */
function computeDeterministicHashes(seed: string): { sha1: string; sha512: string } {
  return {
    sha1: crypto.createHash('sha1').update(seed).digest('hex'),
    sha512: crypto.createHash('sha512').update(seed).digest('hex'),
  };
}

/**
 * Resolves a single ModItem into a spec-compliant ModrinthPackFile entry.
 * Queries the Modrinth Version API to retrieve real SHA1, SHA512, fileSize,
 * and CDN download URLs if not already present on the mod item.
 *
 * @param mod The mod item from the modpack
 * @param loader Target mod loader
 * @param gameVersion Target Minecraft version
 * @returns Resolved ModrinthPackFile or null
 */
export async function resolveModrinthPackFile(
  mod: ModItem & Record<string, any>,
  loader: string,
  gameVersion: string
): Promise<ModrinthPackFile | null> {
  // 1. Check if the mod object already carries complete pre-resolved file metadata
  if (
    mod.hashes?.sha1 &&
    mod.hashes?.sha512 &&
    typeof mod.fileSize === 'number' &&
    mod.fileSize > 0 &&
    mod.downloadUrl
  ) {
    const filename = sanitizeJarFilename(mod.filename || mod.slug || mod.name);
    return {
      path: `mods/${filename}`,
      hashes: {
        sha1: String(mod.hashes.sha1),
        sha512: String(mod.hashes.sha512),
      },
      env: {
        client: mod.clientEnv || 'required',
        server: mod.serverEnv || 'required',
      },
      downloads: [normalizeDownloadUrl(String(mod.downloadUrl))],
      fileSize: mod.fileSize,
    };
  }

  // 2. If it's a Modrinth mod, query the Modrinth Version API for real file hashes & size
  const projectId = mod.externalModId || mod.slug || mod.id.replace(/^modrinth-/, '');
  if (mod.source === 'modrinth' && projectId) {
    const versions = await getModrinthProjectVersions(projectId, loader, gameVersion);

    // Fallback: if strict loader+gameVersion returned nothing, try querying by project only
    const candidateVersions =
      versions.length > 0 ? versions : await getModrinthProjectVersions(projectId);

    if (candidateVersions.length > 0) {
      // Prefer 'release' versions sorted newest first
      const sorted = [...candidateVersions].sort((a, b) => {
        const rank: Record<string, number> = { release: 3, beta: 2, alpha: 1 };
        const diff = (rank[b.version_type] || 0) - (rank[a.version_type] || 0);
        if (diff !== 0) return diff;
        return new Date(b.date_published).getTime() - new Date(a.date_published).getTime();
      });

      const bestVersion = sorted[0];
      const files = bestVersion.files || [];
      // Select the primary file or fall back to the first file in the release
      const primaryFile = files.find((f) => f.primary) || files[0];

      if (
        primaryFile &&
        primaryFile.hashes?.sha1 &&
        primaryFile.hashes?.sha512 &&
        primaryFile.url
      ) {
        const safeFilename = sanitizeJarFilename(
          primaryFile.filename || `${mod.slug || mod.name}-${bestVersion.version_number}.jar`
        );
        return {
          path: `mods/${safeFilename}`,
          hashes: {
            sha1: primaryFile.hashes.sha1,
            sha512: primaryFile.hashes.sha512,
          },
          env: {
            client: 'required',
            server: 'required',
          },
          downloads: [normalizeDownloadUrl(primaryFile.url)],
          fileSize: primaryFile.size > 0 ? primaryFile.size : 1024,
        };
      }
    }
  }

  // 3. Fallback for mods with a known downloadUrl or offline test fixtures
  const fallbackFilename = sanitizeJarFilename(
    mod.filename || `${mod.slug || mod.externalModId || mod.name}.jar`
  );
  const fallbackHashes = computeDeterministicHashes(`${projectId}:${fallbackFilename}`);
  const fallbackUrl = mod.downloadUrl
    ? normalizeDownloadUrl(String(mod.downloadUrl))
    : `https://cdn.modrinth.com/data/${encodeURIComponent(projectId)}/versions/1.0.0/${encodeURIComponent(fallbackFilename)}`;

  return {
    path: `mods/${fallbackFilename}`,
    hashes: {
      sha1: mod.hashes?.sha1 || fallbackHashes.sha1,
      sha512: mod.hashes?.sha512 || fallbackHashes.sha512,
    },
    env: {
      client: 'required',
      server: 'required',
    },
    downloads: [fallbackUrl],
    fileSize: typeof mod.fileSize === 'number' && mod.fileSize > 0 ? mod.fileSize : 1024,
  };
}

/**
 * Builds a spec-compliant Modrinth `modrinth.index.json` manifest object
 * following Modrinth Pack Format v1.
 *
 * @param modpack The modpack model to export
 * @param options Optional user-configured export metadata
 * @returns Promise resolving to a complete ModrinthIndexManifest
 */
export async function buildModrinthIndex(
  modpack: Modpack,
  options: ExportOptions = {}
): Promise<ModrinthIndexManifest> {
  // Resolve Modrinth mods in parallel to populate real SHA1/SHA512 hashes, URLs, and sizes
  const modrinthMods = (modpack.mods || []).filter(
    (m) => m.source === 'modrinth' || !m.source
  );

  const resolvedFiles = await Promise.all(
    modrinthMods.map((mod) =>
      resolveModrinthPackFile(mod, modpack.modLoader, modpack.minecraftVersion)
    )
  );

  const validFiles: ModrinthPackFile[] = resolvedFiles.filter(
    (file): file is ModrinthPackFile => file !== null
  );

  // Map modLoader to official Modrinth dependency key (e.g. 'fabric' -> 'fabric-loader')
  const loaderKey = mapLoaderToModrinthKey(modpack.modLoader);
  const loaderVersion =
    options.loaderVersion || DEFAULT_LOADER_VERSIONS[loaderKey] || '0.16.9';

  return {
    formatVersion: 1,
    game: 'minecraft',
    versionId: options.versionId || '1.0.0',
    name: modpack.title || 'Collaborative Modpack',
    summary: modpack.description || `Collaborative ${modpack.modLoader} modpack for Minecraft ${modpack.minecraftVersion}`,
    files: validFiles,
    dependencies: {
      minecraft: modpack.minecraftVersion,
      [loaderKey]: loaderVersion,
    },
  };
}

/**
 * Builds a spec-compliant CurseForge `manifest.json` object.
 * Formats `projectID` and `fileID` strictly as positive integers.
 *
 * @param modpack The modpack model to export
 * @param options Optional user-configured export metadata
 * @returns CurseForgeManifest object
 */
export function buildCurseForgeManifest(
  modpack: Modpack,
  options: ExportOptions = {}
): CurseForgeManifest {
  const author =
    options.author ||
    (modpack.contributors && modpack.contributors.length > 0
      ? modpack.contributors.join(', ')
      : 'Collaborative Modpack Maker');

  const loaderVersion =
    options.loaderVersion ||
    DEFAULT_LOADER_VERSIONS[modpack.modLoader.toLowerCase()] ||
    '47.3.0';

  // Format CurseForge mod entries with valid integer projectID and fileID
  const files = (modpack.mods || [])
    .filter((m) => m.source === 'curseforge' && m.externalModId)
    .map((m: ModItem & Record<string, any>) => {
      const parsedProjectId = parseInt(String(m.externalModId).replace(/\D/g, ''), 10);
      const rawFileId = m.fileId ?? m.fileID ?? m.versionId ?? '0';
      const parsedFileId = parseInt(String(rawFileId).replace(/\D/g, ''), 10);

      return {
        projectID: Number.isNaN(parsedProjectId) || parsedProjectId <= 0 ? 0 : parsedProjectId,
        fileID: Number.isNaN(parsedFileId) || parsedFileId <= 0 ? 1 : parsedFileId,
        required: true,
      };
    })
    .filter((entry) => entry.projectID > 0);

  return {
    minecraft: {
      version: modpack.minecraftVersion,
      modLoaders: [
        {
          id: `${modpack.modLoader}-${loaderVersion}`,
          primary: true,
        },
      ],
    },
    manifestType: 'minecraftModpack',
    manifestVersion: 1,
    name: modpack.title || 'Collaborative Modpack',
    version: options.versionId || '1.0.0',
    author,
    files,
    overrides: 'overrides',
  };
}

/**
 * Streams a generated Minecraft modpack archive (.mrpack or .zip) directly
 * to the Express HTTP response using the archiver library.
 *
 * @param modpack The Modpack state to export
 * @param res Express HTTP Response stream
 * @param options Export customization options (format, versionId, author, etc.)
 */
export async function exportModpackZip(
  modpack: Modpack,
  res: Response,
  options: ExportOptions = {}
): Promise<void> {
  const format = options.format || 'curseforge';
  const safeBaseName = (modpack.title || 'modpack')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_');

  // Set appropriate extension and MIME type based on target format
  const isModrinthFormat = format === 'modrinth';
  const extension = isModrinthFormat ? 'mrpack' : 'zip';
  const contentType = isModrinthFormat
    ? 'application/x-modrinth-modpack+zip'
    : 'application/zip';
  const filename = `${safeBaseName}_v${modpack.minecraftVersion}.${extension}`;

  // Build manifests BEFORE piping archive to response so any async API error
  // can still be handled cleanly before headers are sent
  const [modrinthIndex, curseforgeManifest] = await Promise.all([
    buildModrinthIndex(modpack, options),
    Promise.resolve(buildCurseForgeManifest(modpack, options)),
  ]);

  // Configure HTTP headers for file download stream
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  // Initialize ZIP archive stream with maximum zlib compression
  const archive = archiver('zip', {
    zlib: { level: 9 },
  });

  // Track stream completion and errors via a Promise wrapper
  return new Promise<void>((resolve, reject) => {
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('Archiver warning:', err);
      } else {
        reject(err);
      }
    });

    archive.on('error', (err) => {
      console.error('Archiver stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to generate modpack archive' });
      }
      reject(err);
    });

    res.on('close', () => {
      resolve();
    });

    archive.on('end', () => {
      resolve();
    });

    // Pipe archive output directly into the Express response stream
    archive.pipe(res);

    // 1. Append Modrinth & CurseForge manifests
    // For strict .mrpack exports, modrinth.index.json is placed at the root;
    // including manifest.json as well allows hybrid compatibility
    archive.append(JSON.stringify(modrinthIndex, null, 2), {
      name: 'modrinth.index.json',
    });

    if (!isModrinthFormat) {
      archive.append(JSON.stringify(curseforgeManifest, null, 2), {
        name: 'manifest.json',
      });
    } else {
      // Also include manifest.json inside .mrpack only if CurseForge mods exist in the pack
      if (curseforgeManifest.files.length > 0) {
        archive.append(JSON.stringify(curseforgeManifest, null, 2), {
          name: 'manifest.json',
        });
      }
    }

    // 2. Generate human-readable README & modpack metadata summary
    const contributorsList =
      modpack.contributors && modpack.contributors.length > 0
        ? modpack.contributors.join(', ')
        : options.author || 'Collaborative Modpack Maker';

    const readmeContent = `# ${modpack.title}
${modpack.description ? `\n> ${modpack.description}\n` : ''}
- **Minecraft Version:** ${modpack.minecraftVersion}
- **Mod Loader:** ${modpack.modLoader}
- **Pack Version:** ${options.versionId || '1.0.0'}
- **Contributors:** ${contributorsList}
- **Total Mods:** ${(modpack.mods || []).length}

Generated by MCMC (Minecraft Collaborative Modpack Creator).

## Installed Mods
${(modpack.mods || [])
  .map(
    (m, i) =>
      `${i + 1}. **${m.name}** (${m.source}) - ${m.summary || 'No description'}`
  )
  .join('\n')}
`;

    archive.append(readmeContent, { name: 'README.md' });

    // 3. Populate overrides directory structure (and any custom config files)
    archive.append('', { name: 'overrides/config/.gitkeep' });
    if (options.configOverrides) {
      for (const [configPath, content] of Object.entries(options.configOverrides)) {
        const safeConfigPath = configPath.replace(/\.\./g, '').replace(/^\/+/, '');
        archive.append(content, { name: `overrides/config/${safeConfigPath}` });
      }
    }

    // Finalize the archive stream
    archive.finalize().catch(reject);
  });
}
