// Wrapper for the curseforge api
//
// Curseforge api is a little annoying because
// they use integers for types
// For example: (1 = Forge, 4 = Fabric,
// 5 = Quilt, 6 = NeoForge)
//
// This wrapper is used to translate
// curseforge api payloads into ModItems for
// use in the application.
//
// Reviewed by Justin C

import axios from 'axios';
import { config } from '../config/index.js';
import { ModItem } from '../types/consts.js';

// Check if the api key is configured.
const isCurseForgeConfigured = Boolean(
  config.curseforge.apiKey && !config.curseforge.apiKey.includes('your_curseforge_api_key')
);

// instantiates a pre-configured Axios HTTP
// client specifically tailored for sending
// requests to the CurseForge API.
// Also appends the api key for authentication
// with curseforge. (Private API)
const client = axios.create({
  baseURL: config.curseforge.baseUrl,
  headers: {
    'Accept': 'application/json',
    ...(isCurseForgeConfigured ? { 'x-api-key': config.curseforge.apiKey } : {}),
  },
});

// Curseforge has more than just minecraft mods
// Specify the game id (Minecraft is 432)
const MINECRAFT_GAME_ID = 432;

// Specifies that we are querying mods, not
// resourcepacks or modpacks etc. (mods: 6)
const MODS_CLASS_ID = 6;

// Curseforge loader type mapping: 1 = Forge, 4 = Fabric, 5 = Quilt, 6 = NeoForge
const LOADER_MAP: Record<string, number> = {
  forge: 1,
  fabric: 4,
  quilt: 5,
  neoforge: 6,
};

/**
 *
 * @param params
 *
 * ```Query``` is a string that will be used to search for mods.
 *
 * ```Loader``` is a string that will be used to filter mods by loader type.
 *
 * ```GameVersion``` is a string that will be used to filter mods by game version.
 *
 * ```Categories``` is an array of strings that will be used to filter mods by category.
 *
 * ```Index``` is a number that will be used to sort the results. Default is 6 (TotalDownloads).
 *
 *   Index can be:
 * - 1 Featured
 * - 2=Popularity
 * - 3=LastUpdated
 * - 4=Name
 * - 5=Author
 * - 6=TotalDownloads
 * - 7=Category
 * - 8=GameVersion
 * - 9=EarlyAccess
 * - 10=FeaturedReleased
 * - 11=ReleasedDate
 * - 12=Rating
 *
 * ```Limit``` is a number that limits the number of results returned.
 * @returns
 */
export async function searchCurseforgeMods(params: {
  query?: string;
  loader?: string;
  gameVersion?: string;
  categories?: string[];

  index?: number; // Numerical value representing the type of sorting to use.
  limit?: number;
}): Promise<ModItem[]> {
  if (!isCurseForgeConfigured) {
    return [];
  }
  try {
    // Construct the query parameter object expected by the CurseForge v1 Search API.
    // MINECRAFT_GAME_ID (432) scopes queries specifically to Minecraft.
    // MODS_CLASS_ID (6) ensures the API returns mods rather than modpacks, resource packs, or worlds.
    const queryParams: Record<string, string | number> = {
      gameId: MINECRAFT_GAME_ID,
      classId: MODS_CLASS_ID,
      pageSize: params.limit || 20, // Default to 20 results if no limit is provided
    };

    // Apply text search filter against mod title and description
    if (params.query) {
      queryParams.searchFilter = params.query;
    }

    // Filter by specific Minecraft version release (e.g., '1.20.1', '1.21.1')
    if (params.gameVersion) {
      queryParams.gameVersion = params.gameVersion;
    }

    // Map human-readable loader strings (e.g. 'forge', 'fabric') to CurseForge's internal ModLoaderType enum
    if (params.loader && LOADER_MAP[params.loader.toLowerCase()]) {
      queryParams.modLoaderType = LOADER_MAP[params.loader.toLowerCase()];
    }

    // Note: CurseForge uses `sortField` for sorting criteria and `index` for pagination offsets.
    // Binding params.index here directs pagination or sort routing to the upstream request.
    if (params.index) {
      queryParams.pageIndex = params.index;
    }

    // Execute GET request to https://api.curseforge.com/v1/mods/search
    // Axios serializes queryParams into the URL query string (?gameId=432&classId=6...)
    const response = await client.get('/mods/search', {
      params: queryParams
    });

    // CurseForge wraps the result payload in a top-level `data` array
    const data = response.data?.data || [];

    // Normalize raw CurseForge API entities into the unified internal `ModItem` interface
    // used across the app (shared between Modrinth and CurseForge sources).
    return data.map((mod: any) => ({
      // Prefix ID with source platform to guarantee uniqueness across repositories
      id: `curseforge-${mod.id}`,
      source: 'curseforge',
      externalModId: String(mod.id), // Store native numeric ID as string for consistent lookups
      slug: mod.slug,
      name: mod.name,
      summary: mod.summary || '',
      // Fall back to primary logo if thumbnail is omitted
      iconUrl: mod.logo?.thumbnailUrl || mod.logo?.url,
      // Fallback web URL routing if websiteUrl is missing from upstream metadata
      projectUrl:
        mod.links?.websiteUrl || `https://www.curseforge.com/minecraft/mc-mods/${mod.slug || mod.id}`,
      downloads: mod.downloadCount || 0,
      // Flatten the categories array into a clean string array of category names
      categories: (mod.categories || []).map((c: any) => c.name),
      // Inspect latestFilesIndexes to extract compatible mod loaders:
      // ModLoaderType enum mapping: 1 = Forge, 4 = Fabric, 6 = NeoForge
      loaders: (mod.latestFilesIndexes || [])
        .map((f: any) => (f.modLoader === 1 ? 'forge' : f.modLoader === 4 ? 'fabric' : 'other'))
        .filter(Boolean),
      // Collect unique supported Minecraft versions from indexed file metadata
      gameVersions: (mod.latestFilesIndexes || []).map((f: any) => f.gameVersion).filter(Boolean),
      // Initialize empty default application state for collaborative features
      dependencies: [],
      votes: { yes: [], no: [] },
      comments: [],
    }));
  } catch (error) {
    // Log failures without crashing the route, returning an empty list for resilient UI fallback
    console.error('Failed to search CurseForge mods:', error);
    return [];
  }
}

export async function getCurseforgeMod(modId: number | string) {
  // Abort early if CurseForge credentials are not set
  if (!isCurseForgeConfigured) return null;

  try {
    // Fetch individual mod details from https://api.curseforge.com/v1/mods/{modId}
    const response = await client.get(`/mods/${modId}`);

    // Return the unpacked mod object or null if not found
    return response.data?.data || null;
  } catch (error) {
    // Log the specific mod ID that failed to resolve (e.g., deleted mod, 404, or rate limit)
    console.error(`Failed to fetch CurseForge mod ${modId}:`, error);
    return null;
  }
}
