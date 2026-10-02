import { generateEmbedding } from '../lib/huggingface.js';
import { supabase } from '../lib/supabase.js';
import { ModItem } from '../types/index.js';
import { searchCurseforgeMods } from './curseforge.js';
import { searchModrinthMods } from './modrinth.js';

export interface NLPSearchParams {
  query: string;
  loader?: string;
  gameVersion?: string;
  limit?: number;
}

// Minecraft Concept Map for Natural Language Understanding
const CONCEPT_MAPPINGS: Array<{
  triggers: string[];
  category: string;
  searchKeywords: string[];
}> = [
  {
    triggers: ['performance', 'fps', 'lag', 'boost', 'faster', 'fast', 'smooth', 'lightweight', 'optimization', 'speed', 'framerate'],
    category: 'optimization',
    searchKeywords: ['sodium', 'lithium', 'ferritecore', 'embeddium', 'immediatelyfast', 'modernfix'],
  },
  {
    triggers: ['magic', 'spell', 'spells', 'wizard', 'witch', 'sorcery', 'mana', 'enchantment', 'alchemy'],
    category: 'magic',
    searchKeywords: ['ars nouveau', 'iron spell', 'botania', 'thaumcraft', 'blood magic', 'apotheosis'],
  },
  {
    triggers: ['tech', 'technology', 'automation', 'machine', 'machinery', 'factory', 'pipe', 'pipes', 'power', 'energy', 'train', 'trains', 'steam'],
    category: 'technology',
    searchKeywords: ['create', 'applied energistics', 'mekanism', 'thermal', 'immersive engineering'],
  },
  {
    triggers: ['adventure', 'dungeon', 'dungeons', 'boss', 'bosses', 'rpg', 'loot', 'sword', 'swords', 'weapon', 'weapons', 'armor', 'mobs', 'monsters'],
    category: 'adventure',
    searchKeywords: ['dungeon', 'bosses of mass destruction', 'cataclysm', 'twilight forest', 'alexs mobs', 'when dungeons arise'],
  },
  {
    triggers: ['biome', 'biomes', 'worldgen', 'world', 'terrain', 'trees', 'nature', 'caves', 'overhaul', 'generation', 'dimension', 'dimensions'],
    category: 'worldgen',
    searchKeywords: ['terralith', 'biomes o plenty', 'alexs caves', 'nullscape', 'regions unexplored', 'incendium'],
  },
  {
    triggers: ['farm', 'farming', 'food', 'cooking', 'cook', 'kitchen', 'crop', 'crops', 'plant', 'plants', 'chef', 'cozy', 'agriculture'],
    category: 'food',
    searchKeywords: ['farmers delight', 'cooking for blockheads', 'croptopia', 'pam harvestcraft', 'delight'],
  },
  {
    triggers: ['storage', 'chest', 'chests', 'backpack', 'backpacks', 'inventory', 'sorting', 'drawer', 'drawers'],
    category: 'storage',
    searchKeywords: ['sophisticated backpacks', 'refined storage', 'functional storage', 'iron chests', 'toms simple storage'],
  },
  {
    triggers: ['shader', 'shaders', 'graphics', 'visual', 'visuals', 'lighting', 'texture', 'pretty', 'realistic', 'animations'],
    category: 'utility',
    searchKeywords: ['iris', 'oculus', 'effective', 'visuality', 'dynamic lights', 'continuity'],
  },
  {
    triggers: ['qol', 'quality of life', 'helper', 'info', 'tooltip', 'gui', 'hud', 'map', 'minimap', 'waypoint'],
    category: 'utility',
    searchKeywords: ['jei', 'jade', 'xaeros minimap', 'appleskin', 'mouse tweaks', 'clumps'],
  },
];

/**
 * Natural Language Query Parser
 * Extracts concepts, categories, and targeted keywords from user sentences.
 */
function parseNLPQuery(rawQuery: string): {
  cleanKeywords: string[];
  matchedCategories: string[];
  targetedQueries: string[];
} {
  const normalized = rawQuery.toLowerCase().trim();

  // Strip conversational conversational fillers
  const stopWords = [
    'i want',
    'looking for',
    'mods that',
    'mod that',
    'can you give me',
    'please give me',
    'i need',
    'give me',
    'mods with',
    'mod with',
    'a mod for',
    'mods for',
    'best',
    'good',
    'great',
    'cool',
    'some',
    'and',
    'with',
    'the',
    'for',
    'minecraft',
    'mc',
    'mods',
    'mod',
  ];

  let cleaned = normalized;
  for (const sw of stopWords) {
    cleaned = cleaned.replace(new RegExp(`\\b${sw}\\b`, 'gi'), ' ');
  }
  const cleanTokens = cleaned.split(/\s+/).filter((t) => t.length > 2);

  const matchedCategories: string[] = [];
  const targetedQueries: string[] = [];

  for (const concept of CONCEPT_MAPPINGS) {
    const isTriggered = concept.triggers.some((trigger) =>
      normalized.includes(trigger)
    );

    if (isTriggered) {
      if (!matchedCategories.includes(concept.category)) {
        matchedCategories.push(concept.category);
      }
      targetedQueries.push(...concept.searchKeywords.slice(0, 2));
    }
  }

  // If no concepts matched, use the cleaned tokens
  if (targetedQueries.length === 0 && cleanTokens.length > 0) {
    targetedQueries.push(cleanTokens.join(' '));
  }

  return {
    cleanKeywords: cleanTokens,
    matchedCategories,
    targetedQueries,
  };
}

export async function searchModsWithNLP(params: NLPSearchParams): Promise<{
  results: ModItem[];
  source: 'pgvector' | 'ai-nlp' | 'api-fallback';
}> {
  const { query, loader, gameVersion, limit = 20 } = params;

  if (!query || !query.trim()) {
    // Return top popular mods on Modrinth when empty
    const topMods = await searchModrinthMods({
      query: '',
      loader,
      gameVersion,
      index: 'downloads',
      limit,
    });
    return { results: topMods, source: 'api-fallback' };
  }

  // 1. Try vector semantic search via Hugging Face + Supabase pgvector if connected
  if (supabase) {
    try {
      const embedding = await generateEmbedding(query);
      if (embedding) {
        const { data, error } = await supabase.rpc('match_mods', {
          query_embedding: embedding,
          match_threshold: 0.15,
          match_count: limit,
          filter_loader: loader || null,
          filter_version: gameVersion || null,
        });

        if (!error && data && data.length > 0) {
          const vectorResults: ModItem[] = data.map((item: any) => ({
            id: `${item.source}-${item.external_mod_id}`,
            source: item.source,
            externalModId: item.external_mod_id,
            slug: item.external_mod_id,
            name: item.title,
            summary: item.summary,
            iconUrl: item.icon_url,
            projectUrl:
              item.source === 'modrinth'
                ? `https://modrinth.com/mod/${item.external_mod_id}`
                : `https://www.curseforge.com/minecraft/mc-mods/${item.external_mod_id}`,
            downloads: 0,
            categories: item.categories || [],
            loaders: item.loaders || [],
            gameVersions: item.game_versions || [],
            dependencies: [],
            votes: { yes: [], no: [] },
            comments: [],
          }));

          return { results: vectorResults, source: 'pgvector' };
        }
      }
    } catch (err) {
      console.warn('pgvector search failed, falling back to NLP search:', err);
    }
  }

  // 2. AI NLP Query Expansion & Intent Matching
  const { cleanKeywords, matchedCategories, targetedQueries } = parseNLPQuery(query);

  // Search promises: exact query, targeted queries, and category searches
  const searchPromises: Promise<ModItem[]>[] = [];

  // A) Direct exact query
  searchPromises.push(
    searchModrinthMods({
      query: cleanKeywords.join(' ') || query,
      loader,
      gameVersion,
      limit: 15,
    })
  );

  // B) Targeted AI keyword searches
  for (const targeted of targetedQueries.slice(0, 3)) {
    searchPromises.push(
      searchModrinthMods({
        query: targeted,
        loader,
        gameVersion,
        limit: 10,
      })
    );
  }

  // C) Category facet search
  if (matchedCategories.length > 0) {
    searchPromises.push(
      searchModrinthMods({
        query: '',
        categories: matchedCategories,
        loader,
        gameVersion,
        index: 'downloads',
        limit: 15,
      })
    );
  }

  // D) CurseForge if configured
  searchPromises.push(
    searchCurseforgeMods({
      query: cleanKeywords.join(' ') || query,
      loader,
      gameVersion,
      limit: 10,
    })
  );

  const allResultSets = await Promise.all(searchPromises);
  const seenIds = new Set<string>();
  const combined: ModItem[] = [];

  for (const set of allResultSets) {
    for (const mod of set) {
      if (!seenIds.has(mod.id)) {
        seenIds.add(mod.id);
        combined.push(mod);
      }
    }
  }

  // Sort by downloads & relevance
  combined.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));

  return {
    results: combined.slice(0, limit),
    source: matchedCategories.length > 0 ? 'ai-nlp' : 'api-fallback',
  };
}

/**
 * Recommends mods based on current modpack contents using categories,
 * companion mod relationships, and universal staples.
 */
export async function getModpackRecommendations(
  currentMods: ModItem[],
  loader?: string,
  gameVersion?: string
): Promise<ModItem[]> {
  const existingIds = new Set(
    currentMods.map((m) => m.externalModId.toLowerCase()).concat(currentMods.map((m) => (m.slug || '').toLowerCase()))
  );

  // Universal staple recommendations every modpack benefits from
  const STAPLE_MODS = [
    'jei',
    'jade',
    'sodium',
    'embeddium',
    'ferritecore',
    'appleskin',
    'clumps',
    'mouse-tweaks',
    'waystones',
    'curios',
  ];

  // Specific companion recommendations
  const COMPANION_PAIRS: Record<string, string[]> = {
    create: ['create-steam-and-rails', 'create-crafts-and-additions', 'create-enchantment-industry', 'flywheel', 'jei'],
    farmersdelight: ['nethers-delight', 'brewin-and-chewin', 'farmers-respite', 'aquaculture'],
    irons_spells_n_spellbooks: ['apotheosis', 'reliquary-reincarnations', 'tombstone'],
    ars_nouveau: ['geckolib', 'patchouli', 'curios'],
    botania: ['patchouli', 'curios'],
    appliedenergistics2: ['megacells', 'ae2-things'],
  };

  const candidateQueries: string[] = [];

  if (currentMods.length === 0) {
    // No mods installed: return popular staples
    candidateQueries.push(...STAPLE_MODS.slice(0, 4));
  } else {
    // 1. Check for specific companion add-ons
    for (const mod of currentMods) {
      const nameOrSlug = (mod.slug || mod.name).toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const [key, companions] of Object.entries(COMPANION_PAIRS)) {
        if (nameOrSlug.includes(key)) {
          candidateQueries.push(...companions);
        }
      }
    }

    // 2. Check installed categories
    const categoryCounts: Record<string, number> = {};
    for (const mod of currentMods) {
      for (const cat of mod.categories || []) {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      }
    }

    // Find top categories
    const sortedCats = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat);

    if (sortedCats.length > 0) {
      candidateQueries.push(sortedCats[0]);
    }

    // 3. Add staples if not installed
    for (const staple of STAPLE_MODS) {
      if (!existingIds.has(staple)) {
        candidateQueries.push(staple);
      }
    }
  }

  // Fetch candidate mods from Modrinth in parallel
  const searchTasks = candidateQueries.slice(0, 5).map((q) =>
    searchModrinthMods({
      query: q,
      loader,
      gameVersion,
      index: 'downloads',
      limit: 6,
    })
  );

  // Also fetch top downloaded mods overall for this loader & version
  searchTasks.push(
    searchModrinthMods({
      query: '',
      loader,
      gameVersion,
      index: 'downloads',
      limit: 10,
    })
  );

  const results = await Promise.all(searchTasks);
  const seen = new Set<string>();
  const recommendations: ModItem[] = [];

  for (const set of results) {
    for (const mod of set) {
      const modSlug = (mod.slug || '').toLowerCase();
      const modId = mod.externalModId.toLowerCase();
      if (!existingIds.has(modSlug) && !existingIds.has(modId) && !seen.has(mod.id)) {
        seen.add(mod.id);
        recommendations.push(mod);
      }
    }
  }

  // Sort by downloads descending
  recommendations.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));

  return recommendations.slice(0, 8);
}
