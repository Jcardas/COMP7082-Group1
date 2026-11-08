// Directed Acyclic Graph (DAG) dependency analyzer
//
// Uses graphlib to build an in-memory graph of all the
// mods installed in the current pack.
//
// Finds missing required dependencies and catches circular
// loops so the pack doesn't crash on boot.
//
// Reviewed by Justin C

import graphlib from 'graphlib';
import { DependencyAnalysisResult, ModItem } from '../types/consts.js';

/**
 * Analyzes mod dependencies using graphlib:
 * - Builds a directed dependency graph
 * - Detects circular dependency cycles
 * - Identifies missing required dependencies
 *
 * @param mods Array of ModItems currently installed in the modpack
 * @returns DependencyAnalysisResult containing validity, cycles, and missing mods
 */
export function analyzeDependencies(mods: ModItem[]): DependencyAnalysisResult {
  // Directed graph: edges point from the mod to what it needs to run
  const g = new graphlib.Graph({ directed: true });

  // Map mods by ID, slug, and lowercase name so we can look them up
  // no matter how Modrinth or CurseForge formatted the dependency ID
  const modMap = new Map<string, ModItem>();
  mods.forEach((mod) => {
    const key = mod.externalModId || mod.id;
    modMap.set(key, mod);
    modMap.set(mod.name.toLowerCase(), mod);
    if (mod.slug) {
      modMap.set(mod.slug.toLowerCase(), mod);
    }
    // Add mod as a node in the graph
    g.setNode(key, mod);
  });

  const missingDependencies: { modName: string; missing: any[] }[] = [];

  // Hook up edges: Mod -> depends on -> Dependency
  for (const mod of mods) {
    const fromKey = mod.externalModId || mod.id;
    const missingForThisMod: any[] = [];

    for (const dep of mod.dependencies || []) {
      // Incompatible mods are conflicts, not dependencies, so ignore them here
      if (dep.dependencyType === 'incompatible') {
        continue;
      }

      const depKey = dep.id;
      // Check if the dependency is already installed in the pack
      const resolvedDep = modMap.get(depKey) || modMap.get(dep.name.toLowerCase());

      if (resolvedDep) {
        // Dependency found: draw an edge from this mod to its dependency
        const toKey = resolvedDep.externalModId || resolvedDep.id;
        g.setEdge(fromKey, toKey);
      } else if (dep.dependencyType === 'required') {
        // Only flag if it's strictly required (ignore optional/recommended)
        missingForThisMod.push(dep);
      }
    }

    if (missingForThisMod.length > 0) {
      missingDependencies.push({
        modName: mod.name,
        missing: missingForThisMod,
      });
    }
  }

  // Find any infinite dependency loops (e.g. Mod A -> Mod B -> Mod A)
  const cycles = graphlib.alg.findCycles(g);

  // Pack is good to go if there are no missing required mods and no cycles
  return {
    isValid: cycles.length === 0 && missingDependencies.length === 0,
    cycles,
    missingDependencies,
  };
}
