// server/src/controllers/modpackController.ts
// Created by Jacob F on 2026-11-08
//
// Controller handling Modpack CRUD operations, collaborative
// mod actions (adding, voting, commenting), friend management,
// and system health status.

import { Request, Response } from 'express';
import { isConfigured as isEmbeddingConfigured } from '../lib/huggingface.js';
import { supabase } from '../lib/supabase.js';
import { FriendItem, ModItem, Modpack } from '../types/consts.js';

// In-memory fallback stores when Supabase is unconfigured or offline
export const inMemoryModpacks = new Map<string, Modpack>();
export const inMemoryFriends = new Map<string, FriendItem>();

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
 * Lists all modpacks from Supabase with fallback to in-memory store
 */
export async function listModpacks(_req: Request, res: Response) {
  if (supabase) {
    try {
      const { data: packs, error } = await supabase
        .from('modpacks')
        .select('*')
        .order('updated_at', { ascending: false });
      if (!error && packs && packs.length > 0) {
        const mapped: Modpack[] = packs.map((p: Record<string, unknown>) => {
          const mem = inMemoryModpacks.get(String(p.id));
          return {
            id: String(p.id),
            title: String(p.title),
            description: p.description ? String(p.description) : undefined,
            imageUrl: mem?.imageUrl || '/MCMC.png',
            contributors: mem?.contributors || [],
            minecraftVersion: String(p.minecraft_version || p.minecraftVersion || '1.20.1'),
            modLoader: (p.mod_loader || p.modLoader || 'forge') as Modpack['modLoader'],
            mods: mem?.mods || [],
            createdAt: String(p.created_at || p.createdAt || new Date().toISOString()),
            updatedAt: String(p.updated_at || p.updatedAt || new Date().toISOString()),
          };
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
 * Creates a new modpack in Supabase and caches it in memory
 */
export async function createModpack(req: Request, res: Response) {
  try {
    const {
      title,
      description,
      imageUrl,
      contributors,
      minecraftVersion,
      modLoader,
      createdBy,
    } = req.body;

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
        const pack: Modpack = {
          id: created.id,
          title: created.title,
          description: created.description,
          imageUrl,
          contributors: contributors.length > 0 ? contributors : [createdBy],
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
    const newPack: Modpack = {
      id: `pack-${Date.now()}`,
      title,
      description,
      imageUrl,
      contributors,
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
 * Retrieves a single modpack by ID
 */
export async function getModpackById(req: Request, res: Response) {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  if (supabase) {
    try {
      const { data: pack, error } = await supabase
        .from('modpacks')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;

      if (pack) {
        const { data: mods } = await supabase
          .from('modpack_mods')
          .select('*')
          .eq('modpack_id', id);
        const mem = inMemoryModpacks.get(id);
        return res.json({
          id: pack.id,
          title: pack.title,
          description: pack.description,
          imageUrl: mem?.imageUrl || '/MCMC.png',
          contributors: mem?.contributors || [],
          minecraftVersion: pack.minecraft_version || pack.minecraftVersion || '1.20.1',
          modLoader: pack.mod_loader || pack.modLoader || 'forge',
          mods: mods && mods.length > 0 ? mods : mem?.mods || [],
          createdAt: pack.created_at || pack.createdAt,
          updatedAt: pack.updated_at || pack.updatedAt,
        });
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
 * Updates modpack metadata, contributors, or mod list
 */
export async function updateModpack(req: Request, res: Response) {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const existing = inMemoryModpacks.get(id);
  const { title, description, imageUrl, contributors, minecraftVersion, modLoader, mods } =
    req.body as Partial<Modpack> & {
      mods?: ModItem[];
    };

  const updated: Modpack = {
    id,
    title: title ?? existing?.title ?? 'Collaborative Pack',
    description: description ?? existing?.description ?? '',
    imageUrl: imageUrl ?? existing?.imageUrl ?? '/MCMC.png',
    contributors: contributors ?? existing?.contributors ?? [],
    minecraftVersion: minecraftVersion ?? existing?.minecraftVersion ?? '1.20.1',
    modLoader: modLoader ?? existing?.modLoader ?? 'forge',
    mods: mods ?? existing?.mods ?? [],
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  inMemoryModpacks.set(id, updated);

  if (supabase) {
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
    } catch {
      // Ignore fallback error
    }
  }

  return res.json(updated);
}

/**
 * POST /api/modpacks/:id/mods
 * Adds a validated ModItem to a modpack
 */
export function addModToModpack(req: Request, res: Response) {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const modpack = inMemoryModpacks.get(id);

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

  return res.status(201).json(newMod);
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

  // Construct ModComment matching the interface in types/consts.ts
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

  if (supabase) {
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
