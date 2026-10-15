import type { DependencyAnalysisResult, ModItem, Modpack } from '../types';

const BASE_URL = '/api';

export async function searchMods(query: string, loader = 'forge', version = '1.20.1'): Promise<{
  results: ModItem[];
  source: string;
}> {
  const params = new URLSearchParams({
    q: query,
    loader,
    version,
  });

  const res = await fetch(`${BASE_URL}/search?${params.toString()}`);
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

export async function analyzeDependencies(mods: ModItem[]): Promise<DependencyAnalysisResult> {
  const res = await fetch(`${BASE_URL}/analyze-dependencies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mods }),
  });
  if (!res.ok) throw new Error('Failed to analyze dependencies');
  return res.json();
}

export async function getRecommendations(
  mods: ModItem[],
  loader = 'forge',
  version = '1.20.1'
): Promise<ModItem[]> {
  const res = await fetch(`${BASE_URL}/recommendations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mods, loader, gameVersion: version }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.recommendations || [];
}

export async function exportModpackZip(modpack: Modpack, format = 'curseforge'): Promise<Blob> {
  const res = await fetch(`${BASE_URL}/modpacks/${modpack.id}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modpack, format }),
  });
  if (!res.ok) throw new Error('Failed to export modpack zip');
  return res.blob();
}

export async function getModpack(id: string): Promise<Modpack> {
  const res = await fetch(`${BASE_URL}/modpacks/${id}`);
  if (!res.ok) throw new Error('Failed to fetch modpack');
  return res.json();
}
