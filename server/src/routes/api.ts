import { Router } from 'express';
import { isConfigured as isEmbeddingConfigured } from '../lib/huggingface.js';
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
      huggingface: isEmbeddingConfigured,
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

    const searchResults = await searchModsWithNLP({
      query,
      loader,
      gameVersion,
      limit,
    });

    res.json(searchResults);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search mods' });
  }
});

// 3. Modpack Recommendations
apiRouter.post('/recommendations', async (req, res) => {
  try {
    const { mods = [], loader, gameVersion } = req.body;
    const recommendations = await getModpackRecommendations(mods, loader, gameVersion);
    res.json({ recommendations });
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

// 4. Dependency Conflict & Compatibility Analysis
apiRouter.post('/analyze-dependencies', (req, res) => {
  try {
    const { mods = [] } = req.body;
    const analysis = analyzeDependencies(mods);
    res.json(analysis);
  } catch (error) {
    console.error('Dependency analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze dependencies' });
  }
});

// 5. Get Modpack by ID
apiRouter.get('/modpacks/:id', async (req, res) => {
  const { id } = req.params;

  if (supabase) {
    try {
      const { data: pack, error } = await supabase.from('modpacks').select('*').eq('id', id).single();
      if (error) throw error;

      if (pack) {
        const { data: mods } = await supabase.from('modpack_mods').select('*').eq('modpack_id', id);
        return res.json({ ...pack, mods: mods || [] });
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

// 6. Export Modpack to CurseForge / Modrinth compatible zip format
apiRouter.post('/modpacks/:id/export', async (req, res) => {
  try {
    const { modpack, format = 'curseforge' } = req.body;
    if (!modpack) {
      return res.status(400).json({ error: 'Missing modpack object' });
    }

    await exportModpackZip(modpack, res, { format });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export modpack' });
  }
});
