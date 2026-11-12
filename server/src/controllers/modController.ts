// server/src/controllers/modController.ts
// Created by Jacob F on 2026-11-08
//
// Controller handling mod search, smart modpack recommendations,
//Modrinth version dependency fetching, and DAG dependency analysis.

import { Request, Response } from 'express';
import { analyzeDependencies } from '../services/dependencyGraph.js';
import { fetchModDependencies } from '../services/modrinth.js';
import {
  getModpackRecommendations,
  resolveRequiredDependenciesForMod,
  searchModsWithNLP,
} from '../services/search.js';
import { ModItem } from '../types/consts.js';
import { ModDependenciesResponse } from '../types/index.js';

interface ErrorResponse {
  error: string;
}

/**
 * GET /api/search
 * Performs natural language semantic and keyword mod search across Modrinth and CurseForge
 */
export async function searchMods(req: Request, res: Response) {
  try {
    const query = String(req.query.q || '');
    const loader = req.query.loader ? String(req.query.loader) : undefined;
    const gameVersion = req.query.version ? String(req.query.version) : undefined;
    const category = req.query.category ? String(req.query.category) : undefined;
    const sourceParam = req.query.source ? String(req.query.source) : 'both';
    const source =
      sourceParam === 'modrinth' || sourceParam === 'curseforge' ? sourceParam : 'both';
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const searchResults = await searchModsWithNLP({
      query,
      loader,
      gameVersion,
      category,
      source,
      page,
      limit,
    });

    res.json(searchResults);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search mods' });
  }
}

/**
 * POST /api/recommendations
 * Generates smart mod recommendations based on currently installed mods
 */
export async function getRecommendations(req: Request, res: Response) {
  try {
    const { mods = [], loader, gameVersion } = req.body;
    const recommendations = await getModpackRecommendations(mods, loader, gameVersion);
    res.json({ recommendations });
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
}

/**
 * POST /api/resolve-mod-dependencies
 * Resolves required dependencies for a single mod when adding it to a pack
 */
export async function resolveModDependencies(req: Request, res: Response) {
  try {
    const { mod, loader, gameVersion } = req.body as {
      mod: ModItem;
      loader?: string;
      gameVersion?: string;
    };
    const dependencies = await resolveRequiredDependenciesForMod(mod, loader, gameVersion);
    return res.json({ dependencies });
  } catch (error) {
    console.error('Resolve mod dependencies error:', error);
    return res.status(500).json({ error: 'Failed to resolve mod dependencies' });
  }
}

/**
 * POST /api/analyze-dependencies
 * Runs the DAG analyzer to detect cycles, missing libraries, incompatibilities, and install order
 */
export function analyzeModDependencies(req: Request, res: Response) {
  try {
    const { mods = [], targetGameVersion, targetLoader } = req.body;
    const analysis = analyzeDependencies(mods, { targetGameVersion, targetLoader });
    res.json(analysis);
  } catch (error) {
    console.error('Dependency analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze dependencies' });
  }
}

/**
 * GET /api/mods/:id/dependencies
 * Queries the Modrinth Version API for a mod's declared dependencies
 */
export async function getModDependencies(
  req: Request,
  res: Response<ModDependenciesResponse | ErrorResponse>
) {
  try {
    const rawId = req.params.id;
    const loader = typeof req.query.loader === 'string' ? req.query.loader : undefined;
    const gameVersion = typeof req.query.version === 'string' ? req.query.version : undefined;

    // Narrow id to guarantee single string
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      res.status(400).json({ error: 'Missing required mod ID parameter' });
      return;
    }

    // Call the Modrinth service dependency fetcher
    const result = await fetchModDependencies(id.trim(), loader, gameVersion);

    res.json(result);
  } catch (error) {
    console.error(`Error resolving dependencies for mod ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch mod dependencies' });
  }
}
