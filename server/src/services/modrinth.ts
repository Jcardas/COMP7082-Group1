import axios from 'axios';
import { config } from '../config/index.js';
import { ModItem } from '../types/index.js';

const client = axios.create({
  baseURL: config.modrinth.baseUrl,
  headers: {
    'User-Agent': config.modrinth.userAgent,
    ...(config.modrinth.token ? { Authorization: config.modrinth.token } : {}),
  },
});

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

export async function searchModrinthMods(params: {
  query?: string;
  loader?: string;
  gameVersion?: string;
  categories?: string[];
  index?: 'relevance' | 'downloads' | 'follows' | 'newest';
  limit?: number;
}): Promise<ModItem[]> {
  try {
    const facets: string[][] = [['project_type:mod']];

    if (params.loader) {
      facets.push([`categories:${params.loader.toLowerCase()}`]);
    }
    if (params.gameVersion) {
      facets.push([`versions:${params.gameVersion}`]);
    }
    if (params.categories && params.categories.length > 0) {
      // OR group of categories
      facets.push(params.categories.map((c) => `categories:${c.toLowerCase()}`));
    }

    const queryParams: Record<string, string | number> = {
      query: params.query || '',
      facets: JSON.stringify(facets),
      limit: params.limit || 20,
    };

    if (params.index) {
      queryParams.index = params.index;
    }

    const response = await client.get<ModrinthSearchResult>('/search', {
      params: queryParams,
    });

    return response.data.hits.map((hit) => ({
      id: `modrinth-${hit.project_id}`,
      source: 'modrinth',
      externalModId: hit.project_id,
      slug: hit.slug,
      name: hit.title,
      summary: hit.description || '',
      iconUrl: hit.icon_url,
      projectUrl: hit.slug
        ? `https://modrinth.com/mod/${hit.slug}`
        : `https://modrinth.com/mod/${hit.project_id}`,
      downloads: hit.downloads || 0,
      categories: hit.categories || [],
      loaders: hit.loaders || [],
      gameVersions: hit.versions || [],
      dependencies: [],
      votes: { yes: [], no: [] },
      comments: [],
    }));
  } catch (error) {
    console.error('Failed to search Modrinth mods:', error);
    return [];
  }
}

export async function getModrinthProject(idOrSlug: string) {
  try {
    const response = await client.get(`/project/${idOrSlug}`);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch Modrinth project ${idOrSlug}:`, error);
    return null;
  }
}

export async function getModrinthProjectVersions(projectId: string, loader?: string, gameVersion?: string) {
  try {
    const params: Record<string, string> = {};
    if (loader) params.loaders = JSON.stringify([loader.toLowerCase()]);
    if (gameVersion) params.game_versions = JSON.stringify([gameVersion]);

    const response = await client.get(`/project/${projectId}/version`, { params });
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch Modrinth versions for ${projectId}:`, error);
    return [];
  }
}
