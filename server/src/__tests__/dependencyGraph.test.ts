// server/src/__tests__/dependencyGraph.test.ts
// Created by Jacob F on 2026-11-12
//
// Unit tests for the Directed Acyclic Graph (DAG) dependency analyzer.
// Tests topological sort order, circular dependency detection, missing
// required libraries, explicit/ecosystem incompatibilities, and version checks.

import { describe, it, expect } from 'vitest';
import { analyzeDependencies } from '../services/dependencyGraph.js';
import { ModItem } from '../types/consts.js';

/**
 * Helper factory to construct clean ModItem test fixtures with sensible defaults
 */
function createMockMod(overrides: Partial<ModItem> & { id: string; name: string }): ModItem {
  return {
    id: overrides.id,
    externalModId: overrides.externalModId || overrides.id,
    source: overrides.source || 'modrinth',
    slug: overrides.slug || overrides.id.toLowerCase(),
    name: overrides.name,
    summary: overrides.summary || 'Test mod summary',
    downloads: overrides.downloads ?? 1000,
    categories: overrides.categories || [],
    loaders: overrides.loaders || ['fabric'],
    gameVersions: overrides.gameVersions || ['1.20.1'],
    dependencies: overrides.dependencies || [],
    votes: overrides.votes || { yes: [], no: [] },
    comments: overrides.comments || [],
  };
}

describe('Dependency Graph Analyzer - analyzeDependencies()', () => {
  it('computes a valid bottom-up topological installOrder for an acyclic dependency chain', () => {
    // Chain: CreateAddon -> depends on -> Create -> depends on -> Flywheel
    const flywheel = createMockMod({
      id: 'flywheel',
      name: 'Flywheel',
      dependencies: [],
    });

    const createMod = createMockMod({
      id: 'create',
      name: 'Create',
      dependencies: [
        {
          projectId: 'flywheel',
          name: 'Flywheel',
          slug: 'flywheel',
          type: 'required',
          projectUrl: 'https://modrinth.com/mod/flywheel',
        } as any,
      ],
    });

    const createAddon = createMockMod({
      id: 'create-crafts-additions',
      name: 'Create Crafts & Additions',
      dependencies: [
        {
          projectId: 'create',
          name: 'Create',
          slug: 'create',
          type: 'required',
          projectUrl: 'https://modrinth.com/mod/create',
        } as any,
      ],
    });

    const result = analyzeDependencies([createAddon, createMod, flywheel]);

    expect(result.isValid).toBe(true);
    expect(result.cycles).toHaveLength(0);
    expect(result.missingDependencies).toHaveLength(0);
    expect(result.incompatibilities).toHaveLength(0);

    // Flywheel must be installed before Create, and Create before CreateAddon
    const flywheelIdx = result.installOrder.indexOf('flywheel');
    const createIdx = result.installOrder.indexOf('create');
    const addonIdx = result.installOrder.indexOf('create-crafts-additions');

    expect(flywheelIdx).toBeGreaterThanOrEqual(0);
    expect(createIdx).toBeGreaterThan(flywheelIdx);
    expect(addonIdx).toBeGreaterThan(createIdx);
  });

  it('detects indirect circular dependency chains (A -> B -> C -> A) and sets isValid to false', () => {
    const modA = createMockMod({
      id: 'mod-a',
      name: 'Mod A',
      dependencies: [{ projectId: 'mod-b', name: 'Mod B', type: 'required' } as any],
    });

    const modB = createMockMod({
      id: 'mod-b',
      name: 'Mod B',
      dependencies: [{ projectId: 'mod-c', name: 'Mod C', type: 'required' } as any],
    });

    const modC = createMockMod({
      id: 'mod-c',
      name: 'Mod C',
      dependencies: [{ projectId: 'mod-a', name: 'Mod A', type: 'required' } as any],
    });

    const result = analyzeDependencies([modA, modB, modC]);

    expect(result.isValid).toBe(false);
    expect(result.cycles.length).toBeGreaterThan(0);

    // Verify the cycle closes back on its starting node (length 4 for 3 nodes: X -> Y -> Z -> X)
    const detectedCycle = result.cycles[0];
    expect(detectedCycle).toHaveLength(4);
    expect(detectedCycle[0]).toBe(detectedCycle[detectedCycle.length - 1]);
    expect(detectedCycle).toEqual(expect.arrayContaining(['mod-a', 'mod-b', 'mod-c']));

    // Topological sort cannot be produced when cycles exist
    expect(result.installOrder).toEqual([]);
  });

  it('reports missing required dependencies while ignoring missing optional dependencies', () => {
    const modWithMissingDeps = createMockMod({
      id: 'iris',
      name: 'Iris Shaders',
      dependencies: [
        // Missing required dependency (should be flagged)
        {
          projectId: 'sodium',
          name: 'Sodium',
          type: 'required',
        } as any,
        // Missing optional dependency (should NOT be flagged)
        {
          projectId: 'modmenu',
          name: 'Mod Menu',
          type: 'optional',
        } as any,
      ],
    });

    const result = analyzeDependencies([modWithMissingDeps]);

    expect(result.isValid).toBe(false);
    expect(result.missingDependencies).toHaveLength(1);
    expect(result.missingDependencies[0].modName).toBe('Iris Shaders');
    expect(result.missingDependencies[0].missing).toHaveLength(1);
    expect(result.missingDependencies[0].missing[0].name).toBe('Sodium');
  });

  it('detects explicit declared incompatibilities and deduplicates bidirectional conflicts', () => {
    const modAlpha = createMockMod({
      id: 'mod-alpha',
      name: 'Mod Alpha',
      dependencies: [
        {
          projectId: 'mod-beta',
          name: 'Mod Beta',
          type: 'incompatible',
        } as any,
      ],
    });

    const modBeta = createMockMod({
      id: 'mod-beta',
      name: 'Mod Beta',
      dependencies: [
        {
          projectId: 'mod-alpha',
          name: 'Mod Alpha',
          type: 'incompatible',
        } as any,
      ],
    });

    const result = analyzeDependencies([modAlpha, modBeta]);

    expect(result.isValid).toBe(false);
    // Should be deduplicated to a single conflict record despite both declaring each other
    expect(result.incompatibilities).toHaveLength(1);
    expect(result.incompatibilities[0].reason).toContain('explicitly declares');
  });

  it('detects well-known ecosystem conflicts such as Sodium and OptiFine', () => {
    const sodium = createMockMod({
      id: 'sodium-id',
      slug: 'sodium',
      name: 'Sodium',
    });

    const optifine = createMockMod({
      id: 'optifine-id',
      slug: 'optifine',
      name: 'OptiFine',
    });

    const result = analyzeDependencies([sodium, optifine]);

    expect(result.isValid).toBe(false);
    expect(result.incompatibilities).toHaveLength(1);
    expect(result.incompatibilities[0]).toEqual(
      expect.objectContaining({
        reason: expect.stringContaining('OptiFine'),
      })
    );
  });

  it('flags version and mod loader mismatches when target options are provided', () => {
    const legacyForgeMod = createMockMod({
      id: 'jei-legacy',
      name: 'Just Enough Items (Legacy)',
      gameVersions: ['1.12.2'],
      loaders: ['forge'],
    });

    const result = analyzeDependencies([legacyForgeMod], {
      targetGameVersion: '1.20.1',
      targetLoader: 'fabric',
    });

    expect(result.isValid).toBe(false);
    // Should record 2 mismatches: one for gameVersion (1.12.2 vs 1.20.1) and one for loader (forge vs fabric)
    expect(result.versionMismatches).toHaveLength(2);
    expect(result.versionMismatches[0].modName).toBe('Just Enough Items (Legacy)');
  });
});