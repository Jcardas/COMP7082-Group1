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

// In-memory LRU-like cache for mod embeddings to make semantic re-ranking ultra-fast
const modEmbeddingCache = new Map<string, number[]>();

/**
 * Calculates cosine similarity between two normalized vectors (dot product).
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

/**
 * Extensive Minecraft Natural Language Concept Map.
 * Maps open-ended conversational triggers to categories and authoritative representative mods.
 */
const CONCEPT_MAPPINGS: Array<{
  triggers: string[];
  category: string;
  searchKeywords: string[];
}> = [
  {
    triggers: [
      'performance', 'fps', 'lag', 'boost', 'faster', 'fast', 'smooth',
      'lightweight', 'optimization', 'speed', 'framerate', 'memory', 'ram',
      'potato', 'low end', 'stutter', 'optifine', 'render'
    ],
    category: 'optimization',
    searchKeywords: ['sodium', 'lithium', 'ferritecore', 'embeddium', 'immediatelyfast', 'modernfix'],
  },
  {
    triggers: [
      'magic', 'spell', 'spells', 'wizard', 'witch', 'sorcery', 'mana',
      'enchantment', 'alchemy', 'wand', 'ritual', 'spellbook', 'grimoire',
      'druid', 'necromancy', 'cast', 'casting'
    ],
    category: 'magic',
    searchKeywords: ['ars nouveau', 'iron spell', 'botania', 'thaumcraft', 'blood magic', 'apotheosis', 'mahou tsukai'],
  },
  {
    triggers: [
      'tech', 'technology', 'automation', 'machine', 'machinery', 'factory',
      'pipe', 'pipes', 'power', 'energy', 'train', 'trains', 'steam', 'electricity',
      'contraption', 'conveyor', 'quarry', 'generator', 'gears', 'kinetic', 'rf', 'fe'
    ],
    category: 'technology',
    searchKeywords: ['create', 'applied energistics', 'mekanism', 'thermal expansion', 'immersive engineering', 'industrialcraft'],
  },
  {
    triggers: [
      'adventure', 'dungeon', 'dungeons', 'boss', 'bosses', 'rpg', 'loot',
      'sword', 'swords', 'weapon', 'weapons', 'armor', 'mobs', 'monsters',
      'relic', 'structure', 'ruins', 'tower', 'explore', 'quest', 'quests', 'bounty'
    ],
    category: 'adventure',
    searchKeywords: ['dungeon', 'cataclysm', 'twilight forest', 'alexs mobs', 'when dungeons arise', 'bosses of mass destruction'],
  },
  {
    triggers: [
      'biome', 'biomes', 'worldgen', 'world', 'terrain', 'trees', 'nature',
      'caves', 'overhaul', 'generation', 'dimension', 'dimensions', 'space',
      'planet', 'sky', 'ocean', 'nether', 'end', 'landscape'
    ],
    category: 'worldgen',
    searchKeywords: ['terralith', 'biomes o plenty', 'alexs caves', 'nullscape', 'regions unexplored', 'ad astra', 'aether'],
  },
  {
    triggers: [
      'farm', 'farming', 'food', 'cooking', 'cook', 'kitchen', 'crop', 'crops',
      'plant', 'plants', 'chef', 'cozy', 'agriculture', 'bakery', 'feast', 'meals', 'orchard'
    ],
    category: 'food',
    searchKeywords: ['farmers delight', 'cooking for blockheads', 'croptopia', 'pam harvestcraft', 'delight'],
  },
  {
    triggers: [
      'storage', 'chest', 'chests', 'backpack', 'backpacks', 'inventory',
      'sorting', 'drawer', 'drawers', 'barrel', 'barrels', 'pouch', 'digital storage', 'organize'
    ],
    category: 'storage',
    searchKeywords: ['sophisticated backpacks', 'refined storage', 'functional storage', 'iron chests', 'toms simple storage'],
  },
  {
    triggers: [
      'shader', 'shaders', 'graphics', 'visual', 'visuals', 'lighting',
      'texture', 'pretty', 'realistic', 'animations', 'particles', 'photorealistic', 'ray tracing'
    ],
    category: 'visual',
    searchKeywords: ['iris', 'oculus', 'effective', 'visuality', 'dynamic lights', 'continuity', 'complementary'],
  },
  {
    triggers: [
      'qol', 'quality of life', 'helper', 'info', 'tooltip', 'gui', 'hud',
      'map', 'minimap', 'waypoint', 'recipes', 'jei', 'nei', 'guide', 'controls', 'crafting table'
    ],
    category: 'utility',
    searchKeywords: ['jei', 'jade', 'xaeros minimap', 'appleskin', 'mouse tweaks', 'clumps', 'journeymap'],
  },
  {
    triggers: [
      'fly', 'flying', 'flight', 'airplane', 'plane', 'glider', 'paraglider',
      'wings', 'elytra', 'jetpack', 'vehicle', 'vehicles', 'car', 'ship', 'boat', 'airship', 'mount'
    ],
    category: 'transportation',
    searchKeywords: ['paragliders', 'simple planes', 'immersive aircraft', 'iron jetpacks', 'small ships'],
  },
  {
    triggers: [
      'gun', 'guns', 'firearm', 'firearms', 'rifle', 'pistol', 'ammo',
      'bullet', 'ammunition', 'cannon', 'combat', 'shield', 'turret', 'shoot', 'shooting'
    ],
    category: 'weapons',
    searchKeywords: ['timeless and classics zero', 'crayfish gun', 'sculk guns', 'vic point blank', 'apotheosis'],
  },
  {
    triggers: [
      'horror', 'scary', 'creepypasta', 'fear', 'sanity', 'spooky',
      'stalker', 'monster', 'darkness', 'hunted', 'nightmare', 'fog', 'creepy', 'man from the fog'
    ],
    category: 'horror',
    searchKeywords: ['from the fog', 'cave dweller', 'the man from the fog', 'weeping angels', 'fear'],
  },
  {
    triggers: [
      'decoration', 'decor', 'furniture', 'building', 'blocks', 'chisel',
      'carpentry', 'windows', 'doors', 'lights', 'roof', 'interior', 'props'
    ],
    category: 'decoration',
    searchKeywords: ['chisel', 'macaws furniture', 'handcrafted', 'cluttered', 'architectury'],
  },
  {
    triggers: [
      'animals', 'creatures', 'wildlife', 'pets', 'dog', 'cat', 'tame',
      'dragons', 'mythical', 'birds', 'aquatic', 'fish', 'fauna'
    ],
    category: 'creatures',
    searchKeywords: ['alexs mobs', 'ice and fire', 'naturalist', 'mythic mounts', 'aquaculture'],
  },
  {
    triggers: [
      'multiplayer', 'voice', 'voice chat', 'proximity', 'friends', 'server',
      'chat', 'emotes', 'coop', 'together'
    ],
    category: 'multiplayer',
    searchKeywords: ['simple voice chat', 'essential', 'audioplayer', 'emotecraft'],
  },
  {
    triggers: [
      'economy', 'shop', 'money', 'trading', 'npc', 'villagers', 'leveling',
      'skills', 'talents', 'experience', 'quests', 'questbook'
    ],
    category: 'economy',
    searchKeywords: ['ftb quests', 'custom npcs', 'easy villagers', 'projecte', 'levelz'],
  },
];

/**
 * Natural Language Query Parser
 * Strips conversational filler and extracts key concepts, categories, and search tokens.
 */
export function parseNLPQuery(rawQuery: string): {
  cleanKeywords: string[];
  matchedCategories: string[];
  targetedQueries: string[];
} {
  const normalized = rawQuery.toLowerCase().trim();

  // Strip conversational filler phrases and stop words
  const stopWords = [
    'i want', 'i need', 'looking for', "i'm looking for", 'can you give me',
    'please give me', 'can you find', 'give me', 'mods that', 'mod that',
    'mods with', 'mod with', 'a mod for', 'mods for', 'something that',
    'something to', 'how to', 'is there a', 'what are some', 'show me',
    'would like', 'best', 'good', 'great', 'cool', 'some', 'any', 'and',
    'with', 'the', 'for', 'from', 'about', 'minecraft', 'mc', 'mods',
    'mod', 'gameplay', 'game', 'like', 'such as', 'into', 'that has',
    'that adds', 'add', 'adds', 'allow', 'allows', 'able to', 'able',
  ];

  let cleaned = normalized;
  for (const sw of stopWords) {
    cleaned = cleaned.replace(new RegExp(`\\b${sw}\\b`, 'gi'), ' ');
  }

  // Tokenize and filter out single or double-letter noise
  const cleanTokens = cleaned
    .split(/[^a-z0-9_-]+/)
    .filter((t) => t.length > 2);

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
      targetedQueries.push(...concept.searchKeywords.slice(0, 3));
    }
  }

  // If no concepts matched, use the cleaned tokens as queries
  if (targetedQueries.length === 0 && cleanTokens.length > 0) {
    targetedQueries.push(cleanTokens.join(' '));
  }

  return {
    cleanKeywords: cleanTokens,
    matchedCategories,
    targetedQueries,
  };
}

/**
 * Background caching of discovered mods into Supabase pgvector table.
 */
async function cacheDiscoveredMods(mods: ModItem[]) {
  if (!supabase || mods.length === 0) return;

  // Run in background without awaiting
  (async () => {
    try {
      const rows = [];
      for (const mod of mods.slice(0, 8)) {
        const cacheKey = `${mod.source}:${mod.externalModId}`;
        let embedding = modEmbeddingCache.get(cacheKey);

        if (!embedding) {
          const text = `${mod.name}: ${mod.summary || ''}`;
          const generated = await generateEmbedding(text);
          if (generated) {
            embedding = generated;
            modEmbeddingCache.set(cacheKey, generated);
          }
        }

        if (embedding) {
          rows.push({
            source: mod.source,
            external_mod_id: mod.externalModId,
            title: mod.name,
            summary: mod.summary || mod.name,
            categories: mod.categories || [],
            loaders: mod.loaders || [],
            game_versions: mod.gameVersions || [],
            icon_url: mod.iconUrl || null,
            embedding,
          });
        }
      }

      if (rows.length > 0) {
        await supabase
          .from('mod_embeddings')
          .upsert(rows, { onConflict: 'source,external_mod_id' });
      }
    } catch {
      // Non-fatal background caching error
    }
  })();
}

/**
 * Core Natural Language Search Function:
 * 1. Computes local query embedding.
 * 2. Checks Supabase pgvector `match_mods` for existing vector embeddings.
 * 3. Expands query via concept matching and retrieves candidates from Modrinth & CurseForge.
 * 4. Neural Semantic Re-ranking: scores candidates using cosine similarity to the natural query.
 * 5. Returns ranked results with semantic relevance percentages.
 */
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

  // 1. Generate local dense vector embedding for the natural language query
  let queryEmbedding: number[] | null = null;
  try {
    queryEmbedding = await generateEmbedding(query);
  } catch (err) {
    console.warn('Query embedding generation failed, using keyword fallback:', err);
  }

  const candidateMap = new Map<string, ModItem>();
  let hasPgVectorResults = false;

  // 2. Vector Semantic Search via Supabase pgvector (match_mods)
  if (supabase && queryEmbedding) {
    try {
      const { data, error } = await supabase.rpc('match_mods', {
        query_embedding: queryEmbedding,
        match_threshold: 0.18,
        match_count: limit,
        filter_loader: loader || null,
        filter_version: gameVersion || null,
      });

      if (!error && data && data.length > 0) {
        hasPgVectorResults = true;
        for (const item of data) {
          const modItem: ModItem = {
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
            similarity: item.similarity ? parseFloat(item.similarity.toFixed(3)) : undefined,
            categories: item.categories || [],
            loaders: item.loaders || [],
            gameVersions: item.game_versions || [],
            dependencies: [],
            votes: { yes: [], no: [] },
            comments: [],
          };
          candidateMap.set(modItem.id, modItem);
        }
      }
    } catch (err) {
      console.warn('pgvector match_mods failed:', err);
    }
  }

  // 3. Multi-angle NLP Query Expansion & Repository Retrieval
  const { cleanKeywords, matchedCategories, targetedQueries } = parseNLPQuery(query);

  const searchPromises: Promise<ModItem[]>[] = [];

  // A) Search individual clean keywords (so Modrinth doesn't fail on long sentences)
  for (const token of cleanKeywords.slice(0, 3)) {
    searchPromises.push(
      searchModrinthMods({
        query: token,
        loader,
        gameVersion,
        limit: 10,
      })
    );
  }

  // B) Two-word phrase search if multiple keywords exist
  if (cleanKeywords.length >= 2) {
    searchPromises.push(
      searchModrinthMods({
        query: cleanKeywords.slice(0, 2).join(' '),
        loader,
        gameVersion,
        limit: 10,
      })
    );
  }

  // C) Targeted AI concept queries
  for (const targeted of targetedQueries.slice(0, 3)) {
    searchPromises.push(
      searchModrinthMods({
        query: targeted,
        loader,
        gameVersion,
        limit: 8,
      })
    );
  }

  // D) Matched Category Facet Search
  if (matchedCategories.length > 0) {
    searchPromises.push(
      searchModrinthMods({
        query: '',
        categories: matchedCategories.slice(0, 2),
        loader,
        gameVersion,
        index: 'downloads',
        limit: 12,
      })
    );
  }

  // E) CurseForge search
  searchPromises.push(
    searchCurseforgeMods({
      query: cleanKeywords.slice(0, 2).join(' ') || query,
      loader,
      gameVersion,
      limit: 10,
    })
  );

  const allResultSets = await Promise.all(searchPromises);
  for (const set of allResultSets) {
    for (const mod of set) {
      if (!candidateMap.has(mod.id)) {
        candidateMap.set(mod.id, mod);
      }
    }
  }

  const allCandidates = Array.from(candidateMap.values());

  // 4. Neural Semantic Re-ranking
  // If we have a query embedding, score candidates by semantic similarity to the query
  if (queryEmbedding && allCandidates.length > 0) {
    const scoredList: Array<{ mod: ModItem; score: number }> = [];

    // Max downloads for normalization
    const maxDownloads = Math.max(...allCandidates.map((m) => m.downloads || 0), 1000);

    for (const mod of allCandidates) {
      let similarity = mod.similarity;

      if (similarity === undefined) {
        const cacheKey = `${mod.source}:${mod.externalModId}`;
        let modEmb = modEmbeddingCache.get(cacheKey);

        if (!modEmb) {
          const modText = `${mod.name}: ${mod.summary || ''}`;
          try {
            const generated = await generateEmbedding(modText);
            if (generated) {
              modEmb = generated;
              modEmbeddingCache.set(cacheKey, generated);
            }
          } catch {
            // Skip embedding on error
          }
        }

        if (modEmb) {
          similarity = Math.max(0, cosineSimilarity(queryEmbedding, modEmb));
          mod.similarity = parseFloat(similarity.toFixed(3));
        } else {
          similarity = 0.1;
        }
      }

      // Download popularity weight (logarithmic scaling)
      const popularityScore = Math.log10(Math.max(mod.downloads || 0, 1) + 1) / Math.log10(maxDownloads + 1);

      // Composite ranking: 70% semantic match + 30% popularity
      const compositeScore = (similarity * 0.70) + (popularityScore * 0.30);
      scoredList.push({ mod, score: compositeScore });
    }

    // Sort descending by composite score
    scoredList.sort((a, b) => b.score - a.score);

    const finalResults = scoredList.slice(0, limit).map((s) => s.mod);

    // Cache discovered mods in background
    cacheDiscoveredMods(finalResults);

    return {
      results: finalResults,
      source: hasPgVectorResults ? 'pgvector' : 'ai-nlp',
    };
  }

  // Fallback sorting by downloads if no embedding is available
  allCandidates.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
  const finalResults = allCandidates.slice(0, limit);

  return {
    results: finalResults,
    source: hasPgVectorResults ? 'pgvector' : 'api-fallback',
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
    candidateQueries.push(...STAPLE_MODS.slice(0, 4));
  } else {
    for (const mod of currentMods) {
      const nameOrSlug = (mod.slug || mod.name).toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const [key, companions] of Object.entries(COMPANION_PAIRS)) {
        if (nameOrSlug.includes(key)) {
          candidateQueries.push(...companions);
        }
      }
    }

    const categoryCounts: Record<string, number> = {};
    for (const mod of currentMods) {
      for (const cat of mod.categories || []) {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      }
    }

    const sortedCats = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat);

    if (sortedCats.length > 0) {
      candidateQueries.push(sortedCats[0]);
    }

    for (const staple of STAPLE_MODS) {
      if (!existingIds.has(staple)) {
        candidateQueries.push(staple);
      }
    }
  }

  const searchTasks = candidateQueries.slice(0, 5).map((q) =>
    searchModrinthMods({
      query: q,
      loader,
      gameVersion,
      index: 'downloads',
      limit: 6,
    })
  );

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

  recommendations.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
  return recommendations.slice(0, 8);
}
