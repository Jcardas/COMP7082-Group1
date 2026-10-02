import axios from 'axios';
import { config } from '../config/index.js';
import { ModItem } from '../types/index.js';

const isCurseForgeConfigured = Boolean(
  config.curseforge.apiKey && !config.curseforge.apiKey.includes('your_curseforge_api_key')
);

const client = axios.create({
  baseURL: config.curseforge.baseUrl,
  headers: {
    'Accept': 'application/json',
    ...(isCurseForgeConfigured ? { 'x-api-key': config.curseforge.apiKey } : {}),
  },
});

const MINECRAFT_GAME_ID = 432;
const MODS_CLASS_ID = 6;

// Curseforge loader type mapping: 1 = Forge, 4 = Fabric, 5 = Quilt, 6 = NeoForge
const LOADER_MAP: Record<string, number> = {
  forge: 1,
  fabric: 4,
  quilt: 5,
  neoforge: 6,
};

export async function searchCurseforgeMods(params: {
  query?: string;
  loader?: string;
  gameVersion?: string;
  limit?: number;
}): Promise<ModItem[]> {
  if (!isCurseForgeConfigured) {
    return [];
  }

  try {
    const queryParams: Record<string, string | number> = {
      gameId: MINECRAFT_GAME_ID,
      classId: MODS_CLASS_ID,
      pageSize: params.limit || 20,
    };

    if (params.query) {
      queryParams.searchFilter = params.query;
    }
    if (params.gameVersion) {
      queryParams.gameVersion = params.gameVersion;
    }
    if (params.loader && LOADER_MAP[params.loader.toLowerCase()]) {
      queryParams.modLoaderType = LOADER_MAP[params.loader.toLowerCase()];
    }

    const response = await client.get('/mods/search', { params: queryParams });
    const data = response.data?.data || [];

    return data.map((mod: any) => ({
      id: `curseforge-${mod.id}`,
      source: 'curseforge',
      externalModId: String(mod.id),
      slug: mod.slug,
      name: mod.name,
      summary: mod.summary || '',
      iconUrl: mod.logo?.thumbnailUrl || mod.logo?.url,
      projectUrl:
        mod.links?.websiteUrl || `https://www.curseforge.com/minecraft/mc-mods/${mod.slug || mod.id}`,
      downloads: mod.downloadCount || 0,
      categories: (mod.categories || []).map((c: any) => c.name),
      loaders: (mod.latestFilesIndexes || [])
        .map((f: any) => (f.modLoader === 1 ? 'forge' : f.modLoader === 4 ? 'fabric' : 'other'))
        .filter(Boolean),
      gameVersions: (mod.latestFilesIndexes || []).map((f: any) => f.gameVersion).filter(Boolean),
      dependencies: [],
      votes: { yes: [], no: [] },
      comments: [],
    }));
  } catch (error) {
    console.error('Failed to search CurseForge mods:', error);
    return [];
  }
}

export async function getCurseforgeMod(modId: number | string) {
  if (!isCurseForgeConfigured) return null;
  try {
    const response = await client.get(`/mods/${modId}`);
    return response.data?.data || null;
  } catch (error) {
    console.error(`Failed to fetch CurseForge mod ${modId}:`, error);
    return null;
  }
}
