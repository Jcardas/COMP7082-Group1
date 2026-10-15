import { generateEmbedding } from '../lib/huggingface.js';
import { supabase } from '../lib/supabase.js';
import { searchModrinthMods } from './modrinth.js';

/**
 * Background seeder that populates Supabase's `mod_embeddings` table with
 * popular Minecraft mods across different gameplay categories.
 * This ensures vector semantic search (match_mods) has a rich database to query immediately.
 */
export async function seedPopularModEmbeddings(): Promise<void> {
  if (!supabase) {
    return;
  }

  try {
    const { count, error } = await supabase
      .from('mod_embeddings')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.warn('⚠️ [Mod Seeder] Unable to check mod_embeddings count:', error.message);
      return;
    }

    // If we already have at least 50 mods indexed, skip heavy initial seeding
    if (typeof count === 'number' && count >= 50) {
      console.log(`📦 [Mod Seeder] mod_embeddings table already has ${count} mods indexed.`);
      return;
    }

    console.log('🌱 [Mod Seeder] Seeding popular mods into Supabase pgvector database...');

    // Fetch popular mods across core categories
    const categoriesToSeed = [
      '', // top overall
      'technology',
      'magic',
      'adventure',
      'optimization',
      'worldgen',
      'storage',
      'food',
      'decoration',
      'utility',
    ];

    const allModsMap = new Map<string, any>();

    for (const cat of categoriesToSeed) {
      try {
        const mods = await searchModrinthMods({
          query: '',
          categories: cat ? [cat] : undefined,
          index: 'downloads',
          limit: 12,
        });

        for (const m of mods) {
          if (!allModsMap.has(m.externalModId)) {
            allModsMap.set(m.externalModId, m);
          }
        }
      } catch {
        // Continue with other categories if one fails
      }
    }

    const candidateMods = Array.from(allModsMap.values());
    console.log(`🌱 [Mod Seeder] Found ${candidateMods.length} unique popular mods to index.`);

    let indexedCount = 0;
    const batchSize = 8;

    for (let i = 0; i < candidateMods.length; i += batchSize) {
      const batch = candidateMods.slice(i, i + batchSize);
      const rows = [];

      for (const mod of batch) {
        try {
          const textToEmbed = `${mod.name}: ${mod.summary || ''}`;
          const embedding = await generateEmbedding(textToEmbed);

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
        } catch (err) {
          console.warn(`[Mod Seeder] Failed to embed ${mod.name}:`, err);
        }
      }

      if (rows.length > 0) {
        const { error: upsertErr } = await supabase
          .from('mod_embeddings')
          .upsert(rows, { onConflict: 'source,external_mod_id' });

        if (!upsertErr) {
          indexedCount += rows.length;
        } else {
          console.warn('[Mod Seeder] Batch upsert error:', upsertErr.message);
        }
      }
    }

    console.log(`✅ [Mod Seeder] Successfully indexed ${indexedCount} mods with pgvector embeddings!`);
  } catch (error) {
    console.error('❌ [Mod Seeder] Unexpected error during seeding:', error);
  }
}
