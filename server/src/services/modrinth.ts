// Wrapper for the modrinth api
//
// Unlike CurseForge, Modrinth uses native string
// identifiers for loaders and categories
// For example: ('forge', 'fabric', 'quilt', 'neoforge')
//
// Modrinth uses a 2D facet array for filtering:
// inner arrays represent OR groups, and outer arrays
// represent AND groups.
//
// This wrapper is used to translate
// modrinth api payloads into ModItems for
// use in the application.
//
// Reviewed by Justin C

import axios from 'axios';
import { config } from '../config/index.js';
import { ModItem } from '../types/consts.js';
import {
  ModrinthVersion,
  ModrinthVersionDependency,
  ModrinthBatchProject,
  ModDependency,
  ModDependenciesResponse,
} from '../types/index.js';

// Instantiates a pre-configured Axios HTTP
// client specifically tailored for sending
// requests to the Modrinth v2 API.
// Modrinth requires a descriptive User-Agent header;
// optional Bearer token attached for elevated rate limits.
const client = axios.create({
  baseURL: config.modrinth.baseUrl,
  headers: {
    'User-Agent': config.modrinth.userAgent,
    ...(config.modrinth.token ? { Authorization: config.modrinth.token } : {}),
  },
});

/**
 * In-memory cache to prevent redundant API calls
 * and protect against rate limits
 */
class MemoryCache<T> {
  private cache = new Map<string, { value: T; expiresAt: number }>();
  // Time-to-live acts as a safeguard against stale data; an expiration timestamp
  private readonly defaultTtl: number; // Time-to-live in ms

  constructor(ttlMins = 15) {
    this.defaultTtl = ttlMins * 60 * 1000;
  }

  // Simple get to retrieve cached values
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  // Simple set to store values and assign an expiration timestamp
  set(key: string, value: T, ttlMs?: number): void {
    // The `?? ` operator ensures that if ttlMs is undefined, default is used
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtl);
    this.cache.set(key, { value, expiresAt });
  }

  // Simple method to check if a key exists in the cache
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }
}

// Caches for project titles and dependency sets
const projectCache = new MemoryCache<ModrinthBatchProject>(30); // 30 minute TTL limit
const dependencyCache = new MemoryCache<ModDependenciesResponse>(30);

// TypeScript interface defining the raw JSON shape
// returned by the Modrinth /search endpoint
interface ModrinthSearchResult {
  hits: Array<{
    project_id: string;
    slug: string;
    title: string;
    description: string;
    categories: string[];
    loaders: string[];
    versions: string[];
    icon_url?: string;
    downloads: number;
    follows: number;
  }>;
  total_hits: number;
}

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
 * ```Index``` is a string that will be used to sort the results. Default is 'relevance'.
 *
 *   Index can be:
 * - relevance (default search order, based on how well the project matches the query)
 * - downloads (number of times the project has been downloaded)
 * - follows (number of users following the project)
 * - newest (recently created projects)
 * - updated (recently updated projects)
 *
 * ```Limit``` is a number that limits the number of results returned.
 * @returns
 */
export async function searchModrinthMods(params: {
  query?: string;
  loader?: string;
  gameVersion?: string;
  categories?: string[];
  index?: 'relevance' | 'downloads' | 'follows' | 'newest';
  limit?: number;
}): Promise<ModItem[]> {
  try {
    // Construct the 2D facet array expected by Modrinth search API:
    // Outer array elements are ANDed together; inner array elements are ORed together.
    // Base facet restricts results strictly to mods (excluding modpacks, resource packs, and shaders).
    const facets: string[][] = [['project_type:mod']];

    // Filter by mod loader (e.g., 'forge', 'fabric', 'neoforge')
    if (params.loader) {
      facets.push([`categories:${params.loader.toLowerCase()}`]);
    }

    // Filter by specific Minecraft version release (e.g., '1.20.1', '1.21.1')
    if (params.gameVersion) {
      facets.push([`versions:${params.gameVersion}`]);
    }

    // Filter by mod categories formatted as an OR group
    if (params.categories && params.categories.length > 0) {
      facets.push(params.categories.map((c) => `categories:${c.toLowerCase()}`));
    }

    // Construct the query parameter object expected by the Modrinth API.
    // Facets must be passed as a serialized JSON string.
    const queryParams: Record<string, string | number> = {
      query: params.query || '',
      facets: JSON.stringify(facets),
      limit: params.limit || 20, // Default to 20 results if no limit is provided
    };

    // Apply custom sort order if specified (e.g., 'downloads', 'relevance')
    if (params.index) {
      queryParams.index = params.index;
    }

    // Execute GET request to https://api.modrinth.com/v2/search
    // Axios serializes queryParams into the URL query string (?query=...&facets=...&limit=20)
    const response = await client.get<ModrinthSearchResult>('/search', {
      params: queryParams,
    });

    // Modrinth wraps search hits in the `hits` array
    const hits = response.data?.hits || [];

    // Normalize raw Modrinth API entities into the unified internal `ModItem` interface
    // used across the app (shared between Modrinth and CurseForge sources).
    return hits.map((hit) => ({
      // Prefix ID with source platform to guarantee uniqueness across repositories
      id: `modrinth-${hit.project_id}`,
      source: 'modrinth',
      externalModId: hit.project_id, // Base64-like alphanumeric project hash
      slug: hit.slug,
      name: hit.title,
      summary: hit.description || '',
      iconUrl: hit.icon_url,
      // Canonical web link resolving to the mod's public page
      projectUrl: hit.slug
        ? `https://modrinth.com/mod/${hit.slug}`
        : `https://modrinth.com/mod/${hit.project_id}`,
      downloads: hit.downloads || 0,
      categories: hit.categories || [],
      loaders: hit.loaders || [],
      gameVersions: hit.versions || [],
      // Initialize empty default application state for collaborative features
      dependencies: [],
      votes: { yes: [], no: [] },
      comments: [],
    }));
  } catch (error) {
    // Log failures without crashing the route, returning an empty list for resilient UI fallback
    console.error('Failed to search Modrinth mods:', error);
    return [];
  }
}

/**
 *
 * @param idOrSlug Base64 project ID or URL slug string
 * @returns Modrinth project object or null if not found
 */
export async function getModrinthProject(idOrSlug: string) {
  try {
    // Check the cache first to avoid redundant calls
    const cached  = projectCache.get(idOrSlug);
    if (cached) return cached;

    // Fetch individual mod metadata from https://api.modrinth.com/v2/project/{id|slug}
    const response = await client.get(`/project/${idOrSlug}`);
    // Cache the result
    if (response.data) {
      projectCache.set(idOrSlug, response.data);
      if (response.data.id) projectCache.set(response.data.id, response.data); // Cache by ID as well
      if (response.data.slug) projectCache.set(response.data.slug, response.data); // Cache by slug as well
    }

    // Return the unpacked project object
    return response.data || null;
  } catch (error) {
    // Log the specific mod ID/slug that failed to resolve (e.g., 404, private project, or rate limit)
    console.error(`Failed to fetch Modrinth project ${idOrSlug}:`, error);
    return null;
  }
}

/**
 * Fetches project details in bulk using the /projects?ids=[...] endpoint
 * Greatly reduces HTTP round trips when resolving names for dependencies
 * 
 * @param ids
 * @returns A map of ModrinthBatchProject objects keyed by project ID
 */
export async function getModrinthProjectsBatch(ids: string[]): Promise<Map<string, ModrinthBatchProject>> {
  const result = new Map<string, ModrinthBatchProject>();
  if (!ids || ids.length === 0) return result;

  // Filter out IDs already held in cache
  const missingIds: string[] = [];
  for (const id of ids) {
    const cached = projectCache.get(id);
    if (cached) {
      result.set(id, cached);
      result.set(cached.id, cached);
    } else {
      missingIds.push(id);
    }
  }

  if (missingIds.length === 0) {
    return result;
  }

  try {
    // Modrinth allows querying multiple project IDs: /projects?ids=["id1","id2"]
    const response = await client.get<ModrinthBatchProject[]>('/projects', {
      params: {
        ids: JSON.stringify(missingIds),
      },
    });

    const projects = response.data || [];
    for (const project of projects) {
      // Cache both by id and by slug
      projectCache.set(project.id, project);
      projectCache.set(project.slug, project);
      result.set(project.id, project);
    }
  } catch (error) {
    console.error('Failed to batch fetch Modrinth projects:', error);
  }

  return result;
}

/**
 * Fetch versions for a given mod project filtered optionally by loader and Minecraft version.
 * @param projectId Project ID or slug to look up file versions for
 * @param loader Optional loader filter (e.g. 'forge', 'fabric')
 * @param gameVersion Optional Minecraft version filter (e.g. '1.20.1')
 * @returns Array of version objects containing download URLs, files, and dependencies
 */
export async function getModrinthProjectVersions(projectId: string, loader?: string, gameVersion?: string): Promise<ModrinthVersion[]> {
  try {
    // Build query filters for loader and game version compatibility.
    // Modrinth expects loader and game_versions query params to be JSON stringified arrays.
    const params: Record<string, string> = {};
    if (loader) params.loaders = JSON.stringify([loader.toLowerCase()]);
    if (gameVersion) params.game_versions = JSON.stringify([gameVersion]);

    // Fetch releases from https://api.modrinth.com/v2/project/{id}/version
    const response = await client.get(`/project/${projectId}/version`, { params });

    // Return the unpacked version list
    return response.data || [];
  } catch (error) {
    // Log the failure without interrupting the parent resolver flow
    console.error(`Failed to fetch Modrinth versions for ${projectId}:`, error);
    return [];
  }
}

/**
 * Query project versions, identify most compatible release, extract
 * dependencies, and resolve them to human-readable names
 * 
 * @param projectID Project Id or slug for mod
 * @param loader Target mod loader
 * @param gameVersion Target Minecraft version
 */
export async function fetchModDependencies(projectId: string, loader?: string, gameVersion?: string) : Promise<ModDependenciesResponse> {
  const cacheKey = `${projectId}:${loader || '*'}:${gameVersion || '*'}`;
  // Check if cached
  const cached = dependencyCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // 1. Fetch available versions for this project
  // Prefer release over beta/alpha, newest version
  const versions = await getModrinthProjectVersions(projectId, loader, gameVersion);

  if(!versions || versions.length === 0) {
    const emptyResult: ModDependenciesResponse = {
      projectId,
      loader,
      gameVersion,
      resolvedVersion: null,
      dependencies: [],
    };
    dependencyCache.set(cacheKey, emptyResult);
    return emptyResult;
  }

  // 2. Select the most relevant version
  const sortedVersions: ModrinthVersion[] = [...versions].sort(
    (a: ModrinthVersion, b: ModrinthVersion) => {
      const typePriority: Record<string, number> = { release: 3, beta: 2, alpha: 1};
      const priorityDiff = (typePriority[b.version_type] || 0) - (typePriority[a.version_type] || 0);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.date_published).getTime() - new Date(a.date_published).getTime();
    }
  );

  const selectedVersion: ModrinthVersion = sortedVersions[0];
  const declaredDeps: ModrinthVersionDependency[] = selectedVersion.dependencies || [];

  // Filter out embedded libraries or entries with no project ID
  const validProjectIds: string[] = declaredDeps
    .map((dep: ModrinthVersionDependency) => dep.project_id)
    .filter((id: string | null): id is string => typeof id === 'string' && id.trim().length > 0);
  
  const targetProjectIds: string[] = Array.from(new Set<string>(validProjectIds));

  const projectMap = await getModrinthProjectsBatch(targetProjectIds);

  // 4. Transform into standardized ModDependency shape
  const resolvedDependencies: ModDependency[] = declaredDeps
    .filter((dep: ModrinthVersionDependency) => Boolean(dep.project_id)) // project ID to reference
    .map((dep: ModrinthVersionDependency): ModDependency => {
      // Safe non-null asseriton
      const projId = dep.project_id as string;
      const meta = projectMap.get(projId);

      // Fall back to project ID or file name
      const slug = meta?.slug || projId;
      const name = meta?.title || dep.file_name || slug;

      return {
        projectId: projId,
        name,
        slug,
        type: dep.dependency_type,
        versionId: dep.version_id ?? undefined,
        projectUrl: `https://modrinth.com/mod/${slug}`,
      };
    });

    const response: ModDependenciesResponse = {
      projectId,
      loader,
      gameVersion,
      resolvedVersion: {
        id: selectedVersion.id,
        versionNumber: selectedVersion.version_number,
        datePublished: selectedVersion.date_published,
      },
      dependencies: resolvedDependencies,
    };

    // Cache resolved results
    dependencyCache.set(cacheKey, response);

    return response;
}
