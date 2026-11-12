import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from '../lib/supabase.js';
import type { FriendRequest, ModpackInvite } from '../types/consts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(val?: string | null): boolean {
  return Boolean(val && UUID_REGEX.test(val.trim()));
}

export function computeFriendCode(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const num = 1000 + (Math.abs(hash) % 9000);
  return `MCMC-${num}`;
}

export interface DirectoryUser {
  userId: string;
  username: string;
  friendCode: string;
  avatarUrl: string;
  email?: string;
}

export interface FriendshipRecord {
  id: string;
  userAId: string;
  userBId: string;
  createdAt: string;
}

interface PersistedState {
  users: Record<string, DirectoryUser>;
  friendRequests: FriendRequest[];
  friendships: FriendshipRecord[];
  modpackInvites: ModpackInvite[];
  modpackImages: Record<string, string>;
}

const DEFAULT_STORE_PATH = path.resolve(__dirname, '../../.data/store.json');

function getStorePath(): string {
  return process.env.MCMC_STORE_PATH || DEFAULT_STORE_PATH;
}

let state: PersistedState = {
  users: {},
  friendRequests: [],
  friendships: [],
  modpackInvites: [],
  modpackImages: {},
};

let loadedFromPath: string | null = null;

export function loadStore(forceReload = false): PersistedState {
  const storePath = getStorePath();
  if (!forceReload && loadedFromPath === storePath) {
    return state;
  }

  try {
    if (fs.existsSync(storePath)) {
      const raw = fs.readFileSync(storePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      state = {
        users: parsed.users || {},
        friendRequests: Array.isArray(parsed.friendRequests) ? parsed.friendRequests : [],
        friendships: Array.isArray(parsed.friendships) ? parsed.friendships : [],
        modpackInvites: Array.isArray(parsed.modpackInvites) ? parsed.modpackInvites : [],
        modpackImages: parsed.modpackImages || {},
      };
    } else {
      state = {
        users: {},
        friendRequests: [],
        friendships: [],
        modpackInvites: [],
        modpackImages: {},
      };
    }
  } catch (err) {
    console.warn('Could not read persisted store, starting fresh:', err);
  }

  loadedFromPath = storePath;
  return state;
}

export function saveStore(): void {
  const storePath = getStorePath();
  try {
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    fs.writeFileSync(storePath, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not persist store:', err);
  }
}

export function resetStoreForTests(): void {
  state = {
    users: {},
    friendRequests: [],
    friendships: [],
    modpackInvites: [],
    modpackImages: {},
  };
  loadedFromPath = getStorePath();
  if (fs.existsSync(loadedFromPath)) {
    fs.unlinkSync(loadedFromPath);
  }
}

// Supabase user directory cache
const supabaseUsersCache = new Map<string, DirectoryUser>();
let lastSupabaseSyncAt = 0;
const CACHE_TTL_MS = 5000;

function extractSupabaseUser(u: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}): DirectoryUser {
  const meta = u.user_metadata || {};
  const emailPrefix = u.email ? u.email.split('@')[0] : undefined;
  const username = String(
    meta.full_name || meta.name || meta.user_name || meta.preferred_username || emailPrefix || 'Crafter'
  ).trim();
  const avatarUrl = String(meta.avatar_url || meta.picture || '/MCMC.png');
  return {
    userId: u.id,
    username,
    friendCode: computeFriendCode(u.id),
    avatarUrl,
    email: u.email,
  };
}

export async function syncSupabaseUsers(force = false): Promise<Map<string, DirectoryUser>> {
  loadStore();
  if (!supabase) return supabaseUsersCache;

  const now = Date.now();
  if (!force && supabaseUsersCache.size > 0 && now - lastSupabaseSyncAt < CACHE_TTL_MS) {
    return supabaseUsersCache;
  }

  try {
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (!error && data?.users) {
      supabaseUsersCache.clear();
      for (const u of data.users) {
        const entry = extractSupabaseUser(u);
        supabaseUsersCache.set(entry.userId, entry);
        // Keep synced local cache updated with authoritative Supabase metadata
        state.users[entry.userId] = {
          ...state.users[entry.userId],
          ...entry,
        };
      }
      lastSupabaseSyncAt = now;
      saveStore();
    }
  } catch (err) {
    console.warn('Failed to list Supabase users:', err);
  }

  return supabaseUsersCache;
}

export function upsertDirectoryUser(input: {
  userId: string;
  username: string;
  friendCode?: string;
  avatarUrl?: string;
}): DirectoryUser {
  loadStore();
  const existing = state.users[input.userId];
  const entry: DirectoryUser = {
    userId: input.userId,
    username: input.username.trim() || existing?.username || 'Crafter',
    friendCode: (input.friendCode || existing?.friendCode || computeFriendCode(input.userId)).toUpperCase(),
    avatarUrl: input.avatarUrl || existing?.avatarUrl || '/MCMC.png',
    email: existing?.email,
  };
  state.users[input.userId] = entry;
  if (supabaseUsersCache.has(input.userId)) {
    supabaseUsersCache.set(input.userId, entry);
  }
  saveStore();
  return entry;
}

export function getAllDirectoryUsers(): DirectoryUser[] {
  loadStore();
  const combined = new Map<string, DirectoryUser>();
  for (const [id, u] of Object.entries(state.users)) {
    combined.set(id, u);
  }
  for (const [id, u] of supabaseUsersCache.entries()) {
    combined.set(id, { ...combined.get(id), ...u });
  }
  return Array.from(combined.values());
}

export async function findDirectoryUserById(userId: string): Promise<DirectoryUser | null> {
  loadStore();
  const trimmed = userId.trim();
  if (!trimmed) return null;

  await syncSupabaseUsers(false);
  const direct = supabaseUsersCache.get(trimmed) || state.users[trimmed];
  if (direct) return direct;

  if (supabase && isUuid(trimmed)) {
    try {
      const { data, error } = await supabase.auth.admin.getUserById(trimmed);
      if (!error && data?.user) {
        const extracted = extractSupabaseUser(data.user);
        supabaseUsersCache.set(extracted.userId, extracted);
        state.users[extracted.userId] = extracted;
        saveStore();
        return extracted;
      }
    } catch {
      // ignore lookup error
    }
  }

  return null;
}

export async function findDirectoryUserByFriendCode(friendCode: string): Promise<DirectoryUser | null> {
  loadStore();
  const target = friendCode.trim().toUpperCase();
  if (!target) return null;

  await syncSupabaseUsers(false);
  let match = getAllDirectoryUsers().find((u) => u.friendCode.toUpperCase() === target);
  if (!match && supabase) {
    await syncSupabaseUsers(true);
    match = getAllDirectoryUsers().find((u) => u.friendCode.toUpperCase() === target);
  }
  return match || null;
}

export async function findDirectoryUser(identifier: string): Promise<DirectoryUser | null> {
  loadStore();
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  if (isUuid(trimmed)) {
    return findDirectoryUserById(trimmed);
  }

  await syncSupabaseUsers(false);
  const upper = trimmed.toUpperCase();
  const lower = trimmed.toLowerCase();

  let users = getAllDirectoryUsers();
  let match =
    users.find((u) => u.friendCode.toUpperCase() === upper) ||
    users.find((u) => u.userId.toLowerCase() === lower) ||
    users.find((u) => u.username.toLowerCase() === lower);

  if (!match && supabase) {
    await syncSupabaseUsers(true);
    users = getAllDirectoryUsers();
    match =
      users.find((u) => u.friendCode.toUpperCase() === upper) ||
      users.find((u) => u.userId.toLowerCase() === lower) ||
      users.find((u) => u.username.toLowerCase() === lower);
  }

  return match || null;
}

/**
 * Resolves a contributor identifier (which may be a Supabase UUID or a username)
 * into a human-readable username. Returns null if it's an unresolvable UUID so
 * raw UUIDs are never leaked into the UI collaborator list.
 */
export async function resolveContributorDisplayName(idOrName: string): Promise<string | null> {
  const trimmed = (idOrName || '').trim();
  if (!trimmed) return null;

  if (isUuid(trimmed)) {
    const user = await findDirectoryUserById(trimmed);
    return user ? user.username : null;
  }

  const byId = await findDirectoryUserById(trimmed);
  if (byId) return byId.username;

  return trimmed;
}

export function removeUserFromStore(userId: string): void {
  loadStore();
  delete state.users[userId];
  supabaseUsersCache.delete(userId);
  state.friendRequests = state.friendRequests.filter(
    (r) => r.fromUserId !== userId && r.toUserId !== userId
  );
  state.friendships = state.friendships.filter(
    (f) => f.userAId !== userId && f.userBId !== userId
  );
  state.modpackInvites = state.modpackInvites.filter(
    (inv) => inv.invitedUserId !== userId
  );
  saveStore();
}
