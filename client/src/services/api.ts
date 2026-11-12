import type {
  DependencyAnalysisResult,
  FriendItem,
  FriendRequest,
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

export class ModpackAccessError extends Error {
  status = 403;
  constructor(id: string) {
    super(`You do not have access to modpack "${id}"`);
    this.name = 'ModpackAccessError';
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

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string; message?: string };
    return data.error || data.message || fallback;
  } catch {
    return fallback;
  }
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

export async function syncUserToServer(payload: {
  userId: string;
  username: string;
  friendCode?: string;
  avatarUrl?: string;
}): Promise<void> {
  try {
    await fetch(`${BASE_URL}/users/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Non-fatal sync
  }
}

export async function deleteAccountApi(userId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/account`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Failed to delete account'));
  }
}

export async function uploadImageFile(file: File): Promise<string> {
  const dataBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });

  const res = await fetch(`${BASE_URL}/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type || 'image/png',
      dataBase64,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Failed to upload image'));
  }

  const data = (await res.json()) as { url: string };
  return data.url;
}

export async function searchMods(
  queryOrOptions: string | SearchFilterOptions,
  loader = 'forge',
  version = '1.21.1'
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
    version: opts.version || '1.21.1',
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
  gameVersion = '1.21.1'
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
  version = '1.21.1'
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

export async function listModpacks(userId?: string, username?: string): Promise<Modpack[]> {
  const params = new URLSearchParams();
  if (userId) params.set('userId', userId);
  if (username) params.set('username', username);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${BASE_URL}/modpacks${query}`);
  if (!res.ok) throw new Error('Failed to list modpacks');
  const data = await res.json();
  return data.modpacks || [];
}

export async function getModpack(
  id: string,
  userId?: string,
  username?: string
): Promise<Modpack> {
  const params = new URLSearchParams();
  if (userId) params.set('userId', userId);
  if (username) params.set('username', username);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${BASE_URL}/modpacks/${id}${query}`);
  if (res.status === 404) {
    throw new ModpackNotFoundError(id);
  }
  if (res.status === 403) {
    throw new ModpackAccessError(id);
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
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to create modpack'));
  return res.json();
}

export async function updateModpack(
  id: string,
  payload: Partial<Modpack> & { userId?: string }
): Promise<Modpack> {
  const res = await fetch(`${BASE_URL}/modpacks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to update modpack'));
  return res.json();
}

export async function addModToPackApi(
  modpackId: string,
  mod: ModItem,
  userId?: string
): Promise<ModItem> {
  const res = await fetch(`${BASE_URL}/modpacks/${modpackId}/mods`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(userId ? { 'x-user-id': userId } : {}),
    },
    body: JSON.stringify(mod),
  });
  if (!res.ok) throw new Error('Failed to add mod to modpack');
  return res.json();
}

export async function removeModFromPackApi(
  modpackId: string,
  modId: string,
  userId?: string
): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/modpacks/${modpackId}/mods/${encodeURIComponent(modId)}`,
    {
      method: 'DELETE',
      headers: userId ? { 'x-user-id': userId } : undefined,
    }
  );
  if (!res.ok) throw new Error('Failed to remove mod from modpack');
}

export async function deleteModpack(id: string, userId?: string): Promise<void> {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  const res = await fetch(`${BASE_URL}/modpacks/${id}${query}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to delete modpack'));
}

export async function sendModpackInvite(
  modpackId: string,
  payload: {
    invitedUser: string;
    invitedUserId?: string;
    invitedBy?: string;
    invitedById?: string;
  }
): Promise<ModpackInvite> {
  const res = await fetch(`${BASE_URL}/modpacks/${modpackId}/invites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to send modpack invite'));
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

export async function listFriends(userId?: string): Promise<FriendItem[]> {
  if (!userId) return [];
  const res = await fetch(`${BASE_URL}/friends?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.friends || [];
}

export async function listFriendRequests(userId?: string): Promise<{
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}> {
  if (!userId) return { incoming: [], outgoing: [] };
  const res = await fetch(`${BASE_URL}/friend-requests?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) return { incoming: [], outgoing: [] };
  return res.json();
}

export async function sendFriendRequest(payload: {
  fromUserId: string;
  fromUsername: string;
  fromFriendCode: string;
  targetFriendCode: string;
}): Promise<FriendRequest> {
  const res = await fetch(`${BASE_URL}/friends/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Failed to send friend request'));
  }
  return res.json();
}

export async function acceptFriendRequest(
  requestId: string,
  userId: string
): Promise<{ request: FriendRequest; friend: FriendItem }> {
  const res = await fetch(`${BASE_URL}/friend-requests/${requestId}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Failed to accept friend request'));
  }
  return res.json();
}

export async function declineFriendRequest(
  requestId: string,
  userId: string
): Promise<{ request: FriendRequest }> {
  const res = await fetch(`${BASE_URL}/friend-requests/${requestId}/decline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Failed to decline friend request'));
  }
  return res.json();
}

export async function removeFriend(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/friends/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to remove friend');
}
