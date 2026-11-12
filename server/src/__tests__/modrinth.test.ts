// server/src/__tests__/modrinth.test.ts
// Created by Jacob F on 2026-11-12
//
// Unit tests for the Modrinth v2 API wrapper service.
// Tests search facet construction, version prioritization, batch project
// title resolution, and in-memory TTL caching.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mockGet is initialized before vi.mock('axios') executes
const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: mockGet,
    })),
  },
}));

import {
  searchModrinthMods,
  getModrinthProject,
  getModrinthProjectsBatch,
  fetchModDependencies,
} from '../services/modrinth.js';

describe('Modrinth Service Wrapper - modrinth.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchModrinthMods()', () => {
    it('constructs a 2D facet array and normalizes search hits into ModItem objects', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          hits: [
            {
              project_id: 'AANobbMI',
              slug: 'sodium',
              title: 'Sodium',
              description: 'Fast rendering engine',
              categories: ['fabric', 'optimization'],
              loaders: ['fabric'],
              versions: ['1.20.1'],
              icon_url: 'https://cdn.modrinth.com/sodium.png',
              downloads: 9500000,
              follows: 50000,
            },
          ],
          total_hits: 1,
        },
      });

      const results = await searchModrinthMods({
        query: 'sodium',
        loader: 'Fabric',
        gameVersion: '1.20.1',
        categories: ['Optimization', 'Client'],
        index: 'downloads',
        limit: 10,
      });

      // Verify Axios called /search with properly stringified 2D facets
      expect(mockGet).toHaveBeenCalledWith('/search', {
        params: {
          query: 'sodium',
          facets: JSON.stringify([
            ['project_type:mod'],
            ['categories:fabric'],
            ['versions:1.20.1'],
            ['categories:optimization', 'categories:client'],
          ]),
          limit: 10,
          index: 'downloads',
        },
      });

      // Verify normalized ModItem output
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(
        expect.objectContaining({
          id: 'modrinth-AANobbMI',
          source: 'modrinth',
          externalModId: 'AANobbMI',
          slug: 'sodium',
          name: 'Sodium',
          projectUrl: 'https://modrinth.com/mod/sodium',
          downloads: 9500000,
        })
      );
    });

    it('returns an empty array gracefully when the Modrinth search API fails', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network error'));

      const results = await searchModrinthMods({ query: 'create' });
      expect(results).toEqual([]);
    });
  });

  describe('fetchModDependencies() & Caching', () => {
    it('prioritizes release versions over beta/alpha, resolves dependency project titles, and caches results', async () => {
      // 1st GET call: /project/create-mod/version
      mockGet.mockResolvedValueOnce({
        data: [
          {
            id: 'ver-alpha-newer',
            project_id: 'create-mod',
            version_number: '0.6.0-alpha',
            version_type: 'alpha',
            date_published: '2026-06-01T00:00:00Z',
            game_versions: ['1.20.1'],
            loaders: ['forge'],
            files: [],
            dependencies: [],
          },
          {
            id: 'ver-release-stable',
            project_id: 'create-mod',
            version_number: '0.5.1.f',
            version_type: 'release',
            date_published: '2026-04-01T00:00:00Z',
            game_versions: ['1.20.1'],
            loaders: ['forge'],
            files: [],
            dependencies: [
              {
                version_id: null,
                project_id: 'flywheel-id',
                file_name: null,
                dependency_type: 'required',
              },
            ],
          },
        ],
      });

      // 2nd GET call: /projects?ids=["flywheel-id"]
      mockGet.mockResolvedValueOnce({
        data: [
          {
            id: 'flywheel-id',
            slug: 'flywheel',
            title: 'Flywheel',
            description: 'Modern engine for modded Minecraft',
          },
        ],
      });

      // Execute first lookup
      const result1 = await fetchModDependencies('create-mod', 'forge', '1.20.1');

      // Should have selected 'ver-release-stable' despite 'ver-alpha-newer' having a newer timestamp
      expect(result1.resolvedVersion?.id).toBe('ver-release-stable');
      expect(result1.resolvedVersion?.versionNumber).toBe('0.5.1.f');
      expect(result1.dependencies).toHaveLength(1);
      expect(result1.dependencies[0]).toEqual({
        projectId: 'flywheel-id',
        name: 'Flywheel',
        slug: 'flywheel',
        type: 'required',
        versionId: undefined,
        projectUrl: 'https://modrinth.com/mod/flywheel',
      });

      expect(mockGet).toHaveBeenCalledTimes(2);

      // Execute second identical lookup — should return from dependencyCache without new HTTP calls
      const result2 = await fetchModDependencies('create-mod', 'forge', '1.20.1');
      expect(result2).toEqual(result1);
      expect(mockGet).toHaveBeenCalledTimes(2);
    });
  });

  describe('getModrinthProject() & getModrinthProjectsBatch()', () => {
    it('caches individual project lookups by both ID and slug', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          id: 'P7dR8mSH',
          slug: 'fabric-api',
          title: 'Fabric API',
          description: 'Core hooks for Fabric',
        },
      });

      // Fetch by slug first
      const projBySlug = await getModrinthProject('fabric-api');
      expect(projBySlug?.title).toBe('Fabric API');
      expect(mockGet).toHaveBeenCalledTimes(1);

      // Subsequent batch lookup by ID 'P7dR8mSH' should hit projectCache without calling Axios
      const batchMap = await getModrinthProjectsBatch(['P7dR8mSH']);
      expect(batchMap.get('P7dR8mSH')?.title).toBe('Fabric API');
      expect(mockGet).toHaveBeenCalledTimes(1);
    });
  });
});