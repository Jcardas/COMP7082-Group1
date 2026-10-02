import graphlib from 'graphlib';
import { DependencyAnalysisResult, ModItem } from '../types/index.js';

/**
 * Analyzes mod dependencies using graphlib:
 * - Builds a directed dependency graph
 * - Detects circular dependency cycles
 * - Identifies missing required dependencies
 * - Computes the topological install / load order
 */
export function analyzeDependencies(mods: ModItem[]): DependencyAnalysisResult {
  const g = new graphlib.Graph({ directed: true });

  const modMap = new Map<string, ModItem>();
  mods.forEach((mod) => {
    // Key by externalModId or unique id
    const key = mod.externalModId || mod.id;
    modMap.set(key, mod);
    modMap.set(mod.name.toLowerCase(), mod);
    if (mod.slug) {
      modMap.set(mod.slug.toLowerCase(), mod);
    }
    g.setNode(key, mod);
  });

  const missingDependencies: { modName: string; missing: any[] }[] = [];

  // Populate edges: Mod -> depends on -> Dependency
  for (const mod of mods) {
    const fromKey = mod.externalModId || mod.id;
    const missingForThisMod: any[] = [];

    for (const dep of mod.dependencies || []) {
      if (dep.dependencyType === 'incompatible') {
        continue;
      }

      const depKey = dep.id;
      const resolvedDep = modMap.get(depKey) || modMap.get(dep.name.toLowerCase());

      if (resolvedDep) {
        const toKey = resolvedDep.externalModId || resolvedDep.id;
        g.setEdge(fromKey, toKey);
      } else if (dep.dependencyType === 'required') {
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

  // Detect circular dependency cycles
  const cycles = graphlib.alg.findCycles(g);

  // Compute install / load order using topological sort
  let installOrder: string[] = [];
  try {
    if (cycles.length === 0) {
      // topsort gives dependencies first if reversed or standard order
      const sortedKeys = graphlib.alg.topsort(g);
      installOrder = sortedKeys
        .map((key) => {
          const mod = modMap.get(key);
          return mod ? mod.name : key;
        })
        .reverse(); // dependencies installed before dependent mods
    }
  } catch (error) {
    console.warn('Topological sort error (cycles present):', error);
  }

  return {
    isValid: cycles.length === 0 && missingDependencies.length === 0,
    cycles,
    missingDependencies,
    installOrder,
  };
}
