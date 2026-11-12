// server/src/controllers/modpackController.ts
// Created by Jacob F on 2026-11-08
//
// Controller handling Modpack CRUD operations, collaborative
// mod actions (adding, voting, commenting), collaborator invitations,
// friend requests & management, image uploads, and system health status.

import crypto from 'crypto';
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isConfigured as isEmbeddingConfigured } from '../lib/huggingface.js';
import { supabase } from '../lib/supabase.js';
import {
  computeFriendCode,
  findDirectoryUser,
  findDirectoryUserByFriendCode,
  findDirectoryUserById,
  isUuid,
  loadStore,
  removeUserFromStore,
  resolveContributorDisplayName,
  saveStore,
  syncSupabaseUsers,
  upsertDirectoryUser,
} from '../services/dataStore.js';
import { FriendItem, FriendRequest, ModItem, Modpack, ModpackInvite } from '../types/consts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
const STORAGE_BUCKET = 'mcmc-uploads';

// In-memory fallback stores when Supabase is unconfigured or offline
export const inMemoryModpacks = new Map<string, Modpack>();

function getRequestUserId(req: Request): string {
  const fromQuery = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
  const fromHeader =
    typeof req.headers['x-user-id'] === 'string' ? req.headers['x-user-id'].trim() : '';
  const fromBody =
    req.body && typeof req.body.userId === 'string' ? req.body.userId.trim() : '';
  return fromQuery || fromHeader || fromBody || '';
}

function getRequestUsername(req: Request): string {
  const fromQuery = typeof req.query.username === 'string' ? req.query.username.trim() : '';
  const fromHeader =
    typeof req.headers['x-username'] === 'string' ? req.headers['x-username'].trim() : '';
  return fromQuery || fromHeader || '';
}

function userHasModpackAccess(pack: Modpack, userId: string, username?: string): boolean {
  if (!userId) return false;
  if (pack.createdBy && pack.createdBy === userId) return true;
  if (pack.collaboratorIds && pack.collaboratorIds.includes(userId)) return true;
  if (username && pack.contributors && pack.contributors.includes(username)) {
    // Only match username in non-UUID fallback mode
    if (!isUuid(userId)) return true;
  }
  return false;
}

/**
 * Maps a raw database row from `modpack_mods` into a normalized `ModItem`
 */
function mapDbRowToModItem(row: Record<string, unknown>, memMod?: ModItem): ModItem {
  const source = (row.source === 'curseforge' ? 'curseforge' : 'modrinth') as ModItem['source'];
  const externalModId = String(row.external_mod_id || row.externalModId || '');
  const id = memMod?.id || `${source}-${externalModId}`;
  return {
    id,
    source,
    externalModId,
    slug: row.slug ? String(row.slug) : memMod?.slug,
    name: String(row.name || memMod?.name || externalModId),
    summary: String(row.summary ?? memMod?.summary ?? ''),
    iconUrl: row.icon_url ? String(row.icon_url) : memMod?.iconUrl,
    versionId: row.version_id ? String(row.version_id) : memMod?.versionId,
    versionName: row.version_name ? String(row.version_name) : memMod?.versionName,
    downloadUrl: row.download_url ? String(row.download_url) : memMod?.downloadUrl,
    filename: row.filename ? String(row.filename) : memMod?.filename,
    dependencies: Array.isArray(row.dependencies)
      ? (row.dependencies as ModItem['dependencies'])
      : memMod?.dependencies || [],
    categories: memMod?.categories || [],
    loaders: memMod?.loaders || [],
    gameVersions: memMod?.gameVersions || [],
    addedBy: row.added_by ? String(row.added_by) : memMod?.addedBy || 'Collaborator',
    votes: memMod?.votes || { yes: [], no: [] },
    comments: memMod?.comments || [],
    createdAt: row.created_at ? String(row.created_at) : memMod?.createdAt,
  };
}

/**
 * Synchronizes a modpack's mod list into the Supabase `modpack_mods` table
 */
async function syncModpackModsToSupabase(modpackId: string, mods: ModItem[]): Promise<void> {
  if (!supabase || !isUuid(modpackId)) return;

  try {
    const { data: existingRows } = await supabase
      .from('modpack_mods')
      .select('id, source, external_mod_id')
      .eq('modpack_id', modpackId);

    const incomingKeys = new Set(mods.map((m) => `${m.source}:${m.externalModId}`));

    if (existingRows && existingRows.length > 0) {
      const idsToDelete = existingRows
        .filter((r) => !incomingKeys.has(`${String(r.source)}:${String(r.external_mod_id)}`))
        .map((r) => String(r.id));

      if (idsToDelete.length > 0) {
        await supabase.from('modpack_mods').delete().in('id', idsToDelete);
      }
    }

    if (mods.length > 0) {
      const upsertRows = mods.map((m) => ({
        modpack_id: modpackId,
        source: m.source,
        external_mod_id: m.externalModId,
        slug: m.slug || null,
        name: m.name,
        summary: m.summary || '',
        icon_url: m.iconUrl || null,
        version_id: m.versionId || null,
        version_name: m.versionName || null,
        download_url: m.downloadUrl || null,
        filename: m.filename || null,
        dependencies: m.dependencies || [],
        added_by: m.addedBy || 'Collaborator',
      }));

      const { error } = await supabase
        .from('modpack_mods')
        .upsert(upsertRows, { onConflict: 'modpack_id,source,external_mod_id' });

      if (error) {
        console.warn('Supabase modpack_mods upsert warning:', error.message);
      }
    }
  } catch (err) {
    console.warn('Failed to sync modpack_mods to Supabase:', err);
  }
}

/**
 * Resolves a list of collaborator IDs/names to clean display usernames (never leaking raw UUIDs)
 */
async function resolveContributorsList(
  rawIds: string[],
  fallbackNames: string[] = []
): Promise<string[]> {
  const resolved: string[] = [];
  const seen = new Set<string>();

  for (const raw of [...rawIds, ...fallbackNames]) {
    if (!raw || isUuid(raw)) {
      if (raw && isUuid(raw)) {
        const displayName = await resolveContributorDisplayName(raw);
        if (displayName && !seen.has(displayName.toLowerCase())) {
          seen.add(displayName.toLowerCase());
          resolved.push(displayName);
        }
      }
      continue;
    }

    const cleaned = raw.trim();
    if (cleaned && !seen.has(cleaned.toLowerCase())) {
      seen.add(cleaned.toLowerCase());
      resolved.push(cleaned);
    }
  }

  return resolved;
}

async function hydrateSupabaseModpack(
  p: Record<string, unknown>,
  modRows: Record<string, unknown>[],
  collabRows: Record<string, unknown>[]
): Promise<Modpack> {
  const store = loadStore();
  const pid = String(p.id);
  const mem = inMemoryModpacks.get(pid);

  const mappedMods: ModItem[] =
    modRows.length > 0
      ? modRows.map((r) => {
          const extId = String(r.external_mod_id || '');
          const src = String(r.source || 'modrinth');
          const memMod = mem?.mods.find(
            (m) => m.externalModId === extId && m.source === src
          );
          return mapDbRowToModItem(r, memMod);
        })
      : mem?.mods || [];

  const createdBy = p.created_by ? String(p.created_by) : mem?.createdBy;
  const dbCollabIds = collabRows.map((c) => String(c.user_id));
  const allCollabIds = Array.from(
    new Set([
      ...(createdBy ? [createdBy] : []),
      ...dbCollabIds,
      ...(mem?.collaboratorIds || []),
    ])
  );

  // Resolve all collaborator UUIDs to human-readable usernames (never leak UUIDs)
  const resolvedContributors = await resolveContributorsList(allCollabIds, mem?.contributors || []);

  const pendingForPack = store.modpackInvites
    .filter((inv) => inv.modpackId === pid && inv.status === 'pending')
    .map((inv) => inv.invitedUser);

  const fullPack: Modpack = {
    id: pid,
    title: String(p.title),
    description: p.description ? String(p.description) : undefined,
    imageUrl: store.modpackImages[pid] || mem?.imageUrl || '/MCMC.png',
    createdBy,
    contributors: resolvedContributors,
    collaboratorIds: allCollabIds,
    pendingInvites: Array.from(new Set(pendingForPack)),
    minecraftVersion: String(p.minecraft_version || p.minecraftVersion || '1.21.1'),
    modLoader: (p.mod_loader || p.modLoader || 'forge') as Modpack['modLoader'],
    mods: mappedMods,
    createdAt: String(p.created_at || p.createdAt || new Date().toISOString()),
    updatedAt: String(p.updated_at || p.updatedAt || new Date().toISOString()),
  };

  inMemoryModpacks.set(pid, fullPack);
  return fullPack;
}

/**
 * GET /api/health
 * Returns system status and configured external service flags
 */
export function getHealth(_req: Request, res: Response) {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      supabase: Boolean(supabase),
      huggingface: isEmbeddingConfigured,
      curseforge: Boolean(process.env.CURSEFORGE_API_KEY),
      modrinth: true,
    },
  });
}

/**
 * POST /api/users/sync
 * Registers or updates the current user in the server's user directory
 */
export function syncUser(req: Request, res: Response) {
  const { userId, username, friendCode, avatarUrl } = req.body as {
    userId: string;
    username: string;
    friendCode?: string;
    avatarUrl?: string;
  };
  const user = upsertDirectoryUser({ userId, username, friendCode, avatarUrl });
  return res.json({ user });
}

/**
 * POST /api/upload
 * Uploads a base64-encoded image to Supabase Storage (or local disk fallback) and returns its URL
 */
export async function uploadImage(req: Request, res: Response) {
  try {
    const { filename, mimeType, dataBase64 } = req.body as {
      filename: string;
      mimeType: string;
      dataBase64: string;
    };

    const allowedTypes = new Set([
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/webp',
    ]);
    const normalizedMime = mimeType.toLowerCase().trim();
    if (!allowedTypes.has(normalizedMime)) {
      return res
        .status(400)
        .json({ error: 'Unsupported image type. Allowed: PNG, JPEG, GIF, WEBP.' });
    }

    const cleanBase64 = dataBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    if (buffer.length === 0) {
      return res.status(400).json({ error: 'Uploaded image file is empty.' });
    }
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image file size cannot exceed 5MB.' });
    }

    const extMap: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
    };
    const ext = extMap[normalizedMime] || 'png';
    const safeName = path
      .basename(filename, path.extname(filename))
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);
    const objectName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName || 'img'}.${ext}`;

    if (supabase) {
      try {
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(objectName, buffer, {
            contentType: normalizedMime,
            upsert: false,
          });

        if (uploadError && uploadError.message?.toLowerCase().includes('not found')) {
          await supabase.storage.createBucket(STORAGE_BUCKET, { public: true });
          const retry = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(objectName, buffer, {
              contentType: normalizedMime,
              upsert: false,
            });
          if (!retry.error) {
            const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(objectName);
            return res.status(201).json({ url: pub.publicUrl });
          }
        } else if (!uploadError) {
          const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(objectName);
          return res.status(201).json({ url: pub.publicUrl });
        }
      } catch (err) {
        console.warn('Supabase storage upload failed, falling back to local disk:', err);
      }
    }

    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOADS_DIR, objectName), buffer);
    return res.status(201).json({ url: `/api/uploads/${objectName}` });
  } catch (err) {
    console.error('Upload image error:', err);
    return res.status(500).json({ error: 'Failed to upload image' });
  }
}

/**
 * GET /api/uploads/:filename
 * Serves locally uploaded images when running without Supabase Storage
 */
export function serveUploadedFile(req: Request, res: Response) {
  const rawName = req.params.filename;
  const filename = path.basename(Array.isArray(rawName) ? rawName[0] : rawName);
  const fullPath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  return res.sendFile(fullPath);
}

/**
 * GET /api/modpacks
 * Lists ONLY the modpacks that the requesting user created or was added to as a collaborator
 */
export async function listModpacks(req: Request, res: Response) {
  const userId = getRequestUserId(req);
  const username = getRequestUsername(req);

  if (!userId) {
    return res.json({ modpacks: [] });
  }

  await syncSupabaseUsers(false);

  if (supabase) {
    try {
      let collabPackIds: string[] = [];
      if (isUuid(userId)) {
        const { data: collabRows } = await supabase
          .from('modpack_collaborators')
          .select('modpack_id')
          .eq('user_id', userId);
        collabPackIds = ((collabRows || []) as Record<string, unknown>[]).map((r) =>
          String(r.modpack_id)
        );
      }

      let packsQuery = supabase.from('modpacks').select('*');
      if (collabPackIds.length > 0) {
        packsQuery = packsQuery.or(
          `created_by.eq.${userId},id.in.(${collabPackIds.join(',')})`
        );
      } else {
        packsQuery = packsQuery.eq('created_by', userId);
      }

      const { data: packs, error } = await packsQuery.order('updated_at', { ascending: false });

      if (!error && packs) {
        const packIds = packs.map((p: Record<string, unknown>) => String(p.id));
        if (packIds.length === 0) {
          const memOnly = Array.from(inMemoryModpacks.values()).filter(
            (m) => !isUuid(m.id) && userHasModpackAccess(m, userId, username)
          );
          return res.json({ modpacks: memOnly });
        }

        const [{ data: allModsRows }, { data: allCollabRows }] = await Promise.all([
          supabase.from('modpack_mods').select('*').in('modpack_id', packIds),
          supabase.from('modpack_collaborators').select('*').in('modpack_id', packIds),
        ]);

        const modsByPack = new Map<string, Record<string, unknown>[]>();
        for (const row of (allModsRows || []) as Record<string, unknown>[]) {
          const pid = String(row.modpack_id);
          if (!modsByPack.has(pid)) modsByPack.set(pid, []);
          modsByPack.get(pid)!.push(row);
        }

        const collabsByPack = new Map<string, Record<string, unknown>[]>();
        for (const row of (allCollabRows || []) as Record<string, unknown>[]) {
          const pid = String(row.modpack_id);
          if (!collabsByPack.has(pid)) collabsByPack.set(pid, []);
          collabsByPack.get(pid)!.push(row);
        }

        const mapped = await Promise.all(
          packs.map((p: Record<string, unknown>) => {
            const pid = String(p.id);
            return hydrateSupabaseModpack(
              p,
              modsByPack.get(pid) || [],
              collabsByPack.get(pid) || []
            );
          })
        );

        const memOnly = Array.from(inMemoryModpacks.values()).filter(
          (m) => !isUuid(m.id) && userHasModpackAccess(m, userId, username)
        );

        return res.json({ modpacks: [...mapped, ...memOnly] });
      }
    } catch (err) {
      console.warn('Supabase modpacks list failed, falling back to memory store:', err);
    }
  }

  const visiblePacks = Array.from(inMemoryModpacks.values()).filter((p) =>
    userHasModpackAccess(p, userId, username)
  );
  return res.json({ modpacks: visiblePacks });
}

/**
 * POST /api/modpacks
 * Creates a new modpack, registers the owner, and sends pending invites by friend code or user
 */
export async function createModpack(req: Request, res: Response) {
  try {
    const store = loadStore();
    const {
      title,
      description,
      imageUrl,
      contributors = [],
      pendingInvites = [],
      minecraftVersion = '1.21.1',
      modLoader,
      createdBy,
      creatorName,
    } = req.body as {
      title: string;
      description?: string;
      imageUrl?: string;
      contributors?: string[];
      pendingInvites?: string[];
      minecraftVersion: string;
      modLoader: Modpack['modLoader'];
      createdBy: string;
      creatorName?: string;
    };

    const resolvedOwner = createdBy ? await findDirectoryUserById(createdBy) : null;
    const ownerDisplay =
      creatorName?.trim() ||
      resolvedOwner?.username ||
      (createdBy && !isUuid(createdBy) ? createdBy : 'Owner');

    if (createdBy && ownerDisplay) {
      upsertDirectoryUser({
        userId: createdBy,
        username: ownerDisplay,
      });
    }

    const initialInvitees = Array.from(new Set([...contributors, ...pendingInvites])).filter(
      (u) => u && u !== ownerDisplay && u !== createdBy
    );

    const createInvitesForPack = async (packId: string, packTitle: string) => {
      const pendingLabels: string[] = [];
      for (const rawInvitee of initialInvitees) {
        const target = await findDirectoryUser(rawInvitee);
        if (target && target.userId === createdBy) continue;

        const inviteeLabel = target?.username || rawInvitee;
        const inviteId = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const invite: ModpackInvite = {
          id: inviteId,
          modpackId: packId,
          modpackTitle: packTitle,
          invitedUser: inviteeLabel,
          invitedUserId: target?.userId || (isUuid(rawInvitee) ? rawInvitee : undefined),
          invitedFriendCode: target?.friendCode || (/^MCMC-\d+$/i.test(rawInvitee) ? rawInvitee.toUpperCase() : undefined),
          invitedBy: ownerDisplay,
          invitedById: createdBy,
          status: 'pending',
          createdAt: new Date().toISOString(),
        };
        store.modpackInvites.push(invite);
        pendingLabels.push(inviteeLabel);
      }
      return pendingLabels;
    };

    if (supabase) {
      const { data: created, error } = await supabase
        .from('modpacks')
        .insert({
          title,
          description,
          minecraft_version: minecraftVersion || '1.21.1',
          mod_loader: modLoader,
          created_by: createdBy,
        })
        .select('*')
        .single();

      if (error) {
        console.error('Supabase modpack insert failed:', error);
      } else if (created) {
        const packId = String(created.id);

        if (imageUrl && imageUrl !== '/MCMC.png') {
          store.modpackImages[packId] = imageUrl;
        }

        if (isUuid(createdBy)) {
          await supabase
            .from('modpack_collaborators')
            .upsert(
              {
                modpack_id: packId,
                user_id: createdBy,
                role: 'owner',
              },
              { onConflict: 'modpack_id,user_id' }
            );
        }

        const pendingLabels = await createInvitesForPack(packId, created.title);
        saveStore();

        const pack: Modpack = {
          id: packId,
          title: created.title,
          description: created.description,
          imageUrl: imageUrl || '/MCMC.png',
          createdBy: String(created.created_by || createdBy),
          contributors: [ownerDisplay],
          collaboratorIds: [createdBy],
          pendingInvites: pendingLabels,
          minecraftVersion: created.minecraft_version || '1.21.1',
          modLoader: created.mod_loader,
          mods: [],
          createdAt: created.created_at,
          updatedAt: created.updated_at,
        };
        inMemoryModpacks.set(pack.id, pack);
        return res.status(201).json(pack);
      }
    }

    const now = new Date().toISOString();
    const packId = `pack-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    if (imageUrl && imageUrl !== '/MCMC.png') {
      store.modpackImages[packId] = imageUrl;
    }

    const pendingLabels = await createInvitesForPack(packId, title);
    saveStore();

    const newPack: Modpack = {
      id: packId,
      title,
      description,
      imageUrl: imageUrl || '/MCMC.png',
      createdBy,
      contributors: [ownerDisplay],
      collaboratorIds: [createdBy],
      pendingInvites: pendingLabels,
      minecraftVersion: minecraftVersion || '1.21.1',
      modLoader,
      mods: [],
      createdAt: now,
      updatedAt: now,
    };
    inMemoryModpacks.set(newPack.id, newPack);
    return res.status(201).json(newPack);
  } catch (error) {
    console.error('Create modpack error:', error);
    return res.status(500).json({ error: 'Failed to create modpack' });
  }
}

/**
 * GET /api/modpacks/:id
 * Retrieves a single modpack by ID if the requesting user is a creator or accepted collaborator
 */
export async function getModpackById(req: Request, res: Response) {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const userId = getRequestUserId(req);
  const username = getRequestUsername(req);

  await syncSupabaseUsers(false);

  if (supabase && isUuid(id)) {
    try {
      const { data: pack, error } = await supabase
        .from('modpacks')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;

      if (pack) {
        const [{ data: modRows }, { data: collabRows }] = await Promise.all([
          supabase.from('modpack_mods').select('*').eq('modpack_id', id),
          supabase.from('modpack_collaborators').select('*').eq('modpack_id', id),
        ]);

        const hydrated = await hydrateSupabaseModpack(
          pack as Record<string, unknown>,
          (modRows || []) as Record<string, unknown>[],
          (collabRows || []) as Record<string, unknown>[]
        );

        if (userId && !userHasModpackAccess(hydrated, userId, username)) {
          return res.status(403).json({ error: 'You do not have access to this modpack' });
        }

        return res.json(hydrated);
      }
    } catch (err) {
      console.warn('Supabase fetch failed, falling back to memory store:', err);
    }
  }

  const modpack = inMemoryModpacks.get(id);
  if (!modpack) {
    return res.status(404).json({ error: 'Modpack not found' });
  }

  if (userId && !userHasModpackAccess(modpack, userId, username)) {
    return res.status(403).json({ error: 'You do not have access to this modpack' });
  }

  return res.json(modpack);
}

/**
 * PATCH /api/modpacks/:id
 * Updates modpack metadata, pending invites, or mod list
 */
export async function updateModpack(req: Request, res: Response) {
  const store = loadStore();
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const userId = getRequestUserId(req);
  const username = getRequestUsername(req);

  let existing = inMemoryModpacks.get(id);
  if (!existing && supabase && isUuid(id)) {
    const { data: pack } = await supabase.from('modpacks').select('*').eq('id', id).single();
    if (pack) {
      const [{ data: modRows }, { data: collabRows }] = await Promise.all([
        supabase.from('modpack_mods').select('*').eq('modpack_id', id),
        supabase.from('modpack_collaborators').select('*').eq('modpack_id', id),
      ]);
      existing = await hydrateSupabaseModpack(
        pack as Record<string, unknown>,
        (modRows || []) as Record<string, unknown>[],
        (collabRows || []) as Record<string, unknown>[]
      );
    }
  }

  if (existing && userId && !userHasModpackAccess(existing, userId, username)) {
    return res.status(403).json({ error: 'You do not have permission to edit this modpack' });
  }

  const {
    title,
    description,
    imageUrl,
    contributors,
    pendingInvites,
    minecraftVersion,
    modLoader,
    mods,
  } = req.body as Partial<Modpack> & {
    mods?: ModItem[];
  };

  if (imageUrl !== undefined) {
    store.modpackImages[id] = imageUrl;
    saveStore();
  }

  const resolvedContributors = contributors
    ? await resolveContributorsList(contributors)
    : existing?.contributors ?? [];

  const updated: Modpack = {
    id,
    title: title ?? existing?.title ?? 'Collaborative Pack',
    description: description ?? existing?.description ?? '',
    imageUrl: imageUrl ?? store.modpackImages[id] ?? existing?.imageUrl ?? '/MCMC.png',
    createdBy: existing?.createdBy,
    contributors: resolvedContributors,
    collaboratorIds: existing?.collaboratorIds ?? [],
    pendingInvites: pendingInvites ?? existing?.pendingInvites ?? [],
    minecraftVersion: minecraftVersion ?? existing?.minecraftVersion ?? '1.21.1',
    modLoader: modLoader ?? existing?.modLoader ?? 'forge',
    mods: mods ?? existing?.mods ?? [],
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  inMemoryModpacks.set(id, updated);

  if (supabase && isUuid(id)) {
    try {
      await supabase
        .from('modpacks')
        .update({
          title: updated.title,
          description: updated.description,
          minecraft_version: updated.minecraftVersion,
          mod_loader: updated.modLoader,
        })
        .eq('id', id);

      if (Array.isArray(mods)) {
        await syncModpackModsToSupabase(id, mods);
      }
    } catch (err) {
      console.warn('Supabase updateModpack warning:', err);
    }
  }

  return res.json(updated);
}

/**
 * POST /api/modpacks/:id/mods
 * Adds a validated ModItem to a modpack and persists it to `modpack_mods` in Supabase
 */
export async function addModToModpack(req: Request, res: Response) {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const userId = getRequestUserId(req);
  const username = getRequestUsername(req);
  let modpack = inMemoryModpacks.get(id);

  if (!modpack && supabase && isUuid(id)) {
    const { data: pack } = await supabase.from('modpacks').select('*').eq('id', id).single();
    if (pack) {
      const [{ data: modRows }, { data: collabRows }] = await Promise.all([
        supabase.from('modpack_mods').select('*').eq('modpack_id', id),
        supabase.from('modpack_collaborators').select('*').eq('modpack_id', id),
      ]);
      modpack = await hydrateSupabaseModpack(
        pack as Record<string, unknown>,
        (modRows || []) as Record<string, unknown>[],
        (collabRows || []) as Record<string, unknown>[]
      );
    }
  }

  if (!modpack) {
    return res.status(404).json({ error: 'Modpack not found' });
  }

  if (userId && !userHasModpackAccess(modpack, userId, username)) {
    return res.status(403).json({ error: 'You do not have permission to edit this modpack' });
  }

  const incomingMod = req.body;
  const newMod: ModItem = {
    ...incomingMod,
    id: incomingMod.id || `${incomingMod.source}-${incomingMod.externalModId}`,
    votes: incomingMod.votes || { yes: [], no: [] },
    comments: incomingMod.comments || [],
  };

  const exists = modpack.mods.some(
    (m) => m.id === newMod.id || m.externalModId === newMod.externalModId
  );
  if (!exists) {
    modpack.mods.push(newMod);
    modpack.updatedAt = new Date().toISOString();
  }

  if (supabase && isUuid(id)) {
    try {
      const { error } = await supabase.from('modpack_mods').upsert(
        {
          modpack_id: id,
          source: newMod.source,
          external_mod_id: newMod.externalModId,
          slug: newMod.slug || null,
          name: newMod.name,
          summary: newMod.summary || '',
          icon_url: newMod.iconUrl || null,
          version_id: newMod.versionId || null,
          version_name: newMod.versionName || null,
          download_url: newMod.downloadUrl || null,
          filename: newMod.filename || null,
          dependencies: newMod.dependencies || [],
          added_by: newMod.addedBy || 'Collaborator',
        },
        { onConflict: 'modpack_id,source,external_mod_id' }
      );
      if (error) {
        console.warn('Supabase modpack_mods insert error:', error.message);
      }
    } catch (err) {
      console.warn('Failed to insert into modpack_mods:', err);
    }
  }

  return res.status(201).json(newMod);
}

/**
 * DELETE /api/modpacks/:id/mods/:modId
 * Removes a single mod from a modpack and deletes its row in `modpack_mods`
 */
export async function removeModFromModpack(req: Request, res: Response) {
  const rawId = req.params.id;
  const rawModId = req.params.modId;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const modId = Array.isArray(rawModId) ? rawModId[0] : rawModId;
  const userId = getRequestUserId(req);
  const username = getRequestUsername(req);

  const modpack = inMemoryModpacks.get(id);
  if (modpack && userId && !userHasModpackAccess(modpack, userId, username)) {
    return res.status(403).json({ error: 'You do not have permission to edit this modpack' });
  }

  const removedMod = modpack?.mods.find((m) => m.id === modId || m.externalModId === modId);

  if (modpack) {
    modpack.mods = modpack.mods.filter((m) => m.id !== modId && m.externalModId !== modId);
    modpack.updatedAt = new Date().toISOString();
  }

  if (supabase && isUuid(id)) {
    try {
      const externalId =
        removedMod?.externalModId ||
        modId.replace(/^modrinth-/, '').replace(/^curseforge-/, '');
      await supabase
        .from('modpack_mods')
        .delete()
        .eq('modpack_id', id)
        .eq('external_mod_id', externalId);
    } catch (err) {
      console.warn('Failed to delete from modpack_mods:', err);
    }
  }

  return res.status(204).send();
}

/**
 * POST /api/modpacks/:id/invites
 * Creates a pending invitation for a user (by friend code or userId) to collaborate on a modpack
 */
export async function inviteCollaboratorToModpack(req: Request, res: Response) {
  const store = loadStore();
  const rawId = req.params.id;
  const modpackId = Array.isArray(rawId) ? rawId[0] : rawId;
  const { invitedUser, invitedUserId, invitedBy, invitedById } = req.body as {
    invitedUser: string;
    invitedUserId?: string;
    invitedBy?: string;
    invitedById?: string;
  };

  let modpack = inMemoryModpacks.get(modpackId);
  if (!modpack && supabase && isUuid(modpackId)) {
    const { data: pack } = await supabase.from('modpacks').select('*').eq('id', modpackId).single();
    if (pack) {
      const [{ data: modRows }, { data: collabRows }] = await Promise.all([
        supabase.from('modpack_mods').select('*').eq('modpack_id', modpackId),
        supabase.from('modpack_collaborators').select('*').eq('modpack_id', modpackId),
      ]);
      modpack = await hydrateSupabaseModpack(
        pack as Record<string, unknown>,
        (modRows || []) as Record<string, unknown>[],
        (collabRows || []) as Record<string, unknown>[]
      );
    }
  }

  const modpackTitle = modpack?.title || 'Collaborative Modpack';
  const targetUser =
    (invitedUserId ? await findDirectoryUserById(invitedUserId) : null) ||
    (await findDirectoryUser(invitedUser));

  if (!targetUser && /^MCMC-\d+$/i.test(invitedUser.trim())) {
    return res.status(404).json({ error: `No user found with friend code ${invitedUser.trim().toUpperCase()}.` });
  }

  if (targetUser && modpack?.collaboratorIds?.includes(targetUser.userId)) {
    return res.status(400).json({ error: `${targetUser.username} is already a collaborator.` });
  }

  const resolvedInviteeName = targetUser?.username || invitedUser.trim();
  const resolvedInviteeId = targetUser?.userId || invitedUserId;
  const resolvedFriendCode =
    targetUser?.friendCode ||
    (/^MCMC-\d+$/i.test(invitedUser.trim()) ? invitedUser.trim().toUpperCase() : undefined);

  const existingInvite = store.modpackInvites.find(
    (inv) =>
      inv.modpackId === modpackId &&
      inv.status === 'pending' &&
      ((resolvedInviteeId && inv.invitedUserId === resolvedInviteeId) ||
        (resolvedFriendCode && inv.invitedFriendCode === resolvedFriendCode) ||
        inv.invitedUser.toLowerCase() === resolvedInviteeName.toLowerCase())
  );

  if (existingInvite) {
    return res.status(200).json(existingInvite);
  }

  const invite: ModpackInvite = {
    id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    modpackId,
    modpackTitle,
    invitedUser: resolvedInviteeName,
    invitedUserId: resolvedInviteeId,
    invitedFriendCode: resolvedFriendCode,
    invitedBy: invitedBy || 'Collaborator',
    invitedById,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  store.modpackInvites.push(invite);
  saveStore();

  if (modpack) {
    const pending = modpack.pendingInvites || [];
    if (!pending.includes(resolvedInviteeName)) {
      modpack.pendingInvites = [...pending, resolvedInviteeName];
    }
  }

  return res.status(201).json(invite);
}

/**
 * GET /api/invites
 * Lists pending modpack invitations filtered to the requesting user
 */
export function listModpackInvites(req: Request, res: Response) {
  const store = loadStore();
  const user = typeof req.query.user === 'string' ? req.query.user.trim().toLowerCase() : '';
  const friendCode =
    typeof req.query.friendCode === 'string' ? req.query.friendCode.trim().toUpperCase() : '';
  const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';

  const allPending = store.modpackInvites.filter((inv) => inv.status === 'pending');

  if (!user && !friendCode && !userId) {
    return res.json({ invites: [] });
  }

  const filtered = allPending.filter((inv) => {
    if (userId && inv.invitedUserId && inv.invitedUserId === userId) return true;
    if (friendCode && inv.invitedFriendCode && inv.invitedFriendCode.toUpperCase() === friendCode) {
      return true;
    }
    if (friendCode && inv.invitedUser.toUpperCase() === friendCode) return true;
    if (userId && inv.invitedUser === userId) return true;
    if (!inv.invitedUserId && user && inv.invitedUser.toLowerCase() === user) return true;
    return false;
  });

  return res.json({ invites: filtered });
}

/**
 * POST /api/invites/:inviteId/accept
 * Accepts a pending modpack invitation and permanently adds the user as an editor collaborator
 */
export async function acceptModpackInvite(req: Request, res: Response) {
  const store = loadStore();
  const rawInviteId = req.params.inviteId;
  const inviteId = Array.isArray(rawInviteId) ? rawInviteId[0] : rawInviteId;
  const { userId, username } = req.body as { userId?: string; username?: string };

  const invite = store.modpackInvites.find((inv) => inv.id === inviteId);
  if (!invite) {
    return res.status(404).json({ error: 'Invitation not found' });
  }

  const resolvedUserId = userId?.trim() || invite.invitedUserId || '';
  const dirUser = resolvedUserId ? await findDirectoryUserById(resolvedUserId) : null;
  const acceptedName = dirUser?.username || username?.trim() || invite.invitedUser;

  if (resolvedUserId && acceptedName) {
    upsertDirectoryUser({ userId: resolvedUserId, username: acceptedName });
  }

  invite.status = 'accepted';
  saveStore();

  // Persist to Supabase `modpack_collaborators` when IDs are valid UUIDs
  if (supabase && isUuid(invite.modpackId) && isUuid(resolvedUserId)) {
    try {
      const { error } = await supabase.from('modpack_collaborators').upsert(
        {
          modpack_id: invite.modpackId,
          user_id: resolvedUserId,
          role: 'editor',
        },
        { onConflict: 'modpack_id,user_id' }
      );
      if (error) {
        console.warn('Supabase modpack_collaborators insert warning:', error.message);
      }
    } catch (err) {
      console.warn('Failed to persist collaborator to Supabase:', err);
    }
  }

  let modpack = inMemoryModpacks.get(invite.modpackId);
  if (supabase && isUuid(invite.modpackId)) {
    try {
      const { data: pack } = await supabase
        .from('modpacks')
        .select('*')
        .eq('id', invite.modpackId)
        .single();
      if (pack) {
        const [{ data: modRows }, { data: collabRows }] = await Promise.all([
          supabase.from('modpack_mods').select('*').eq('modpack_id', invite.modpackId),
          supabase.from('modpack_collaborators').select('*').eq('modpack_id', invite.modpackId),
        ]);
        modpack = await hydrateSupabaseModpack(
          pack as Record<string, unknown>,
          (modRows || []) as Record<string, unknown>[],
          (collabRows || []) as Record<string, unknown>[]
        );
      }
    } catch (err) {
      console.warn('Could not rehydrate modpack after invite accept:', err);
    }
  }

  if (modpack) {
    modpack.pendingInvites = (modpack.pendingInvites || []).filter(
      (u) =>
        u.toLowerCase() !== invite.invitedUser.toLowerCase() &&
        u.toUpperCase() !== (invite.invitedFriendCode || '').toUpperCase()
    );
    const currentContributors = modpack.contributors || [];
    if (acceptedName && !isUuid(acceptedName) && !currentContributors.includes(acceptedName)) {
      modpack.contributors = [...currentContributors, acceptedName];
    }
    if (resolvedUserId) {
      const currentIds = modpack.collaboratorIds || [];
      if (!currentIds.includes(resolvedUserId)) {
        modpack.collaboratorIds = [...currentIds, resolvedUserId];
      }
    }
    modpack.updatedAt = new Date().toISOString();
    inMemoryModpacks.set(modpack.id, modpack);
  }

  return res.json({ invite, modpack });
}

/**
 * POST /api/invites/:inviteId/decline
 * Declines a pending modpack invitation
 */
export function declineModpackInvite(req: Request, res: Response) {
  const store = loadStore();
  const rawInviteId = req.params.inviteId;
  const inviteId = Array.isArray(rawInviteId) ? rawInviteId[0] : rawInviteId;

  const invite = store.modpackInvites.find((inv) => inv.id === inviteId);
  if (!invite) {
    return res.status(404).json({ error: 'Invitation not found' });
  }

  invite.status = 'declined';
  saveStore();

  const modpack = inMemoryModpacks.get(invite.modpackId);
  if (modpack) {
    modpack.pendingInvites = (modpack.pendingInvites || []).filter(
      (u) => u.toLowerCase() !== invite.invitedUser.toLowerCase()
    );
  }

  return res.json({ invite });
}

/**
 * POST /api/modpacks/:id/mods/:modId/vote
 * Records a user's 'yes' or 'no' vote on a mod inside a modpack
 */
export function voteOnMod(req: Request, res: Response) {
  const rawId = req.params.id;
  const rawModId = req.params.modId;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const modId = Array.isArray(rawModId) ? rawModId[0] : rawModId;

  const modpack = inMemoryModpacks.get(id);
  if (!modpack) {
    return res.status(404).json({ error: 'Modpack not found' });
  }

  const mod = modpack.mods.find((m) => m.id === modId || m.externalModId === modId);
  if (!mod) {
    return res.status(404).json({ error: 'Mod not found in modpack' });
  }

  const { vote, userId } = req.body as { vote: 'yes' | 'no'; userId: string };
  mod.votes = mod.votes || { yes: [], no: [] };
  mod.votes.yes = mod.votes.yes.filter((u: string) => u !== userId);
  mod.votes.no = mod.votes.no.filter((u: string) => u !== userId);
  mod.votes[vote].push(userId);

  return res.json({ modId: mod.id, votes: mod.votes });
}

/**
 * POST /api/modpacks/:id/mods/:modId/comments
 * Appends a peer comment to a mod inside a modpack
 */
export function commentOnMod(req: Request, res: Response) {
  const rawId = req.params.id;
  const rawModId = req.params.modId;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const modId = Array.isArray(rawModId) ? rawModId[0] : rawModId;

  const modpack = inMemoryModpacks.get(id);
  if (!modpack) {
    return res.status(404).json({ error: 'Modpack not found' });
  }

  const mod = modpack.mods.find((m) => m.id === modId || m.externalModId === modId);
  if (!mod) {
    return res.status(404).json({ error: 'Mod not found in modpack' });
  }

  const { text, user, author } = req.body as {
    text: string;
    user?: string;
    author?: string;
  };

  const newComment = {
    id: `comment-${Date.now()}`,
    user: user || author || 'Anonymous',
    text,
    createdAt: new Date().toISOString(),
  };

  mod.comments = mod.comments || [];
  mod.comments.push(newComment);

  return res.status(201).json(newComment);
}

/**
 * DELETE /api/modpacks/:id
 * Deletes a modpack from memory and Supabase
 */
export async function deleteModpack(req: Request, res: Response) {
  const store = loadStore();
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const userId = getRequestUserId(req);

  const existing = inMemoryModpacks.get(id);
  if (existing && userId && existing.createdBy && existing.createdBy !== userId) {
    return res.status(403).json({ error: 'Only the modpack owner can delete this modpack' });
  }

  inMemoryModpacks.delete(id);
  delete store.modpackImages[id];
  store.modpackInvites = store.modpackInvites.filter((inv) => inv.modpackId !== id);
  saveStore();

  if (supabase && isUuid(id)) {
    try {
      await supabase.from('modpacks').delete().eq('id', id);
    } catch {
      // Ignore fallback error
    }
  }

  return res.status(204).send();
}

/**
 * GET /api/friends
 * Lists accepted friends for the requesting user, always showing their username (not friend code)
 */
export async function listFriends(req: Request, res: Response) {
  const store = loadStore();
  const userId = getRequestUserId(req);

  if (!userId) {
    return res.json({ friends: [] });
  }

  await syncSupabaseUsers(false);

  const userFriendships = store.friendships.filter(
    (f) => f.userAId === userId || f.userBId === userId
  );

  const friends: FriendItem[] = [];
  for (const f of userFriendships) {
    const otherId = f.userAId === userId ? f.userBId : f.userAId;
    const otherUser = await findDirectoryUserById(otherId);
    const username = otherUser?.username || (isUuid(otherId) ? 'Friend' : otherId);
    const friendCode = otherUser?.friendCode || computeFriendCode(otherId);
    friends.push({
      id: f.id,
      userId: otherId,
      username,
      friendCode,
      avatarUrl: otherUser?.avatarUrl || '/MCMC.png',
      bio: `Collaborator (${friendCode})`,
    });
  }

  return res.json({ friends });
}

/**
 * GET /api/friend-requests
 * Lists incoming and outgoing pending friend requests for the requesting user
 */
export async function listFriendRequests(req: Request, res: Response) {
  const store = loadStore();
  const userId = getRequestUserId(req);

  if (!userId) {
    return res.json({ incoming: [], outgoing: [] });
  }

  await syncSupabaseUsers(false);

  const pending = store.friendRequests.filter((r) => r.status === 'pending');

  const hydrateReq = async (r: FriendRequest): Promise<FriendRequest> => {
    const fromUser = await findDirectoryUserById(r.fromUserId);
    const toUser = await findDirectoryUserById(r.toUserId);
    return {
      ...r,
      fromUsername: fromUser?.username || r.fromUsername,
      fromFriendCode: fromUser?.friendCode || r.fromFriendCode,
      fromAvatarUrl: fromUser?.avatarUrl || r.fromAvatarUrl || '/MCMC.png',
      toUsername: toUser?.username || r.toUsername,
      toFriendCode: toUser?.friendCode || r.toFriendCode,
      toAvatarUrl: toUser?.avatarUrl || r.toAvatarUrl || '/MCMC.png',
    };
  };

  const incomingRaw = pending.filter((r) => r.toUserId === userId);
  const outgoingRaw = pending.filter((r) => r.fromUserId === userId);

  const [incoming, outgoing] = await Promise.all([
    Promise.all(incomingRaw.map(hydrateReq)),
    Promise.all(outgoingRaw.map(hydrateReq)),
  ]);

  return res.json({ incoming, outgoing });
}

/**
 * POST /api/friends/requests (and POST /api/friends)
 * Sends a friend request to another user by friend code (does NOT auto-add them)
 */
export async function sendFriendRequest(req: Request, res: Response) {
  const store = loadStore();
  const {
    fromUserId,
    fromUsername,
    fromFriendCode,
    targetFriendCode,
    friendCode,
  } = req.body as {
    fromUserId?: string;
    fromUsername?: string;
    fromFriendCode?: string;
    targetFriendCode?: string;
    friendCode?: string;
  };

  const senderId = fromUserId?.trim() || getRequestUserId(req);
  const code = (targetFriendCode || friendCode || '').trim().toUpperCase();

  if (!senderId) {
    return res.status(400).json({ error: 'Sender userId is required.' });
  }
  if (!code) {
    return res.status(400).json({ error: 'Friend code is required.' });
  }

  if (fromUsername) {
    upsertDirectoryUser({
      userId: senderId,
      username: fromUsername,
      friendCode: fromFriendCode,
    });
  }

  const targetUser = await findDirectoryUserByFriendCode(code);
  if (!targetUser) {
    return res.status(404).json({ error: `No user found with friend code ${code}.` });
  }

  if (targetUser.userId === senderId) {
    return res.status(400).json({ error: 'You cannot send a friend request to yourself.' });
  }

  const alreadyFriends = store.friendships.some(
    (f) =>
      (f.userAId === senderId && f.userBId === targetUser.userId) ||
      (f.userAId === targetUser.userId && f.userBId === senderId)
  );
  if (alreadyFriends) {
    return res.status(400).json({ error: `You are already friends with ${targetUser.username}.` });
  }

  const existingOutgoing = store.friendRequests.find(
    (r) => r.status === 'pending' && r.fromUserId === senderId && r.toUserId === targetUser.userId
  );
  if (existingOutgoing) {
    return res.status(409).json({ error: `Friend request already sent to ${targetUser.username}.` });
  }

  const existingIncoming = store.friendRequests.find(
    (r) => r.status === 'pending' && r.fromUserId === targetUser.userId && r.toUserId === senderId
  );
  if (existingIncoming) {
    return res.status(409).json({
      error: `${targetUser.username} already sent you a friend request! Accept it from Incoming Requests.`,
    });
  }

  const senderUser = await findDirectoryUserById(senderId);
  const request: FriendRequest = {
    id: `freq-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    fromUserId: senderId,
    fromUsername: senderUser?.username || fromUsername || 'Crafter',
    fromFriendCode: senderUser?.friendCode || fromFriendCode || computeFriendCode(senderId),
    fromAvatarUrl: senderUser?.avatarUrl || '/MCMC.png',
    toUserId: targetUser.userId,
    toUsername: targetUser.username,
    toFriendCode: targetUser.friendCode,
    toAvatarUrl: targetUser.avatarUrl || '/MCMC.png',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  store.friendRequests.push(request);
  saveStore();

  return res.status(201).json(request);
}

/**
 * POST /api/friend-requests/:id/accept
 * Accepts a pending friend request and creates a mutual friendship showing usernames
 */
export async function acceptFriendRequest(req: Request, res: Response) {
  const store = loadStore();
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const userId = getRequestUserId(req);

  const request = store.friendRequests.find((r) => r.id === id);
  if (!request) {
    return res.status(404).json({ error: 'Friend request not found' });
  }
  if (userId && request.toUserId !== userId) {
    return res.status(403).json({ error: 'You cannot accept a friend request sent to another user' });
  }

  request.status = 'accepted';

  let friendship = store.friendships.find(
    (f) =>
      (f.userAId === request.fromUserId && f.userBId === request.toUserId) ||
      (f.userAId === request.toUserId && f.userBId === request.fromUserId)
  );

  if (!friendship) {
    friendship = {
      id: `friend-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userAId: request.fromUserId,
      userBId: request.toUserId,
      createdAt: new Date().toISOString(),
    };
    store.friendships.push(friendship);
  }

  saveStore();

  const senderUser = await findDirectoryUserById(request.fromUserId);
  const friend: FriendItem = {
    id: friendship.id,
    userId: request.fromUserId,
    username: senderUser?.username || request.fromUsername,
    friendCode: senderUser?.friendCode || request.fromFriendCode,
    avatarUrl: senderUser?.avatarUrl || request.fromAvatarUrl || '/MCMC.png',
    bio: `Collaborator (${senderUser?.friendCode || request.fromFriendCode})`,
  };

  return res.json({ request, friend });
}

/**
 * POST /api/friend-requests/:id/decline
 * Declines a pending friend request
 */
export function declineFriendRequest(req: Request, res: Response) {
  const store = loadStore();
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const userId = getRequestUserId(req);

  const request = store.friendRequests.find((r) => r.id === id);
  if (!request) {
    return res.status(404).json({ error: 'Friend request not found' });
  }
  if (userId && request.toUserId !== userId && request.fromUserId !== userId) {
    return res.status(403).json({ error: 'Not authorized to decline this friend request' });
  }

  request.status = 'declined';
  saveStore();

  return res.json({ request });
}

/**
 * DELETE /api/friends/:id
 * Removes a friendship by ID
 */
export function deleteFriend(req: Request, res: Response) {
  const store = loadStore();
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  store.friendships = store.friendships.filter((f) => f.id !== id);
  saveStore();
  return res.status(204).send();
}

/**
 * DELETE /api/account
 * Deletes the authenticated user's account and cleans up their social data
 */
export async function deleteAccount(req: Request, res: Response) {
  const userId = getRequestUserId(req);
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  removeUserFromStore(userId);

  if (supabase && isUuid(userId)) {
    try {
      await supabase.from('modpack_collaborators').delete().eq('user_id', userId);
      await supabase.from('modpacks').delete().eq('created_by', userId);
      await supabase.auth.admin.deleteUser(userId);
    } catch (err) {
      console.warn('Supabase account cleanup warning:', err);
    }
  }

  return res.json({ deleted: true });
}
