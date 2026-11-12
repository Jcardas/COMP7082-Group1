import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Request, Response } from 'express';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcmc-test-'));
process.env.MCMC_STORE_PATH = path.join(tempDir, 'store.json');

vi.mock('../lib/supabase.js', () => ({
  supabase: null,
}));

vi.mock('../lib/huggingface.js', () => ({
  isConfigured: false,
  generateEmbedding: vi.fn(async () => null),
}));

import {
  acceptFriendRequest,
  acceptModpackInvite,
  addModToModpack,
  commentOnMod,
  createModpack,
  deleteAccount,
  deleteModpack,
  getModpackById,
  inMemoryModpacks,
  inviteCollaboratorToModpack,
  listFriendRequests,
  listFriends,
  listModpackInvites,
  listModpacks,
  removeModFromModpack,
  sendFriendRequest,
  syncUser,
  updateModpack,
  uploadImage,
  voteOnMod,
} from '../controllers/modpackController.js';
import { createModpackSchema } from '../schemas/modpackSchemas.js';
import {
  computeFriendCode,
  getModFeedback,
  resetStoreForTests,
  resolveContributorDisplayName,
} from '../services/dataStore.js';

interface MockResponseState {
  statusCode: number;
  body: unknown;
}

function createMockRes() {
  const state: MockResponseState = { statusCode: 200, body: undefined };
  const res = {
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    json(data: unknown) {
      state.body = data;
      return this;
    },
    send(data?: unknown) {
      state.body = data;
      return this;
    },
  } as unknown as Response;
  return { res, state };
}

function createMockReq(opts: {
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  query?: Record<string, string>;
  headers?: Record<string, string>;
} = {}): Request {
  return {
    body: opts.body || {},
    params: opts.params || {},
    query: opts.query || {},
    headers: opts.headers || {},
  } as unknown as Request;
}

const ALICE_ID = '11111111-1111-4111-8111-111111111111';
const BOB_ID = '22222222-2222-4222-8222-222222222222';
const CHARLIE_ID = '33333333-3333-4333-8333-333333333333';
const LEGACY_UUID = '231a6b00-2238-4798-a63e-5e95c6c0f8e2';

describe('Social, Permissions, UUID Resolution & Upload Flows', () => {
  beforeEach(() => {
    resetStoreForTests();
    inMemoryModpacks.clear();

    // Register Alice and Bob in the directory
    syncUser(
      createMockReq({
        body: {
          userId: ALICE_ID,
          username: 'AliceCrafter',
          friendCode: computeFriendCode(ALICE_ID),
          avatarUrl: '/MCMC.png',
        },
      }),
      createMockRes().res
    );

    syncUser(
      createMockReq({
        body: {
          userId: BOB_ID,
          username: 'BobBuilder',
          friendCode: computeFriendCode(BOB_ID),
          avatarUrl: '/MCMC.png',
        },
      }),
      createMockRes().res
    );

    syncUser(
      createMockReq({
        body: {
          userId: CHARLIE_ID,
          username: 'CharlieMiner',
          friendCode: computeFriendCode(CHARLIE_ID),
          avatarUrl: '/MCMC.png',
        },
      }),
      createMockRes().res
    );
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('defaults minecraftVersion to 1.21.1 in createModpackSchema', () => {
    const parsed = createModpackSchema.parse({
      title: 'Default Version Pack',
      modLoader: 'fabric',
      createdBy: ALICE_ID,
    });
    expect(parsed.minecraftVersion).toBe('1.21.1');
  });

  it('sends a friend request without auto-adding, and shows usernames after acceptance', async () => {
    const bobCode = computeFriendCode(BOB_ID);

    // 1. Alice sends friend request to Bob using Bob's friend code
    const sendRes = createMockRes();
    await sendFriendRequest(
      createMockReq({
        body: {
          fromUserId: ALICE_ID,
          fromUsername: 'AliceCrafter',
          targetFriendCode: bobCode,
        },
      }),
      sendRes.res
    );
    expect(sendRes.state.statusCode).toBe(201);
    const reqObj = sendRes.state.body as { id: string; status: string };
    expect(reqObj.status).toBe('pending');

    // 2. Neither Alice nor Bob are friends yet
    const aliceFriendsBefore = createMockRes();
    await listFriends(createMockReq({ query: { userId: ALICE_ID } }), aliceFriendsBefore.res);
    expect((aliceFriendsBefore.state.body as { friends: unknown[] }).friends).toHaveLength(0);

    const bobFriendsBefore = createMockRes();
    await listFriends(createMockReq({ query: { userId: BOB_ID } }), bobFriendsBefore.res);
    expect((bobFriendsBefore.state.body as { friends: unknown[] }).friends).toHaveLength(0);

    // 3. Pending request appears in Bob's incoming and Alice's outgoing
    const bobReqs = createMockRes();
    await listFriendRequests(createMockReq({ query: { userId: BOB_ID } }), bobReqs.res);
    expect((bobReqs.state.body as { incoming: unknown[]; outgoing: unknown[] }).incoming).toHaveLength(1);

    // 4. Bob accepts the friend request
    const acceptRes = createMockRes();
    await acceptFriendRequest(
      createMockReq({
        params: { id: reqObj.id },
        body: { userId: BOB_ID },
      }),
      acceptRes.res
    );
    expect(acceptRes.state.statusCode).toBe(200);

    // 5. Friends list shows username (not friend code)
    const aliceFriendsAfter = createMockRes();
    await listFriends(createMockReq({ query: { userId: ALICE_ID } }), aliceFriendsAfter.res);
    const aliceList = (aliceFriendsAfter.state.body as { friends: Array<{ username: string; friendCode: string }> }).friends;
    expect(aliceList).toHaveLength(1);
    expect(aliceList[0].username).toBe('BobBuilder');
    expect(aliceList[0].username).not.toBe(bobCode);

    const bobFriendsAfter = createMockRes();
    await listFriends(createMockReq({ query: { userId: BOB_ID } }), bobFriendsAfter.res);
    const bobList = (bobFriendsAfter.state.body as { friends: Array<{ username: string }> }).friends;
    expect(bobList).toHaveLength(1);
    expect(bobList[0].username).toBe('AliceCrafter');
  });

  it('isolates modpack visibility to creators and accepted collaborators, and grants edit access after invite accept', async () => {
    const bobCode = computeFriendCode(BOB_ID);

    // 1. Alice creates a modpack
    const createRes = createMockRes();
    await createModpack(
      createMockReq({
        body: {
          title: 'Secret Skyblock',
          modLoader: 'fabric',
          createdBy: ALICE_ID,
          creatorName: 'AliceCrafter',
        },
      }),
      createRes.res
    );
    expect(createRes.state.statusCode).toBe(201);
    const createdPack = createRes.state.body as { id: string; minecraftVersion: string; contributors: string[] };
    expect(createdPack.minecraftVersion).toBe('1.21.1');
    expect(createdPack.contributors).toEqual(['AliceCrafter']);

    // 2. Alice sees it; Bob and Charlie do NOT
    const alicePacks = createMockRes();
    await listModpacks(createMockReq({ query: { userId: ALICE_ID } }), alicePacks.res);
    expect((alicePacks.state.body as { modpacks: unknown[] }).modpacks).toHaveLength(1);

    const bobPacksBefore = createMockRes();
    await listModpacks(createMockReq({ query: { userId: BOB_ID } }), bobPacksBefore.res);
    expect((bobPacksBefore.state.body as { modpacks: unknown[] }).modpacks).toHaveLength(0);

    // 3. Direct access and edits by Bob are rejected with 403 before invite acceptance
    const bobGetBefore = createMockRes();
    await getModpackById(
      createMockReq({ params: { id: createdPack.id }, query: { userId: BOB_ID } }),
      bobGetBefore.res
    );
    expect(bobGetBefore.state.statusCode).toBe(403);

    const bobEditBefore = createMockRes();
    await updateModpack(
      createMockReq({
        params: { id: createdPack.id },
        body: { title: 'Hacked Title', userId: BOB_ID },
      }),
      bobEditBefore.res
    );
    expect(bobEditBefore.state.statusCode).toBe(403);

    // 4. Alice invites Bob by friend code
    const inviteRes = createMockRes();
    await inviteCollaboratorToModpack(
      createMockReq({
        params: { id: createdPack.id },
        body: {
          invitedUser: bobCode,
          invitedBy: 'AliceCrafter',
          invitedById: ALICE_ID,
        },
      }),
      inviteRes.res
    );
    expect(inviteRes.state.statusCode).toBe(201);
    const invite = inviteRes.state.body as { id: string; invitedUser: string; invitedFriendCode: string };
    expect(invite.invitedUser).toBe('BobBuilder');
    expect(invite.invitedFriendCode).toBe(bobCode);

    // 5. Invite appears for Bob, NOT for Charlie or unauthenticated requests
    const unauthInvites = createMockRes();
    listModpackInvites(createMockReq({}), unauthInvites.res);
    expect((unauthInvites.state.body as { invites: unknown[] }).invites).toHaveLength(0);

    const charlieInvites = createMockRes();
    listModpackInvites(
      createMockReq({ query: { userId: CHARLIE_ID, user: 'CharlieMiner', friendCode: computeFriendCode(CHARLIE_ID) } }),
      charlieInvites.res
    );
    expect((charlieInvites.state.body as { invites: unknown[] }).invites).toHaveLength(0);

    const bobInvites = createMockRes();
    listModpackInvites(
      createMockReq({ query: { userId: BOB_ID, user: 'BobBuilder', friendCode: bobCode } }),
      bobInvites.res
    );
    expect((bobInvites.state.body as { invites: unknown[] }).invites).toHaveLength(1);

    // 6. Bob accepts invite -> now he can list, view, and edit the modpack
    const acceptRes = createMockRes();
    await acceptModpackInvite(
      createMockReq({
        params: { inviteId: invite.id },
        body: { userId: BOB_ID, username: 'BobBuilder' },
      }),
      acceptRes.res
    );
    expect(acceptRes.state.statusCode).toBe(200);

    const bobPacksAfter = createMockRes();
    await listModpacks(createMockReq({ query: { userId: BOB_ID } }), bobPacksAfter.res);
    expect((bobPacksAfter.state.body as { modpacks: unknown[] }).modpacks).toHaveLength(1);

    const bobAddModRes = createMockRes();
    await addModToModpack(
      createMockReq({
        params: { id: createdPack.id },
        body: {
          userId: BOB_ID,
          id: 'modrinth-AANobbMI',
          source: 'modrinth',
          externalModId: 'AANobbMI',
          name: 'Sodium',
          summary: 'Fast rendering',
        },
      }),
      bobAddModRes.res
    );
    expect(bobAddModRes.state.statusCode).toBe(201);

    const bobGetAfter = createMockRes();
    await getModpackById(
      createMockReq({ params: { id: createdPack.id }, query: { userId: BOB_ID } }),
      bobGetAfter.res
    );
    expect(bobGetAfter.state.statusCode).toBe(200);
    const hydratedPack = bobGetAfter.state.body as { contributors: string[]; mods: unknown[] };
    expect(hydratedPack.contributors).toContain('AliceCrafter');
    expect(hydratedPack.contributors).toContain('BobBuilder');
    expect(hydratedPack.mods).toHaveLength(1);

    // 7. Non-owner (Bob) cannot delete pack, owner (Alice) can
    const bobDeleteRes = createMockRes();
    await deleteModpack(
      createMockReq({ params: { id: createdPack.id }, query: { userId: BOB_ID } }),
      bobDeleteRes.res
    );
    expect(bobDeleteRes.state.statusCode).toBe(403);

    const aliceDeleteRes = createMockRes();
    await deleteModpack(
      createMockReq({ params: { id: createdPack.id }, query: { userId: ALICE_ID } }),
      aliceDeleteRes.res
    );
    expect(aliceDeleteRes.state.statusCode).toBe(204);
  });

  it('persists mod votes and comments consistently across reloads, updates, and toggle states', async () => {
    const createRes = createMockRes();
    await createModpack(
      createMockReq({
        body: {
          title: 'Feedback Persistence Pack',
          modLoader: 'fabric',
          createdBy: ALICE_ID,
          creatorName: 'AliceCrafter',
        },
      }),
      createRes.res
    );
    const pack = createRes.state.body as { id: string };

    const addModRes = createMockRes();
    await addModToModpack(
      createMockReq({
        params: { id: pack.id },
        headers: { 'x-user-id': ALICE_ID },
        body: {
          id: 'modrinth-AANobbMI',
          source: 'modrinth',
          externalModId: 'AANobbMI',
          name: 'Sodium',
          summary: 'Rendering optimization',
          votes: { yes: ['AliceCrafter'], no: [] },
          comments: [],
        },
      }),
      addModRes.res
    );
    expect(addModRes.state.statusCode).toBe(201);

    // Unauthorized user (Charlie) is blocked from voting/commenting
    const unauthVote = createMockRes();
    await voteOnMod(
      createMockReq({
        params: { id: pack.id, modId: 'modrinth-AANobbMI' },
        headers: { 'x-user-id': CHARLIE_ID },
        body: { vote: 'no', user: 'CharlieMiner', userId: CHARLIE_ID, actorUserId: CHARLIE_ID },
      }),
      unauthVote.res
    );
    expect(unauthVote.state.statusCode).toBe(403);

    const unauthComment = createMockRes();
    await commentOnMod(
      createMockReq({
        params: { id: pack.id, modId: 'modrinth-AANobbMI' },
        headers: { 'x-user-id': CHARLIE_ID },
        body: { text: 'Intruder comment', user: 'CharlieMiner', actorUserId: CHARLIE_ID },
      }),
      unauthComment.res
    );
    expect(unauthComment.state.statusCode).toBe(403);

    // Alice votes NO (switches from initial YES -> NO)
    const switchVoteRes = createMockRes();
    await voteOnMod(
      createMockReq({
        params: { id: pack.id, modId: 'modrinth-AANobbMI' },
        headers: { 'x-user-id': ALICE_ID },
        body: { vote: 'no', user: 'AliceCrafter', userId: ALICE_ID },
      }),
      switchVoteRes.res
    );
    expect(switchVoteRes.state.statusCode).toBe(200);
    expect((switchVoteRes.state.body as { votes: { yes: string[]; no: string[] } }).votes).toEqual({
      yes: [],
      no: ['AliceCrafter'],
    });

    // Alice toggles NO off, then votes YES again
    await voteOnMod(
      createMockReq({
        params: { id: pack.id, modId: 'modrinth-AANobbMI' },
        headers: { 'x-user-id': ALICE_ID },
        body: { vote: 'no', user: 'AliceCrafter', userId: ALICE_ID },
      }),
      createMockRes().res
    );
    const yesVoteRes = createMockRes();
    await voteOnMod(
      createMockReq({
        params: { id: pack.id, modId: 'modrinth-AANobbMI' },
        headers: { 'x-user-id': ALICE_ID },
        body: { vote: 'yes', user: 'AliceCrafter', userId: ALICE_ID },
      }),
      yesVoteRes.res
    );
    expect((yesVoteRes.state.body as { votes: { yes: string[]; no: string[] } }).votes).toEqual({
      yes: ['AliceCrafter'],
      no: [],
    });

    // Alice posts a comment (and duplicate comment ID is ignored)
    const commentRes1 = createMockRes();
    await commentOnMod(
      createMockReq({
        params: { id: pack.id, modId: 'modrinth-AANobbMI' },
        headers: { 'x-user-id': ALICE_ID },
        body: {
          id: 'comment-persistent-1',
          text: 'Keep Sodium for FPS!',
          user: 'AliceCrafter',
          createdAt: '2026-11-12T10:00:00.000Z',
        },
      }),
      commentRes1.res
    );
    expect(commentRes1.state.statusCode).toBe(201);

    await commentOnMod(
      createMockReq({
        params: { id: pack.id, modId: 'modrinth-AANobbMI' },
        headers: { 'x-user-id': ALICE_ID },
        body: {
          id: 'comment-persistent-1',
          text: 'Keep Sodium for FPS!',
          user: 'AliceCrafter',
          createdAt: '2026-11-12T10:00:00.000Z',
        },
      }),
      createMockRes().res
    );

    // PATCH update with blank votes/comments preserves stored feedback
    const patchRes = createMockRes();
    await updateModpack(
      createMockReq({
        params: { id: pack.id },
        body: {
          userId: ALICE_ID,
          mods: [
            {
              id: 'modrinth-AANobbMI',
              source: 'modrinth',
              externalModId: 'AANobbMI',
              name: 'Sodium',
              summary: 'Rendering optimization',
            },
          ],
        },
      }),
      patchRes.res
    );
    expect(patchRes.state.statusCode).toBe(200);

    // Re-fetching via getModpackById and checking store preserves exact votes & single deduplicated comment
    const getRes = createMockRes();
    await getModpackById(
      createMockReq({ params: { id: pack.id }, query: { userId: ALICE_ID } }),
      getRes.res
    );
    expect(getRes.state.statusCode).toBe(200);
    const fetched = getRes.state.body as {
      mods: Array<{
        id: string;
        votes: { yes: string[]; no: string[] };
        comments: Array<{ id: string; user: string; text: string }>;
      }>;
    };
    expect(fetched.mods[0].votes).toEqual({ yes: ['AliceCrafter'], no: [] });
    expect(fetched.mods[0].comments).toHaveLength(1);
    expect(fetched.mods[0].comments[0].text).toBe('Keep Sodium for FPS!');

    // Persisted feedback exists in store.json
    const persisted = getModFeedback(pack.id, 'modrinth-AANobbMI', 'modrinth', 'AANobbMI');
    expect(persisted?.votes).toEqual({ yes: ['AliceCrafter'], no: [] });
    expect(persisted?.comments).toHaveLength(1);

    // Removing the mod cleans up its feedback record
    await removeModFromModpack(
      createMockReq({
        params: { id: pack.id, modId: 'modrinth-AANobbMI' },
        headers: { 'x-user-id': ALICE_ID },
      }),
      createMockRes().res
    );
    expect(getModFeedback(pack.id, 'modrinth-AANobbMI', 'modrinth', 'AANobbMI')).toBeNull();
  });

  it('never leaks raw UUIDs like 231a6b00-2238-4798-a63e-5e95c6c0f8e2 as collaborator names', async () => {
    // Unknown UUID resolves to null instead of leaking the raw UUID string
    expect(await resolveContributorDisplayName(LEGACY_UUID)).toBeNull();

    // Updating contributors with raw UUID drops unresolvable UUIDs and resolves known UUIDs to usernames
    const createRes = createMockRes();
    await createModpack(
      createMockReq({
        body: {
          title: 'Clean Contributors',
          modLoader: 'forge',
          createdBy: ALICE_ID,
          creatorName: 'AliceCrafter',
        },
      }),
      createRes.res
    );
    const pack = createRes.state.body as { id: string };

    const updateRes = createMockRes();
    await updateModpack(
      createMockReq({
        params: { id: pack.id },
        body: {
          userId: ALICE_ID,
          contributors: [ALICE_ID, BOB_ID, LEGACY_UUID],
        },
      }),
      updateRes.res
    );
    const updated = updateRes.state.body as { contributors: string[] };
    expect(updated.contributors).toEqual(['AliceCrafter', 'BobBuilder']);
    expect(updated.contributors).not.toContain(LEGACY_UUID);

    // Once registered, the UUID resolves cleanly to its username
    syncUser(
      createMockReq({
        body: { userId: LEGACY_UUID, username: 'ascendyatta' },
      }),
      createMockRes().res
    );
    expect(await resolveContributorDisplayName(LEGACY_UUID)).toBe('ascendyatta');
  });

  it('validates and stores uploaded image files', async () => {
    const badRes = createMockRes();
    await uploadImage(
      createMockReq({
        body: {
          filename: 'malware.exe',
          mimeType: 'application/octet-stream',
          dataBase64: Buffer.from('abc').toString('base64'),
        },
      }),
      badRes.res
    );
    expect(badRes.state.statusCode).toBe(400);

    // 1x1 transparent PNG
    const png1x1 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const okRes = createMockRes();
    await uploadImage(
      createMockReq({
        body: {
          filename: 'pack-cover.png',
          mimeType: 'image/png',
          dataBase64: `data:image/png;base64,${png1x1}`,
        },
      }),
      okRes.res
    );
    expect(okRes.state.statusCode).toBe(201);
    const url = (okRes.state.body as { url: string }).url;
    expect(url).toMatch(/^\/api\/uploads\/.*pack-cover\.png$/);

    // Clean up uploaded disk file created during unit test
    const localFile = path.resolve(
      process.cwd(),
      'server/uploads',
      path.basename(url)
    );
    if (fs.existsSync(localFile)) {
      fs.unlinkSync(localFile);
    }
  });

  it('cleans up user friendships and requests when deleting account', async () => {
    const bobCode = computeFriendCode(BOB_ID);
    const sendRes = createMockRes();
    await sendFriendRequest(
      createMockReq({
        body: { fromUserId: ALICE_ID, targetFriendCode: bobCode },
      }),
      sendRes.res
    );
    const reqId = (sendRes.state.body as { id: string }).id;
    await acceptFriendRequest(
      createMockReq({ params: { id: reqId }, body: { userId: BOB_ID } }),
      createMockRes().res
    );

    const delRes = createMockRes();
    await deleteAccount(createMockReq({ query: { userId: ALICE_ID } }), delRes.res);
    expect(delRes.state.statusCode).toBe(200);
    expect((delRes.state.body as { deleted: boolean }).deleted).toBe(true);

    const bobFriends = createMockRes();
    await listFriends(createMockReq({ query: { userId: BOB_ID } }), bobFriends.res);
    expect((bobFriends.state.body as { friends: unknown[] }).friends).toHaveLength(0);
  });
});
