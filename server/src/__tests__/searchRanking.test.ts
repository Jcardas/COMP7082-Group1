import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase.js', () => ({
  supabase: null,
}));

vi.mock('../lib/huggingface.js', () => ({
  isConfigured: false,
  generateEmbedding: vi.fn(async () => null),
}));

import {
  computeNameMatchScore,
  parseNLPQuery,
  rankSearchCandidates,
} from '../services/search.js';
import type { ModItem } from '../types/consts.js';

function makeMod(overrides: Partial<ModItem> & { id: string; name: string }): ModItem {
  return {
    source: 'modrinth',
    externalModId: overrides.id,
    slug: overrides.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    summary: '',
    dependencies: [],
    categories: [],
    loaders: ['forge'],
    gameVersions: ['1.21.1'],
    downloads: 1000,
    ...overrides,
  };
}

describe('Search Ranking & NLP Parser - search.ts', () => {
  describe('parseNLPQuery()', () => {
    it('strips conversational filler and avoids false substring triggers', () => {
      const parsed = parseNLPQuery('I want mods for create');
      expect(parsed.cleanKeywords).toEqual(['create']);
      expect(parsed.matchedCategories).toEqual([]);
      expect(parsed.targetedQueries).toEqual(['create']);
    });

    it('detects optimization triggers with word boundaries', () => {
      const parsed = parseNLPQuery('mods that boost fps and reduce lag');
      expect(parsed.matchedCategories).toContain('optimization');
      expect(parsed.targetedQueries).toContain('sodium');
    });

    it('does not trigger "fps" or "ram" inside unrelated words like "framerate-less" or "program"', () => {
      const parsed = parseNLPQuery('program');
      expect(parsed.matchedCategories).not.toContain('optimization');
    });
  });

  describe('computeNameMatchScore()', () => {
    it('returns 1.0 for exact name or slug matches', () => {
      expect(computeNameMatchScore('Create', 'create', 'create', ['create'])).toBe(1.0);
      expect(computeNameMatchScore('JEI (Just Enough Items)', 'jei', 'jei', ['jei'])).toBe(1.0);
    });

    it('returns 0.85 for prefix matches and 0.72 for substring matches', () => {
      expect(computeNameMatchScore('Sodium Extra', 'sodium-extra', 'sodium', ['sodium'])).toBe(0.85);
      expect(computeNameMatchScore('Super Create Addon', 'super-create-addon', 'create', ['create'])).toBe(0.72);
    });

    it('scores partial token matches lower than full phrase matches and unrelated names at 0', () => {
      const partial = computeNameMatchScore('Applied Technology', 'applied-technology', 'applied energistics', ['applied', 'energistics']);
      expect(partial).toBeGreaterThan(0);
      expect(partial).toBeLessThan(0.72);
      expect(computeNameMatchScore('Biomes O Plenty', 'biomes-o-plenty', 'sodium', ['sodium'])).toBe(0);
    });
  });

  describe('rankSearchCandidates()', () => {
    it('prioritizes exact name match + high downloads over obscure or addon results', () => {
      const candidates = [
        {
          mod: makeMod({
            id: 'addon-obscure',
            name: 'Create Tiny Gears Addon',
            summary: 'Adds tiny gears for Create automation',
            downloads: 450,
          }),
          similarity: 0.92,
        },
        {
          mod: makeMod({
            id: 'unrelated-semantic',
            name: 'Mechanical Kinetic Boiler',
            summary: 'Create steam and kinetic machines',
            downloads: 200000,
          }),
          similarity: 0.95,
        },
        {
          mod: makeMod({
            id: 'create-main',
            name: 'Create',
            slug: 'create',
            summary: 'Building Tools and Aesthetic Technology',
            downloads: 45000000,
          }),
          similarity: 0.5,
        },
      ];

      const ranked = rankSearchCandidates(candidates, 'create', ['create'], true);
      expect(ranked.map((m) => m.id)).toEqual([
        'create-main',
        'addon-obscure',
        'unrelated-semantic',
      ]);
    });

    it('weights downloads heavily when two mods have comparable name matches', () => {
      const candidates = [
        {
          mod: makeMod({
            id: 'sodium-clone',
            name: 'Sodium',
            slug: 'sodium-clone',
            downloads: 120,
          }),
          similarity: 0.8,
        },
        {
          mod: makeMod({
            id: 'sodium-official',
            name: 'Sodium',
            slug: 'sodium',
            downloads: 32000000,
          }),
          similarity: 0.8,
        },
      ];

      const ranked = rankSearchCandidates(candidates, 'sodium', ['sodium'], false);
      expect(ranked[0].id).toBe('sodium-official');
    });
  });
});
