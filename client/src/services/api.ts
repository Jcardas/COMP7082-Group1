import type {
  DependencyAnalysisResult,
  FriendItem,
  ModItem,
  Modpack,
  ModpackInvite,
} from '../types/consts';

const BASE_URL = '/api';

export class ModpackNotFoundError extends Error {
  status = 404;
  constructor(id: string) {
    super(`Modpack "${id}" was not found`);
    this.name = 'ModpackNotFoundError';
  }
}

export interface SearchFilterOptions {
  query?: string;
  loader?: string;
  version?: string;
  category?: string;
  source?: 'both' | 'modrinth' | 'curseforge';
  page?: number;
  limit?: number;
}

export async function checkServerHealth(): Promise<{
  status: string;
  timestamp: string;
  services: Record<string, boolean>;
}> {
  const res = await fetch(`${BASE_URL}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function searchMods(
  queryOrOptions: string | SearchFilterOptions,
  loader = 'forge',
  version = '1.20.1'
): Promise<{
  results: ModItem[];
  source: string;
  total: number;
  page: number;
  pageSize: number;
}> {
  const opts: SearchFilterOptions =
    typeof queryOrOptions === 'string'
      ? { query: queryOrOptions, loader, version, page: 1, limit: 10, source: 'both' }
      : queryOrOptions;

  const params = new URLSearchParams({
    q: opts.query || '',
    loader: opts.loader || 'forge',
    version: opts.version || '1.20.1',
    category: opts.category || 'all',
    source: opts.source || 'both',
    page: String(opts.page || 1),
    limit: String(opts.limit || 10),
  });

  const res = await fetch(`${BASE_URL}/search?${params.toString()}`);
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

export async function resolveModDependencies(
  mod: ModItem,
  loader = 'forge',
  gameVersion = '1.20.1'
): Promise<ModItem[]> {
  const res = await fetch(`${BASE_URL}/resolve-mod-dependencies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mod, loader, gameVersion }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.dependencies || [];
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

export async function listModpacks(): Promise<Modpack[]> {
  const res = await fetch(`${BASE_URL}/modpacks`);
  if (!res.ok) throw new Error('Failed to list modpacks');
  const data = await res.json();
  return data.modpacks || [];
}

export async function getModpack(id: string): Promise<Modpack> {
  const res = await fetch(`${BASE_URL}/modpacks/${id}`);
  if (res.status === 404) {
    throw new ModpackNotFoundError(id);
  }
  if (!res.ok) throw new Error('Failed to fetch modpack');
  return res.json();
}

export async function createModpack(payload: {
  title: string;
  description?: string;
  imageUrl?: string;
  contributors?: string[];
  pendingInvites?: string[];
  minecraftVersion?: string;
  modLoader?: Modpack['modLoader'];
  createdBy?: string;
  creatorName?: string;
}): Promise<Modpack> {
  const res = await fetch(`${BASE_URL}/modpacks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create modpack');
  return res.json();
}

export async function updateModpack(id: string, payload: Partial<Modpack>): Promise<Modpack> {
  const res = await fetch(`${BASE_URL}/modpacks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update modpack');
  return res.json();
}

export async function addModToPackApi(modpackId: string, mod: ModItem): Promise<ModItem> {
  const res = await fetch(`${BASE_URL}/modpacks/${modpackId}/mods`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mod),
  });
  if (!res.ok) throw new Error('Failed to add mod to modpack');
  return res.json();
}

export async function removeModFromPackApi(modpackId: string, modId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/modpacks/${modpackId}/mods/${encodeURIComponent(modId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to remove mod from modpack');
}

export async function deleteModpack(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/modpacks/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete modpack');
}

export async function sendModpackInvite(
  modpackId: string,
  payload: {
    invitedUser: string;
    invitedUserId?: string;
    invitedBy?: string;
  }
): Promise<ModpackInvite> {
  const res = await fetch(`${BASE_URL}/modpacks/${modpackId}/invites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to send modpack invite');
  return res.json();
}

export async function listModpackInvites(params?: {
  user?: string;
  friendCode?: string;
  userId?: string;
}): Promise<ModpackInvite[]> {
  const search = new URLSearchParams();
  if (params?.user) search.set('user', params.user);
  if (params?.friendCode) search.set('friendCode', params.friendCode);
  if (params?.userId) search.set('userId', params.userId);
  const query = search.toString() ? `?${search.toString()}` : '';
  const res = await fetch(`${BASE_URL}/invites${query}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.invites || [];
}

export async function acceptModpackInvite(
  inviteId: string,
  payload: { userId?: string; username?: string }
): Promise<{ invite: ModpackInvite; modpack?: Modpack }> {
  const res = await fetch(`${BASE_URL}/invites/${inviteId}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to accept modpack invite');
  return res.json();
}

export async function declineModpackInvite(
  inviteId: string,
  payload?: { userId?: string; username?: string }
): Promise<{ invite: ModpackInvite }> {
  const res = await fetch(`${BASE_URL}/invites/${inviteId}/decline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) throw new Error('Failed to decline modpack invite');
  return res.json();
}

export async function listFriends(): Promise<FriendItem[]> {
  const res = await fetch(`${BASE_URL}/friends`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.friends || [];
}

export async function addFriend(payload: {
  username?: string;
  friendCode: string;
}): Promise<FriendItem> {
  const res = await fetch(`${BASE_URL}/friends`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to add friend');
  return res.json();
}

export async function removeFriend(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/friends/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to remove friend');
}
