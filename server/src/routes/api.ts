import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { analyzeDependencies } from '../services/dependencyGraph.js';
import { getModpackRecommendations, searchModsWithNLP } from '../services/search.js';
import { exportModpackZip } from '../services/zipExporter.js';
import { ModItem, Modpack } from '../types/index.js';

export const apiRouter = Router();

// In-memory demo fallback store when Supabase credentials are not yet configured
const inMemoryModpacks = new Map<string, Modpack>([
  [
    'demo-modpack',
    {
      id: 'demo-modpack',
      title: 'Group 1 Collaborative Pack',
      description: 'A custom Minecraft modpack created with friends featuring adventure, magic, and performance!',
      minecraftVersion: '1.20.1',
      modLoader: 'forge',
      mods: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
]);

// 1. Health & Status Check
apiRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      supabase: Boolean(supabase),
      huggingface: Boolean(process.env.HUGGINGFACE_API_KEY),
      curseforge: Boolean(process.env.CURSEFORGE_API_KEY),
      modrinth: true,
    },
  });
});

// 2. Natural Language Semantic Search (pgvector + fallback)
apiRouter.get('/search', async (req, res) => {
  try {
    const query = String(req.query.q || '');
    const loader = req.query.loader ? String(req.query.loader) : undefined;
    const gameVersion = req.query.version ? String(req.query.version) : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;

    const result = await searchModsWithNLP({ query, loader, gameVersion, limit });
    res.json(result);
  } catch (error) {
    console.error('Search endpoint error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// 3. Dependency Analysis using Graphlib
apiRouter.post('/dependencies/analyze', (req, res) => {
  try {
    const mods: ModItem[] = req.body.mods || [];
    const analysis = analyzeDependencies(mods);
    res.json(analysis);
  } catch (error) {
    console.error('Dependency analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze dependencies' });
  }
});

// 4. Modpack Recommendations
apiRouter.post('/recommendations', async (req, res) => {
  try {
    const { mods = [], loader, gameVersion } = req.body;
    const recommendations = await getModpackRecommendations(mods, loader, gameVersion);
    res.json({ recommendations });
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

// 5. Export Modpack to Zip via Archiver
apiRouter.post('/export/zip', async (req, res) => {
  try {
    const modpack: Modpack = req.body.modpack;
    if (!modpack || !modpack.title) {
      return res.status(400).json({ error: 'Invalid modpack data' });
    }

    await exportModpackZip(modpack, res);
  } catch (error) {
    console.error('Export zip error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to export zip' });
    }
  }
});

// 6. Get Modpack
apiRouter.get('/modpacks/:id', async (req, res) => {
  const { id } = req.params;

  if (supabase) {
    try {
      const { data: pack, error } = await supabase.from('modpacks').select('*').eq('id', id).single();
      if (!error && pack) {
        const { data: mods } = await supabase.from('modpack_mods').select('*').eq('modpack_id', id);
        return res.json({ ...pack, mods: mods || [] });
      }
    } catch (err) {
      console.warn('Supabase fetch failed, falling back to memory store:', err);
    }
  }

  const fallback = inMemoryModpacks.get(id);
  if (fallback) {
    return res.json(fallback);
  }

  // Create on the fly if not found for easy group demoing
  const newDemo: Modpack = {
    id,
    title: `Modpack #${id.substring(0, 6)}`,
    minecraftVersion: '1.20.1',
    modLoader: 'forge',
    mods: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  inMemoryModpacks.set(id, newDemo);
  res.json(newDemo);
});
