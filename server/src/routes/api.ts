// server/src/routes/api.ts

import { Router, Request, Response } from 'express';
import { isConfigured as isEmbeddingConfigured } from '../lib/huggingface.js';
import { supabase } from '../lib/supabase.js';
import { analyzeDependencies } from '../services/dependencyGraph.js';
import {
  getModpackRecommendations,
  resolveRequiredDependenciesForMod,
  searchModsWithNLP,
} from '../services/search.js';
import { fetchModDependencies } from '../services/modrinth.js';
import { ModDependenciesResponse } from '../types/index.js';
import { exportModpackZip } from '../services/zipExporter.js';
import { FriendItem, ModItem, Modpack } from '../types/consts.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  addFriendSchema,
  addModSchema,
  analyzeDependenciesBodySchema,
  commentModSchema,
  createModpackSchema,
  exportModpackBodySchema,
  modDependenciesQuerySchema,
  recommendationsBodySchema,
  resolveModDependenciesBodySchema,
  searchQuerySchema,
  updateModpackSchema,
  voteModSchema,
} from '../schemas/modpackSchemas.js';

export const apiRouter = Router();

const inMemoryModpacks = new Map<string, Modpack>();
const inMemoryFriends = new Map<string, FriendItem>();

// 1. Health & Status Check
apiRouter.get('/health', (_req, res) => {
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
});

// 2. Natural Language Semantic Search (validated query parameters)
apiRouter.get('/search', validateQuery(searchQuerySchema), async (req, res) => {
  try {
    const query = String(req.query.q || '');
    const loader = req.query.loader ? String(req.query.loader) : undefined;
    const gameVersion = req.query.version ? String(req.query.version) : undefined;
    const category = req.query.category ? String(req.query.category) : undefined;
    const sourceParam = req.query.source ? String(req.query.source) : 'both';
    const source =
      sourceParam === 'modrinth' || sourceParam === 'curseforge' ? sourceParam : 'both';
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const searchResults = await searchModsWithNLP({
      query,
      loader,
      gameVersion,
      category,
      source,
      page,
      limit,
    });

    res.json(searchResults);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search mods' });
  }
});

// 3. Modpack Recommendations
apiRouter.post(
  '/recommendations',
  validateBody(recommendationsBodySchema),
  async (req, res) => {
    try {
      const { mods = [], loader, gameVersion } = req.body;
      const recommendations = await getModpackRecommendations(mods, loader, gameVersion);
      res.json({ recommendations });
    } catch (error) {
      console.error('Recommendations error:', error);
      res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
  }
);

// 4. Resolve Required Dependencies for a Mod
apiRouter.post(
  '/resolve-mod-dependencies',
  validateBody(resolveModDependenciesBodySchema),
  async (req, res) => {
    try {
      const { mod, loader, gameVersion } = req.body as {
        mod: ModItem;
        loader?: string;
        gameVersion?: string;
      };
      const dependencies = await resolveRequiredDependenciesForMod(mod, loader, gameVersion);
      return res.json({ dependencies });
    } catch (error) {
      console.error('Resolve mod dependencies error:', error);
      return res.status(500).json({ error: 'Failed to resolve mod dependencies' });
    }
  }
);

// 5. Dependency Conflict & Compatibility Analysis (DAG)
apiRouter.post(
  '/analyze-dependencies',
  validateBody(analyzeDependenciesBodySchema),
  (req, res) => {
    try {
      const { mods = [], targetGameVersion, targetLoader } = req.body;
      const analysis = analyzeDependencies(mods, { targetGameVersion, targetLoader });
      res.json(analysis);
    } catch (error) {
      console.error('Dependency analysis error:', error);
      res.status(500).json({ error: 'Failed to analyze dependencies' });
    }
  }
);

// 6. List Modpacks
apiRouter.get('/modpacks', async (_req, res) => {
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
});

// 7. Create Modpack
apiRouter.post('/modpacks', validateBody(createModpackSchema), async (req, res) => {
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
});

// 8. Get Modpack by ID
apiRouter.get('/modpacks/:id', async (req, res) => {
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

  res.json(modpack);
});

// 9. Update Modpack Metadata / Contributors / Mods State
apiRouter.patch('/modpacks/:id', validateBody(updateModpackSchema), async (req, res) => {
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
});

// 9a. Add a Mod to a Modpack (validates externalModId, source, name, dependencies)
apiRouter.post('/modpacks/:id/mods', validateBody(addModSchema), (req, res) => {
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
});

// 9b. Vote on a Mod in a Modpack (validates vote: 'yes' | 'no')
apiRouter.post(
  '/modpacks/:id/mods/:modId/vote',
  validateBody(voteModSchema),
  (req, res) => {
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
);

// 9c. Post a Comment on a Mod in a Modpack (validates text min 1, max 1000 chars)
apiRouter.post(
  '/modpacks/:id/mods/:modId/comments',
  validateBody(commentModSchema),
  (req, res) => {
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
);

// 10. Delete Modpack
apiRouter.delete('/modpacks/:id', async (req, res) => {
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
});

// 11. Export Modpack to CurseForge / Modrinth compatible zip format
apiRouter.post(
  '/modpacks/:id/export',
  validateBody(exportModpackBodySchema),
  async (req, res) => {
    try {
      const { modpack, format = 'curseforge' } = req.body;
      await exportModpackZip(modpack, res, { format });
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ error: 'Failed to export modpack' });
    }
  }
);

// 12. Friends Endpoints
apiRouter.get('/friends', (_req, res) => {
  res.json({ friends: Array.from(inMemoryFriends.values()) });
});

apiRouter.post('/friends', validateBody(addFriendSchema), (req, res) => {
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
});

apiRouter.delete('/friends/:id', (req, res) => {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  inMemoryFriends.delete(id);
  res.status(204).send();
});

// 13. Get mod dependencies
// 13. Get mod dependencies
interface ErrorResponse {
  error: string;
}

apiRouter.get(
  '/mods/:id/dependencies',
  validateQuery(modDependenciesQuerySchema),
  async (
    req: Request,
    res: Response<ModDependenciesResponse | ErrorResponse>
  ) => {
    try {
      const rawId = req.params.id;
      const loader = typeof req.query.loader === 'string' ? req.query.loader : undefined;
      const gameVersion = typeof req.query.version === 'string' ? req.query.version : undefined;

      // Narrow id to guarantee single string
      const id = Array.isArray(rawId) ? rawId[0] : rawId;

      if (!id || typeof id !== 'string' || id.trim().length === 0) {
        res.status(400).json({ error: 'Missing required mod ID parameter' });
        return;
      }

      // Call the Modrinth service dependency fetcher
      const result = await fetchModDependencies(id.trim(), loader, gameVersion);

      res.json(result);
    } catch (error) {
      console.error(`Error resolving dependencies for mod ${req.params.id}:`, error);
      res.status(500).json({ error: 'Failed to fetch mod dependencies' });
    }
  }
);

export default apiRouter;