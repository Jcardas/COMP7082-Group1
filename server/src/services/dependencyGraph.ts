// Directed Acyclic Graph (DAG) dependency analyzer
//
// Uses graphlib to build an in-memory graph of all the
// mods installed in the current pack.
//
// Detects missing dependencies, circular loops, delcared & ecosystem
// incompatibilities, and produces a valid topological installation order
//
// Reviewed by Justin C

import graphlib from 'graphlib';
import { ModItem } from '../types/consts.js';
import {
  DependencyAnalysisResult,
  ModIncompatibility,
  ModVersionMismatch,
  MissingDependencyIssue,
} from '../types/index.js';

/**
 * Well-known hard ecosystem conflicts not always captured in older mod manifests
 * Map format: lowercase mod identifier -> Array of conflicting lowercase identifiers with explanations
 */
const KNOWN_ECOSYSTEM_CONFLICTS: Record<string, Array<{ id: string; reason: string }>> = {
  optifine: [
    { id: 'sodium', reason: 'Sodium completely replaces the rendering engine and crashes with OptiFine.' },
    { id: 'rubidium', reason: 'Rubidium is an unofficial Forge port of Sodium and is incompatible with OptiFine.' },
    { id: 'embeddium', reason: 'Embeddium is a Sodium fork and conflicts directly with OptiFine.' },
    { id: 'iris', reason: 'Iris is designed for Sodium shaders and conflicts with OptiFine.' },
    { id: 'oculus', reason: 'Oculus is designed for Rubidium/Embeddium shaders and conflicts with OptiFine.' },
  ],
  sodium: [
    { id: 'optifine', reason: 'Sodium conflicts directly with OptiFine renderer.' },
  ],
  rubidium: [
    { id: 'optifine', reason: 'Rubidium conflicts directly with OptiFine renderer.' },
  ],
  embeddium: [
    { id: 'optifine', reason: 'Embeddium conflicts directly with OptiFine renderer.' },
  ],
};

/**
 * Options to validate pack-level environment constraints
 */
export interface DependencyAnalysisOptions {
  targetGameVersion?: string;
  targetLoader?: string;
}

/**
 * Analyzes mod dependencies using graphlib:
 * - Builds a directed dependency graph
 * - Detects circular dependency cycles
 * - Identifies missing required dependencies
 *
 * @param mods Array of ModItems currently installed in the modpack
 * @returns DependencyAnalysisResult containing validity, cycles, and missing mods
 */
export function analyzeDependencies(mods: ModItem[], options: DependencyAnalysisOptions = {}): DependencyAnalysisResult {
  // Directed graph: edges point from the mod to what it needs to run
  const g = new graphlib.Graph({ directed: true });

  // Map mods by ID, slug, and lowercase name so we can look them up
  // no matter how Modrinth or CurseForge formatted the dependency ID
  const modLookup = new Map<string, ModItem>();
  // Primary node key set to ensure we track unique mods
  const primaryKeys = new Set<string>();

  for (const mod of mods) {
    const primaryKey = mod.externalModId || mod.id;
    primaryKeys.add(primaryKey);

    // Register primary ID
    modLookup.set(primaryKey, mod);
    modLookup.set(mod.id, mod);

    if (mod.slug) {
      modLookup.set(mod.slug.toLowerCase(), mod);
    }
    if (mod.name) {
      modLookup.set(mod.name.toLowerCase(), mod);
    }

    // Add node to graph with metadata
    g.setNode(primaryKey, mod.name);
  }

  const missingDependencies: MissingDependencyIssue[] = [];
  const incompatibilities: ModIncompatibility[] = [];
  const versionMismatches: ModVersionMismatch[] = [];

  // Set to avoid logging duplicate bidirectional incompatibilities
  const recordedConflictKeys = new Set<string>();

  // Helper to record a conflict once regardless of order
  const addIncompatibility = (
    sourceMod: ModItem,
    conflictingMod: ModItem,
    reason: string
  ) => {
    const keyA = sourceMod.externalModId || sourceMod.id;
    const keyB = conflictingMod.externalModId || conflictingMod.id;
    const pairKey = [keyA, keyB].sort().join('::');

    if (!recordedConflictKeys.has(pairKey)) {
      recordedConflictKeys.add(pairKey);
      incompatibilities.push({
        sourceModName: sourceMod.name,
        sourceModId: keyA,
        conflictingModName: conflictingMod.name,
        conflictingModId: keyB,
        reason,
      });
    }
  };

  // Hook up edges: Mod -> depends on -> Dependency
  for (const mod of mods) {
    const fromKey = mod.externalModId || mod.id;
    const missingForThisMod: any[] = [];

    // Target version and loader checks
    if (options.targetGameVersion && mod.gameVersions && mod.gameVersions.length > 0) {
      const supportsVersion = mod.gameVersions.includes(options.targetGameVersion);
      if (!supportsVersion) {
        versionMismatches.push({
          modId: fromKey,
          modName: mod.name,
          targetVersion: options.targetGameVersion,
          supportedVersions: mod.gameVersions,
          supportedLoaders: mod.loaders || [],
          reason: `Mod "${mod.name}" does not list support for target Minecraft version ${options.targetGameVersion}.`,
        });
      }
    }

    if (options.targetLoader && mod.loaders && mod.loaders.length > 0) {
      const normalizedTargetLoader = options.targetLoader.toLowerCase();
      const supportsLoader = mod.loaders.some(
        (l) => l.toLowerCase() === normalizedTargetLoader
      );
      if (!supportsLoader) {
        versionMismatches.push({
          modId: fromKey,
          modName: mod.name,
          targetLoader: options.targetLoader,
          supportedVersions: mod.gameVersions || [],
          supportedLoaders: mod.loaders,
          reason: `Mod "${mod.name}" does not list support for target loader ${options.targetLoader}.`,
        });
      }
    }

    // Check declared dependencies in mod metadata
    const rawDeps = (mod.dependencies || []) as any[];

    for (const dep of rawDeps) {
      // Support both `type` and legacy `dependencyType` properties
      const depType: string = dep.type || dep.dependencyType || 'required';
      const depRef: string = dep.projectId || dep.id || dep.slug || dep.name || '';
      const depRefLower = depRef.toLowerCase();

      // Attempt to resolve dependency in our installed mods map
      const targetMod =
        modLookup.get(depRef) ||
        modLookup.get(depRefLower) ||
        (dep.name ? modLookup.get(dep.name.toLowerCase()) : undefined);

      if (depType === 'incompatible') {
        // If the declared incompatible mod is installed in the pack, flag conflict
        if (targetMod && (targetMod.externalModId || targetMod.id) !== fromKey) {
          addIncompatibility(
            mod,
            targetMod,
            `Mod "${mod.name}" explicitly declares "${targetMod.name}" as incompatible.`
          );
        }
      } else if (depType === 'required') {
        if (targetMod) {
          // Valid required dependency found:
          // Directed edge: fromKey depends on toKey
          const toKey = targetMod.externalModId || targetMod.id;
          if (fromKey !== toKey) {
            g.setEdge(fromKey, toKey);
          }
        } else {
          // Required mod is not installed in the pack
          missingForThisMod.push(dep);
        }
      }
    }

    if (missingForThisMod.length > 0) {
      missingDependencies.push({
        modName: mod.name,
        modId: fromKey,
        missing: missingForThisMod,
      });
    }

    // 2. Check well-known hard ecosystem conflicts
    const lowerSlug = (mod.slug || '').toLowerCase();
    const lowerName = mod.name.toLowerCase();

    for (const [conflictKey, conflictEntries] of Object.entries(KNOWN_ECOSYSTEM_CONFLICTS)) {
      if (lowerSlug.includes(conflictKey) || lowerName.includes(conflictKey)) {
        for (const entry of conflictEntries) {
          const conflictingMod =
            modLookup.get(entry.id) ||
            Array.from(modLookup.values()).find(
              (m) =>
                (m.slug && m.slug.toLowerCase().includes(entry.id)) ||
                m.name.toLowerCase().includes(entry.id)
            );

          if (conflictingMod && (conflictingMod.externalModId || conflictingMod.id) !== fromKey) {
            addIncompatibility(mod, conflictingMod, entry.reason);
          }
        }
      }
    }
  }

  // 3. Find circular dependency loops
  // graphlib.alg.findCycles returns arrays of node keys forming cycles: [['A', 'B']]
  const rawCycles = graphlib.alg.findCycles(g);
  
  // Format cycles cleanly so each cycle loop ends with the starting mod (e.g., ['A', 'B', 'A'])
  const cycles: string[][] = rawCycles.map((cycle) => {
    if (cycle.length > 0) {
      return [...cycle, cycle[0]];
    }
    return cycle;
  });

  // 4. Determine topological installation order
  let installOrder: string[] = [];
  if (cycles.length === 0) {
    try {
      // In graphlib, topsort(g) returns nodes such that for edge A -> B, A appears before B.
      // Since A -> B means "A depends on B", B must be loaded/installed BEFORE A.
      // Therefore, reversing the topsort result gives the exact installation order:
      // dependencies first, dependents last.
      const topSorted = graphlib.alg.topsort(g);
      installOrder = [...topSorted].reverse();
    } catch {
      // Fallback in case of unexpected graph traversal failure
      installOrder = [];
    }
  }

  // Pack is only valid if no cycles, no missing required mods, and no incompatibilities exist
  const isValid =
    cycles.length === 0 &&
    missingDependencies.length === 0 &&
    incompatibilities.length === 0 &&
    versionMismatches.length === 0;

  return {
    isValid,
    cycles,
    missingDependencies,
    incompatibilities,
    versionMismatches,
    installOrder,
  };
}
