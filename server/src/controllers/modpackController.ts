// server/src/controllers/modpackController.ts
// Created by Jacob F on 2026-11-08
//
// Controller handling Modpack CRUD operations, collaborative
// mod actions (adding, voting, commenting), collaborator invitations,
// friend management, and system health status.

import { Request, Response } from 'express';
import { isConfigured as isEmbeddingConfigured } from '../lib/huggingface.js';
import { supabase } from '../lib/supabase.js';
import { FriendItem, ModItem, Modpack, ModpackInvite } from '../types/consts.js';

// In-memory fallback stores when Supabase is unconfigured or offline
export const inMemoryModpacks = new Map<string, Modpack>([
  [
    'demo-modpack',
    {
      id: 'demo-modpack',
      title: 'Group 1 Collaborative Pack',
      description: 'Collaborative Minecraft modpack workspace',
      imageUrl: '/MCMC.png',
      createdBy: 'demo-owner',
      contributors: ['Alex', 'Steve'],
      pendingInvites: [],
      minecraftVersion: '1.20.1',
      modLoader: 'forge',
      mods: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
]);
export const inMemoryFriends = new Map<string, FriendItem>();
export const inMemoryInvites = new Map<string, ModpackInvite>();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(val?: string | null): boolean {
  return Boolean(val && UUID_REGEX.test(val));
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
 * GET /api/modpacks
 * Lists all modpacks from Supabase (including modpack_mods & collaborators) with fallback to memory
 */
export async function listModpacks(_req: Request, res: Response) {
  if (supabase) {
    try {
      const { data: packs, error } = await supabase
        .from('modpacks')
        .select('*')
        .order('updated_at', { ascending: false });

      if (!error && packs && packs.length > 0) {
        const packIds = packs.map((p: Record<string, unknown>) => String(p.id));

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

        const collabsByPack = new Map<string, string[]>();
        for (const row of (allCollabRows || []) as Record<string, unknown>[]) {
          const pid = String(row.modpack_id);
          if (!collabsByPack.has(pid)) collabsByPack.set(pid, []);
          collabsByPack.get(pid)!.push(String(row.user_id));
        }

        const mapped: Modpack[] = packs.map((p: Record<string, unknown>) => {
          const pid = String(p.id);
          const mem = inMemoryModpacks.get(pid);
          const dbMods = modsByPack.get(pid) || [];
          const mappedMods: ModItem[] =
            dbMods.length > 0
              ? dbMods.map((r) => {
                  const extId = String(r.external_mod_id || '');
                  const src = String(r.source || 'modrinth');
                  const memMod = mem?.mods.find(
                    (m) => m.externalModId === extId && m.source === src
                  );
                  return mapDbRowToModItem(r, memMod);
                })
              : mem?.mods || [];

          const dbCollabs = collabsByPack.get(pid) || [];
          const mergedContributors = Array.from(
            new Set([...(mem?.contributors || []), ...dbCollabs])
          );

          const pendingForPack = Array.from(inMemoryInvites.values())
            .filter((inv) => inv.modpackId === pid && inv.status === 'pending')
            .map((inv) => inv.invitedUser);

          const fullPack: Modpack = {
            id: pid,
            title: String(p.title),
            description: p.description ? String(p.description) : undefined,
            imageUrl: mem?.imageUrl || '/MCMC.png',
            createdBy: p.created_by ? String(p.created_by) : mem?.createdBy,
            contributors: mergedContributors,
            pendingInvites: Array.from(new Set([...(mem?.pendingInvites || []), ...pendingForPack])),
            minecraftVersion: String(p.minecraft_version || p.minecraftVersion || '1.20.1'),
            modLoader: (p.mod_loader || p.modLoader || 'forge') as Modpack['modLoader'],
            mods: mappedMods,
            createdAt: String(p.created_at || p.createdAt || new Date().toISOString()),
            updatedAt: String(p.updated_at || p.updatedAt || new Date().toISOString()),
          };

          inMemoryModpacks.set(pid, fullPack);
          return fullPack;
        });

        return res.json({ modpacks: mapped });
      }
    } catch (err) {
      console.warn('Supabase modpacks list failed, falling back to memory store:', err);
    }
  }

  return res.json({ modpacks: Array.from(inMemoryModpacks.values()) });
}

/**
 * POST /api/modpacks
 * Creates a new modpack in Supabase with the authenticated user's ID (`created_by`),
 * registers the owner in `modpack_collaborators`, and sends pending invites without
 * immediately adding invitees as accepted contributors.
 */
export async function createModpack(req: Request, res: Response) {
  try {
    const {
      title,
      description,
      imageUrl,
      contributors = [],
      pendingInvites = [],
      minecraftVersion,
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

    const ownerDisplay = creatorName || createdBy || 'Owner';
    const initialInvitees = Array.from(new Set([...contributors, ...pendingInvites])).filter(
      (u) => u && u !== ownerDisplay && u !== createdBy
    );

    if (supabase) {
      const { data: created, error } = await supabase
        .from('modpacks')
        .insert({
          title,
          description,
          minecraft_version: minecraftVersion,
          mod_loader: modLoader,
          created_by: createdBy,
        })
        .select('*')
        .single();

      if (error) {
        console.error('Supabase modpack insert failed:', error);
      } else if (created) {
        const packId = String(created.id);

        // Permanently record the creator as 'owner' in modpack_collaborators if createdBy is a valid UUID
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

        // Create pending invitations for any invited users (do NOT immediately add them as contributors)
        for (const invitee of initialInvitees) {
          const inviteId = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          inMemoryInvites.set(inviteId, {
            id: inviteId,
            modpackId: packId,
            modpackTitle: created.title,
            invitedUser: invitee,
            invitedUserId: isUuid(invitee) ? invitee : undefined,
            invitedBy: ownerDisplay,
            status: 'pending',
            createdAt: new Date().toISOString(),
          });
        }

        const pack: Modpack = {
          id: packId,
          title: created.title,
          description: created.description,
          imageUrl,
          createdBy: String(created.created_by || createdBy),
          contributors: [ownerDisplay],
          pendingInvites: initialInvitees,
          minecraftVersion: created.minecraft_version,
          modLoader: created.mod_loader,
          mods: [],
          createdAt: created.created_at,
          updatedAt: created.updated_at,
        };
        inMemoryModpacks.set(pack.id, pack);
        return res.status(201).json(pack);
      }
    }

    // In-memory fallback if Supabase is unconfigured or unavailable
    const now = new Date().toISOString();
    const packId = `pack-${Date.now()}`;
    for (const invitee of initialInvitees) {
      const inviteId = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      inMemoryInvites.set(inviteId, {
        id: inviteId,
        modpackId: packId,
        modpackTitle: title,
        invitedUser: invitee,
        invitedBy: ownerDisplay,
        status: 'pending',
        createdAt: now,
      });
    }

    const newPack: Modpack = {
      id: packId,
      title,
      description,
      imageUrl,
      createdBy,
      contributors: [ownerDisplay],
      pendingInvites: initialInvitees,
      minecraftVersion,
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
 * Retrieves a single modpack by ID along with its persisted `modpack_mods` and `modpack_collaborators`
 */
export async function getModpackById(req: Request, res: Response) {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

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

        const mem = inMemoryModpacks.get(id);
        const mappedMods: ModItem[] =
          modRows && modRows.length > 0
            ? (modRows as Record<string, unknown>[]).map((r) => {
                const extId = String(r.external_mod_id || '');
                const src = String(r.source || 'modrinth');
                const memMod = mem?.mods.find(
                  (m) => m.externalModId === extId && m.source === src
                );
                return mapDbRowToModItem(r, memMod);
              })
            : mem?.mods || [];

        const dbCollabIds = ((collabRows || []) as Record<string, unknown>[]).map((c) =>
          String(c.user_id)
        );
        const mergedContributors = Array.from(
          new Set([...(mem?.contributors || []), ...dbCollabIds])
        );

        const pendingForPack = Array.from(inMemoryInvites.values())
          .filter((inv) => inv.modpackId === id && inv.status === 'pending')
          .map((inv) => inv.invitedUser);

        const hydrated: Modpack = {
          id: String(pack.id),
          title: String(pack.title),
          description: pack.description ? String(pack.description) : undefined,
          imageUrl: mem?.imageUrl || '/MCMC.png',
          createdBy: pack.created_by ? String(pack.created_by) : mem?.createdBy,
          contributors: mergedContributors,
          pendingInvites: Array.from(new Set([...(mem?.pendingInvites || []), ...pendingForPack])),
          minecraftVersion: String(pack.minecraft_version || pack.minecraftVersion || '1.20.1'),
          modLoader: (pack.mod_loader || pack.modLoader || 'forge') as Modpack['modLoader'],
          mods: mappedMods,
          createdAt: String(pack.created_at || pack.createdAt),
          updatedAt: String(pack.updated_at || pack.updatedAt),
        };

        inMemoryModpacks.set(id, hydrated);
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

  return res.json(modpack);
}

/**
 * PATCH /api/modpacks/:id
 * Updates modpack metadata, pending invites, or mod list (persisting mods to `modpack_mods`)
 */
export async function updateModpack(req: Request, res: Response) {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const existing = inMemoryModpacks.get(id);
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

  const updated: Modpack = {
    id,
    title: title ?? existing?.title ?? 'Collaborative Pack',
    description: description ?? existing?.description ?? '',
    imageUrl: imageUrl ?? existing?.imageUrl ?? '/MCMC.png',
    createdBy: existing?.createdBy,
    contributors: contributors ?? existing?.contributors ?? [],
    pendingInvites: pendingInvites ?? existing?.pendingInvites ?? [],
    minecraftVersion: minecraftVersion ?? existing?.minecraftVersion ?? '1.20.1',
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
  let modpack = inMemoryModpacks.get(id);

  if (!modpack && supabase && isUuid(id)) {
    const { data: pack } = await supabase.from('modpacks').select('*').eq('id', id).single();
    if (pack) {
      modpack = {
        id: String(pack.id),
        title: String(pack.title),
        description: pack.description ? String(pack.description) : undefined,
        imageUrl: '/MCMC.png',
        createdBy: String(pack.created_by || ''),
        contributors: [],
        pendingInvites: [],
        minecraftVersion: String(pack.minecraft_version || '1.20.1'),
        modLoader: (pack.mod_loader || 'forge') as Modpack['modLoader'],
        mods: [],
        createdAt: String(pack.created_at),
        updatedAt: String(pack.updated_at),
      };
      inMemoryModpacks.set(id, modpack);
    }
  }

  if (!modpack) {
    return res.status(404).json({ error: 'Modpack not found' });
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

  const modpack = inMemoryModpacks.get(id);
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
 * Creates a pending invitation for a user to join a modpack (does NOT immediately add them)
 */
export function inviteCollaboratorToModpack(req: Request, res: Response) {
  const rawId = req.params.id;
  const modpackId = Array.isArray(rawId) ? rawId[0] : rawId;
  const { invitedUser, invitedUserId, invitedBy } = req.body as {
    invitedUser: string;
    invitedUserId?: string;
    invitedBy?: string;
  };

  const modpack = inMemoryModpacks.get(modpackId);
  const modpackTitle = modpack?.title || 'Collaborative Modpack';

  // Check if an active pending invite already exists
  const existingInvite = Array.from(inMemoryInvites.values()).find(
    (inv) =>
      inv.modpackId === modpackId &&
      inv.invitedUser.toLowerCase() === invitedUser.toLowerCase() &&
      inv.status === 'pending'
  );

  if (existingInvite) {
    return res.status(200).json(existingInvite);
  }

  const invite: ModpackInvite = {
    id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    modpackId,
    modpackTitle,
    invitedUser,
    invitedUserId,
    invitedBy: invitedBy || 'Collaborator',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  inMemoryInvites.set(invite.id, invite);

  if (modpack) {
    const pending = modpack.pendingInvites || [];
    if (!pending.includes(invitedUser)) {
      modpack.pendingInvites = [...pending, invitedUser];
    }
  }

  return res.status(201).json(invite);
}

/**
 * GET /api/invites
 * Lists pending modpack invitations (optionally filtered by user / friendCode / userId)
 */
export function listModpackInvites(req: Request, res: Response) {
  const user = typeof req.query.user === 'string' ? req.query.user.trim().toLowerCase() : '';
  const friendCode =
    typeof req.query.friendCode === 'string' ? req.query.friendCode.trim().toLowerCase() : '';
  const userId = typeof req.query.userId === 'string' ? req.query.userId.trim().toLowerCase() : '';

  const allPending = Array.from(inMemoryInvites.values()).filter((inv) => inv.status === 'pending');

  if (!user && !friendCode && !userId) {
    return res.json({ invites: allPending });
  }

  const filtered = allPending.filter((inv) => {
    const target = inv.invitedUser.toLowerCase();
    const targetId = (inv.invitedUserId || '').toLowerCase();
    return (
      (user && target === user) ||
      (friendCode && target === friendCode) ||
      (userId && (target === userId || targetId === userId))
    );
  });

  return res.json({ invites: filtered });
}

/**
 * POST /api/invites/:inviteId/accept
 * Accepts a pending modpack invitation and permanently adds the user as a collaborator
 * in both `modpack_collaborators` (Supabase) and the modpack's `contributors` list.
 */
export async function acceptModpackInvite(req: Request, res: Response) {
  const rawInviteId = req.params.inviteId;
  const inviteId = Array.isArray(rawInviteId) ? rawInviteId[0] : rawInviteId;
  const { userId, username } = req.body as { userId?: string; username?: string };

  const invite = inMemoryInvites.get(inviteId);
  if (!invite) {
    return res.status(404).json({ error: 'Invitation not found' });
  }

  invite.status = 'accepted';
  const acceptedName = username?.trim() || invite.invitedUser;
  const resolvedUserId = userId?.trim() || invite.invitedUserId;

  const modpack = inMemoryModpacks.get(invite.modpackId);
  if (modpack) {
    modpack.pendingInvites = (modpack.pendingInvites || []).filter(
      (u) => u.toLowerCase() !== invite.invitedUser.toLowerCase()
    );
    const currentContributors = modpack.contributors || [];
    if (!currentContributors.includes(acceptedName)) {
      modpack.contributors = [...currentContributors, acceptedName];
    }
    modpack.updatedAt = new Date().toISOString();
  }

  // Permanently insert into Supabase `modpack_collaborators` table when IDs are valid UUIDs
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

  return res.json({ invite, modpack });
}

/**
 * POST /api/invites/:inviteId/decline
 * Declines a pending modpack invitation
 */
export function declineModpackInvite(req: Request, res: Response) {
  const rawInviteId = req.params.inviteId;
  const inviteId = Array.isArray(rawInviteId) ? rawInviteId[0] : rawInviteId;

  const invite = inMemoryInvites.get(inviteId);
  if (!invite) {
    return res.status(404).json({ error: 'Invitation not found' });
  }

  invite.status = 'declined';
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
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  inMemoryModpacks.delete(id);

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
 * Lists all saved friends
 */
export function listFriends(_req: Request, res: Response) {
  res.json({ friends: Array.from(inMemoryFriends.values()) });
}

/**
 * POST /api/friends
 * Adds a new collaborator friend entry
 */
export function addFriend(req: Request, res: Response) {
  const { username, friendCode } = req.body as { username?: string; friendCode?: string };
  const code = (friendCode || `MCMC-${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase();
  const resolvedName = username?.trim() || `User_${code.split('-')[1] || '100'}`;
  const newFriend: FriendItem = {
    id: `friend-${Date.now()}`,
    username: resolvedName,
    friendCode: code,
    avatarUrl: '/MCMC.png',
    bio: `Minecraft modpack collaborator (${code})`,
  };
  inMemoryFriends.set(newFriend.id, newFriend);
  res.status(201).json(newFriend);
}

/**
 * DELETE /api/friends/:id
 * Removes a friend by ID
 */
export function deleteFriend(req: Request, res: Response) {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  inMemoryFriends.delete(id);
  res.status(204).send();
}
