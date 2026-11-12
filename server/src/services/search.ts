import { generateEmbedding } from '../lib/huggingface.js';
import { supabase } from '../lib/supabase.js';
import { ModDependency, ModItem } from '../types/consts.js';
import { searchCurseforgeMods } from './curseforge.js';
import { getModrinthProject, getModrinthProjectVersions, searchModrinthMods } from './modrinth.js';

export interface NLPSearchParams {
  query: string;
  loader?: string;
  gameVersion?: string;
  category?: string;
  source?: 'both' | 'modrinth' | 'curseforge';
  page?: number;
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

  const cleanTokens = cleaned
    .split(/[^a-z0-9_-]+/)
    .filter((t) => t.length > 1);

  const matchedCategories: string[] = [];
  const targetedQueries: string[] = [];

  for (const concept of CONCEPT_MAPPINGS) {
    const isTriggered = concept.triggers.some((trigger) => {
      const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`, 'i').test(normalized);
    });

    if (isTriggered) {
      if (!matchedCategories.includes(concept.category)) {
        matchedCategories.push(concept.category);
      }
      targetedQueries.push(...concept.searchKeywords.slice(0, 3));
    }
  }

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
 * Computes a normalized [0, 1] name-matching score between a mod's title/slug and the user query.
 */
export function computeNameMatchScore(
  modName: string,
  modSlug: string | undefined,
  rawQuery: string,
  cleanKeywords: string[]
): number {
  const nameLower = (modName || '').toLowerCase().trim();
  const slugLower = (modSlug || '').toLowerCase().trim();
  const qLower = (rawQuery || '').toLowerCase().trim();
  const cleanQ = cleanKeywords.join(' ').trim().toLowerCase();

  if (!nameLower || (!qLower && !cleanQ)) return 0;

  const normName = nameLower.replace(/[^a-z0-9]/g, '');
  const normSlug = slugLower.replace(/[^a-z0-9]/g, '');
  const normQ = (cleanQ || qLower).replace(/[^a-z0-9]/g, '');
  const normRawQ = qLower.replace(/[^a-z0-9]/g, '');

  // 1. Exact name or slug match
  if (
    nameLower === qLower ||
    (cleanQ && nameLower === cleanQ) ||
    slugLower === qLower ||
    (cleanQ && slugLower === cleanQ) ||
    (normQ && (normName === normQ || normSlug === normQ)) ||
    (normRawQ && (normName === normRawQ || normSlug === normRawQ))
  ) {
    return 1.0;
  }

  // 2. Prefix match
  if (
    nameLower.startsWith(qLower) ||
    (cleanQ && nameLower.startsWith(cleanQ)) ||
    (normQ && normName.startsWith(normQ))
  ) {
    return 0.85;
  }

  // 3. Full phrase substring match in title
  if (
    nameLower.includes(qLower) ||
    (cleanQ && nameLower.includes(cleanQ)) ||
    (normQ.length >= 3 && normName.includes(normQ))
  ) {
    return 0.72;
  }

  // 4. Token-level overlap in name or slug
  const tokens =
    cleanKeywords.length > 0
      ? cleanKeywords
      : qLower.split(/[^a-z0-9_-]+/).filter((t) => t.length > 1);

  if (tokens.length === 0) return 0;

  let matchedCount = 0;
  for (const token of tokens) {
    if (nameLower.includes(token) || slugLower.includes(token)) {
      matchedCount++;
    }
  }

  return (matchedCount / tokens.length) * 0.6;
}

/**
 * Ranks mod candidates heavily weighted toward name matching and download popularity,
 * while still factoring in semantic similarity for conversational queries.
 */
export function rankSearchCandidates(
  candidates: Array<{ mod: ModItem; similarity: number }>,
  rawQuery: string,
  cleanKeywords: string[],
  useEmbeddings: boolean
): ModItem[] {
  if (candidates.length === 0) return [];

  const maxDownloads = Math.max(...candidates.map((c) => c.mod.downloads || 0), 1000);
  const denom = Math.log10(maxDownloads + 1);

  const scored = candidates.map(({ mod, similarity }) => {
    const dl = Math.max(mod.downloads || 0, 0);
    const nameScore = computeNameMatchScore(mod.name, mod.slug, rawQuery, cleanKeywords);
    const logPop = Math.log10(dl + 1) / denom;
    const sqrtPop = Math.sqrt(dl / maxDownloads);
    const popularityScore = logPop * 0.7 + sqrtPop * 0.3;

    const summaryLower = (mod.summary || '').toLowerCase();
    const tokens = cleanKeywords.length > 0 ? cleanKeywords : rawQuery.toLowerCase().split(/\s+/).filter(Boolean);
    const summaryHits = tokens.filter((t) => t.length > 1 && summaryLower.includes(t)).length;
    const summaryBonus = tokens.length > 0 ? (summaryHits / tokens.length) * 0.02 : 0;

    const score = useEmbeddings
      ? nameScore * 0.48 + popularityScore * 0.38 + similarity * 0.12 + summaryBonus
      : nameScore * 0.56 + popularityScore * 0.42 + summaryBonus;

    return { mod, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.mod);
}

/**
 * Background caching of discovered mods into Supabase pgvector table.
 */
async function cacheDiscoveredMods(mods: ModItem[]) {
  if (!supabase || mods.length === 0) return;

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
            downloads: mod.downloads || 0,
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
 * Core Natural Language Search Function with Category, Source Filter, and Pagination.
 */
export async function searchModsWithNLP(params: NLPSearchParams): Promise<{
  results: ModItem[];
  source: 'pgvector' | 'ai-nlp' | 'api-fallback';
  total: number;
  page: number;
  pageSize: number;
}> {
  const {
    query,
    loader,
    gameVersion,
    category,
    source = 'both',
    page = 1,
    limit = 10,
  } = params;

  const includeModrinth = source === 'both' || source === 'modrinth';
  const includeCurseforge = source === 'both' || source === 'curseforge';
  const activeCategories =
    category && category !== 'all' ? [category.toLowerCase()] : undefined;

  if (!query || !query.trim()) {
    const tasks: Promise<ModItem[]>[] = [];
    if (includeModrinth) {
      tasks.push(
        searchModrinthMods({
          query: activeCategories ? activeCategories[0] : '',
          categories: activeCategories,
          loader,
          gameVersion,
          index: 'downloads',
          limit: 30,
        })
      );
    }
    if (includeCurseforge) {
      tasks.push(
        searchCurseforgeMods({
          query: activeCategories ? activeCategories[0] : '',
          loader,
          gameVersion,
          limit: 30,
        })
      );
    }

    const sets = await Promise.all(tasks);
    const merged: ModItem[] = [];
    const seen = new Set<string>();
    for (const s of sets) {
      for (const m of s) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          merged.push(m);
        }
      }
    }

    merged.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
    const start = (Math.max(1, page) - 1) * limit;
    return {
      results: merged.slice(start, start + limit),
      source: 'api-fallback',
      total: merged.length,
      page: Math.max(1, page),
      pageSize: limit,
    };
  }

  let queryEmbedding: number[] | null = null;
  try {
    queryEmbedding = await generateEmbedding(query);
  } catch (err) {
    console.warn('Query embedding generation failed, using keyword fallback:', err);
  }

  const candidateMap = new Map<string, ModItem>();
  let hasPgVectorResults = false;

  if (supabase && queryEmbedding) {
    try {
      const { data, error } = await supabase.rpc('match_mods', {
        query_embedding: queryEmbedding,
        match_threshold: 0.18,
        match_count: 40,
        filter_loader: loader || null,
        filter_version: gameVersion || null,
      });

      if (!error && data && data.length > 0) {
        hasPgVectorResults = true;
        for (const item of data) {
          if (item.source === 'modrinth' && !includeModrinth) continue;
          if (item.source === 'curseforge' && !includeCurseforge) continue;
          const rawSim = item.semantic_similarity ?? item.similarity;
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
            downloads: Number(item.downloads) || 0,
            similarity: rawSim !== undefined ? parseFloat(Number(rawSim).toFixed(3)) : undefined,
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

  const { cleanKeywords, matchedCategories, targetedQueries } = parseNLPQuery(query);
  const searchPromises: Promise<ModItem[]>[] = [];
  const primaryQuery = cleanKeywords.join(' ') || query.trim();

  if (includeModrinth) {
    // Direct relevance + popularity searches for the full cleaned query
    searchPromises.push(
      searchModrinthMods({
        query: primaryQuery,
        categories: activeCategories,
        loader,
        gameVersion,
        index: 'relevance',
        limit: 20,
      })
    );
    searchPromises.push(
      searchModrinthMods({
        query: primaryQuery,
        categories: activeCategories,
        loader,
        gameVersion,
        index: 'downloads',
        limit: 20,
      })
    );

    for (const token of cleanKeywords.slice(0, 3)) {
      if (token === primaryQuery) continue;
      searchPromises.push(
        searchModrinthMods({
          query: token,
          categories: activeCategories,
          loader,
          gameVersion,
          index: 'downloads',
          limit: 12,
        })
      );
    }

    for (const targeted of targetedQueries.slice(0, 3)) {
      if (targeted === primaryQuery) continue;
      searchPromises.push(
        searchModrinthMods({
          query: targeted,
          categories: activeCategories,
          loader,
          gameVersion,
          index: 'downloads',
          limit: 10,
        })
      );
    }

    const catsToUse =
      activeCategories || (matchedCategories.length > 0 ? matchedCategories.slice(0, 2) : undefined);
    if (catsToUse) {
      searchPromises.push(
        searchModrinthMods({
          query: '',
          categories: catsToUse,
          loader,
          gameVersion,
          index: 'downloads',
          limit: 15,
        })
      );
    }
  }

  if (includeCurseforge) {
    searchPromises.push(
      searchCurseforgeMods({
        query: primaryQuery,
        loader,
        gameVersion,
        limit: 20,
      })
    );
  }

  const allResultSets = await Promise.all(searchPromises);
  for (const set of allResultSets) {
    for (const mod of set) {
      const existing = candidateMap.get(mod.id);
      if (!existing) {
        candidateMap.set(mod.id, mod);
      } else {
        candidateMap.set(mod.id, {
          ...existing,
          slug: mod.slug || existing.slug,
          iconUrl: mod.iconUrl || existing.iconUrl,
          projectUrl: mod.projectUrl || existing.projectUrl,
          downloads: Math.max(existing.downloads || 0, mod.downloads || 0),
          loaders: mod.loaders?.length ? mod.loaders : existing.loaders,
          gameVersions: mod.gameVersions?.length ? mod.gameVersions : existing.gameVersions,
        });
      }
    }
  }

  let allCandidates = Array.from(candidateMap.values());
  if (activeCategories && activeCategories.length > 0) {
    const filtered = allCandidates.filter((m) =>
      (m.categories || []).some((c) => c.toLowerCase().includes(activeCategories[0]))
    );
    if (filtered.length > 0) {
      allCandidates = filtered;
    }
  }

  const start = (Math.max(1, page) - 1) * limit;

  if (queryEmbedding && allCandidates.length > 0) {
    const prepared: Array<{ mod: ModItem; similarity: number }> = [];

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

      prepared.push({ mod, similarity });
    }

    const rankedAll = rankSearchCandidates(prepared, query, cleanKeywords, true);
    cacheDiscoveredMods(rankedAll.slice(0, 10));

    return {
      results: rankedAll.slice(start, start + limit),
      source: hasPgVectorResults ? 'pgvector' : 'ai-nlp',
      total: rankedAll.length,
      page: Math.max(1, page),
      pageSize: limit,
    };
  }

  const rankedFallback = rankSearchCandidates(
    allCandidates.map((mod) => ({ mod, similarity: 0 })),
    query,
    cleanKeywords,
    false
  );

  return {
    results: rankedFallback.slice(start, start + limit),
    source: hasPgVectorResults ? 'pgvector' : 'api-fallback',
    total: rankedFallback.length,
    page: Math.max(1, page),
    pageSize: limit,
  };
}

/**
 * Resolves required dependencies for a given ModItem so they can be automatically installed.
 */
export async function resolveRequiredDependenciesForMod(
  mod: ModItem,
  loader?: string,
  gameVersion?: string
): Promise<ModItem[]> {
  const requiredMods: ModItem[] = [];

  try {
    if (mod.source === 'modrinth') {
      const versions = await getModrinthProjectVersions(mod.externalModId, loader, gameVersion);
      const latestVersion = Array.isArray(versions) && versions.length > 0 ? versions[0] : null;
      const deps: Array<{ project_id?: string | null; dependency_type?: string }> =
        latestVersion?.dependencies || [];

      const requiredProjectIds = Array.from(
        new Set(
          deps
            .filter((d) => d.dependency_type === 'required' && d.project_id)
            .map((d) => String(d.project_id))
        )
      );

      for (const projId of requiredProjectIds.slice(0, 5)) {
        const project = await getModrinthProject(projId);
        if (project) {
          const depMod: ModItem = {
            id: `modrinth-${project.id}`,
            source: 'modrinth',
            externalModId: project.id,
            slug: project.slug,
            name: project.title || project.slug || projId,
            summary: project.description || 'Required dependency library',
            iconUrl: project.icon_url,
            projectUrl: `https://modrinth.com/mod/${project.slug || project.id}`,
            downloads: project.downloads || 0,
            categories: project.categories || ['library'],
            loaders: project.loaders || (loader ? [loader] : []),
            gameVersions: project.game_versions || (gameVersion ? [gameVersion] : []),
            dependencies: [],
            votes: { yes: [], no: [] },
            comments: [],
          };
          requiredMods.push(depMod);
        }
      }
    }
  } catch (err) {
    console.warn('Could not resolve external dependencies for mod:', err);
  }

  // Also check any inline ModDependency items marked as 'required'
  if (requiredMods.length === 0 && Array.isArray(mod.dependencies)) {
    for (const dep of mod.dependencies as ModDependency[]) {
      if (dep.dependencyType === 'required') {
        requiredMods.push({
          id: `${dep.source}-${dep.id}`,
          source: dep.source,
          externalModId: dep.id,
          name: dep.name || dep.id,
          summary: `Required dependency for ${mod.name}`,
          categories: ['library'],
          loaders: loader ? [loader] : mod.loaders || [],
          gameVersions: gameVersion ? [gameVersion] : mod.gameVersions || [],
          dependencies: [],
          votes: { yes: [], no: [] },
          comments: [],
        });
      }
    }
  }

  return requiredMods;
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
    currentMods
      .map((m) => m.externalModId.toLowerCase())
      .concat(currentMods.map((m) => (m.slug || '').toLowerCase()))
  );

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

  const COMPANION_PAIRS: Record<string, string[]> = {
    create: [
      'create-steam-and-rails',
      'create-crafts-and-additions',
      'create-enchantment-industry',
      'flywheel',
      'jei',
    ],
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
