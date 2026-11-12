import { useCallback, useEffect, useState } from 'react';
import {
  acceptFriendRequest as apiAcceptFriendRequest,
  acceptModpackInvite as apiAcceptInvite,
  addModToPackApi,
  createModpack as apiCreateModpack,
  declineFriendRequest as apiDeclineFriendRequest,
  declineModpackInvite as apiDeclineInvite,
  deleteModpack as apiDeleteModpack,
  getModpack,
  getRecommendations,
  listFriendRequests,
  listFriends,
  listModpackInvites,
  listModpacks,
  ModpackAccessError,
  ModpackNotFoundError,
  removeFriend as apiRemoveFriend,
  removeModFromPackApi,
  resolveModDependencies,
  searchMods,
  type SearchFilterOptions,
  sendFriendRequest as apiSendFriendRequest,
  sendModpackInvite,
  updateModpack as apiUpdateModpack,
} from '../services/api';
import { socket } from '../services/socket';
import type {
  FriendItem,
  FriendRequest,
  ModComment,
  ModItem,
  Modpack,
  ModpackInvite,
} from '../types/consts';

const INITIAL_TIMESTAMP = '2026-01-01T00:00:00.000Z';

function toggleUserVote(votes: { yes: string[]; no: string[] }, user: string, vote: 'yes' | 'no') {
  let newYes = [...votes.yes];
  let newNo = [...votes.no];

  if (vote === 'yes') {
    if (newYes.includes(user)) {
      newYes = newYes.filter((u) => u !== user);
    } else {
      newYes.push(user);
      newNo = newNo.filter((u) => u !== user);
    }
  } else {
    if (newNo.includes(user)) {
      newNo = newNo.filter((u) => u !== user);
    } else {
      newNo.push(user);
      newYes = newYes.filter((u) => u !== user);
    }
  }

  return { yes: newYes, no: newNo };
}

export function useModpack(
  modpackId = '',
  currentUser = 'Crafter',
  currentUserId = '',
  currentFriendCode = ''
) {
  const [modpacks, setModpacks] = useState<Modpack[]>([]);
  const [modpacksLoaded, setModpacksLoaded] = useState<boolean>(false);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [incomingFriendRequests, setIncomingFriendRequests] = useState<FriendRequest[]>([]);
  const [outgoingFriendRequests, setOutgoingFriendRequests] = useState<FriendRequest[]>([]);
  const [invites, setInvites] = useState<ModpackInvite[]>([]);
  const [notFoundModpackId, setNotFoundModpackId] = useState<string | null>(null);
  const [accessDeniedModpackId, setAccessDeniedModpackId] = useState<string | null>(null);

  const [modpack, setModpack] = useState<Modpack>(() => ({
    id: modpackId,
    title: 'New Modpack',
    description: 'Collaborative Minecraft modpack workspace',
    imageUrl: '/MCMC.png',
    contributors: [],
    pendingInvites: [],
    minecraftVersion: '1.21.1',
    modLoader: 'forge',
    mods: [],
    createdAt: INITIAL_TIMESTAMP,
    updatedAt: INITIAL_TIMESTAMP,
  }));

  const [selectedLoader, setSelectedLoader] = useState<string>('forge');
  const [selectedVersion, setSelectedVersion] = useState<string>('1.21.1');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<'both' | 'modrinth' | 'curseforge'>('both');
  const [searchPage, setSearchPage] = useState<number>(1);
  const [searchTotal, setSearchTotal] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [searchResults, setSearchResults] = useState<ModItem[]>([]);
  const [searchSource, setSearchSource] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);

  const [recommendations, setRecommendations] = useState<ModItem[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState<boolean>(false);

  const handleSearch = useCallback(
    async (
      queryOrOptions: string | SearchFilterOptions,
      loader = selectedLoader,
      version = selectedVersion
    ) => {
      setIsSearching(true);
      try {
        const opts: SearchFilterOptions =
          typeof queryOrOptions === 'string'
            ? {
                query: queryOrOptions,
                loader,
                version,
                category: selectedCategory,
                source: selectedSource,
                page: 1,
                limit: 10,
              }
            : {
                query: queryOrOptions.query ?? searchQuery,
                loader: queryOrOptions.loader ?? selectedLoader,
                version: queryOrOptions.version ?? selectedVersion,
                category: queryOrOptions.category ?? selectedCategory,
                source: queryOrOptions.source ?? selectedSource,
                page: queryOrOptions.page ?? searchPage,
                limit: queryOrOptions.limit ?? 10,
              };

        setSearchQuery(opts.query || '');
        if (opts.loader) setSelectedLoader(opts.loader);
        if (opts.version) setSelectedVersion(opts.version);
        if (opts.category) setSelectedCategory(opts.category);
        if (opts.source) setSelectedSource(opts.source);
        if (opts.page) setSearchPage(opts.page);

        const data = await searchMods(opts);
        setSearchResults(data.results);
        setSearchSource(data.source);
        setSearchTotal(data.total ?? data.results.length);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    },
    [searchPage, searchQuery, selectedCategory, selectedLoader, selectedSource, selectedVersion]
  );

  const fetchRecommendations = useCallback(async () => {
    setIsLoadingRecs(true);
    try {
      const recs = await getRecommendations(modpack.mods, modpack.modLoader, modpack.minecraftVersion);
      setRecommendations(recs);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
    } finally {
      setIsLoadingRecs(false);
    }
  }, [modpack.minecraftVersion, modpack.modLoader, modpack.mods]);

  const refreshInvites = useCallback(async () => {
    if (!currentUserId && !currentFriendCode && !currentUser) return;
    try {
      const list = await listModpackInvites({
        user: currentUser,
        friendCode: currentFriendCode,
        userId: currentUserId,
      });
      setInvites(list);
    } catch (err) {
      console.warn('Could not fetch invites:', err);
    }
  }, [currentFriendCode, currentUser, currentUserId]);

  const refreshSocialAndPacks = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const [packs, friendsList, reqs, inviteList] = await Promise.all([
        listModpacks(currentUserId, currentUser),
        listFriends(currentUserId),
        listFriendRequests(currentUserId),
        listModpackInvites({
          user: currentUser,
          friendCode: currentFriendCode,
          userId: currentUserId,
        }),
      ]);
      setModpacks(packs);
      setModpacksLoaded(true);
      setFriends(friendsList);
      setIncomingFriendRequests(reqs.incoming || []);
      setOutgoingFriendRequests(reqs.outgoing || []);
      setInvites(inviteList);
    } catch (err) {
      console.warn('Background refresh warning:', err);
    }
  }, [currentFriendCode, currentUser, currentUserId]);

  // Initial load of user-scoped modpacks, friends, friend requests, invites, active modpack, and starter search
  useEffect(() => {
    let isMounted = true;

    if (!currentUserId) {
      return () => {
        isMounted = false;
      };
    }

    listModpacks(currentUserId, currentUser)
      .then((packs) => {
        if (isMounted) {
          setModpacks(packs);
          setModpacksLoaded(true);
        }
      })
      .catch((err) => {
        console.warn('Could not list modpacks:', err);
        if (isMounted) setModpacksLoaded(true);
      });

    listFriends(currentUserId)
      .then((list) => {
        if (isMounted) setFriends(list);
      })
      .catch((err) => console.warn('Could not list friends:', err));

    listFriendRequests(currentUserId)
      .then((reqs) => {
        if (isMounted) {
          setIncomingFriendRequests(reqs.incoming || []);
          setOutgoingFriendRequests(reqs.outgoing || []);
        }
      })
      .catch((err) => console.warn('Could not list friend requests:', err));

    listModpackInvites({
      user: currentUser,
      friendCode: currentFriendCode,
      userId: currentUserId,
    })
      .then((list) => {
        if (isMounted) setInvites(list);
      })
      .catch((err) => console.warn('Could not list invites:', err));

    if (!modpackId) {
      searchMods({ query: '', loader: 'forge', version: '1.21.1', page: 1, limit: 10 })
        .then((searchData) => {
          if (isMounted) {
            setSearchResults(searchData.results);
            setSearchSource(searchData.source);
            setSearchTotal(searchData.total ?? searchData.results.length);
          }
        })
        .catch((searchErr) => console.error('Initial search error:', searchErr));

      return () => {
        isMounted = false;
      };
    }

    getModpack(modpackId, currentUserId, currentUser)
      .then((pack) => {
        if (!isMounted || !pack) return;
        setNotFoundModpackId(null);
        setAccessDeniedModpackId(null);
        setModpack(pack);
        setSelectedLoader(pack.modLoader);
        setSelectedVersion(pack.minecraftVersion);
        return searchMods({
          query: '',
          loader: pack.modLoader,
          version: pack.minecraftVersion,
          category: 'all',
          source: 'both',
          page: 1,
          limit: 10,
        });
      })
      .then((searchData) => {
        if (isMounted && searchData) {
          setSearchResults(searchData.results);
          setSearchSource(searchData.source);
          setSearchTotal(searchData.total ?? searchData.results.length);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        if (err instanceof ModpackNotFoundError) {
          setNotFoundModpackId(modpackId);
          return;
        }
        if (err instanceof ModpackAccessError) {
          setAccessDeniedModpackId(modpackId);
          return;
        }
        console.warn('Could not fetch modpack from server, loading default starter search:', err);
        searchMods({ query: '', loader: 'forge', version: '1.21.1', page: 1, limit: 10 })
          .then((searchData) => {
            if (isMounted) {
              setSearchResults(searchData.results);
              setSearchSource(searchData.source);
              setSearchTotal(searchData.total ?? searchData.results.length);
            }
          })
          .catch((searchErr) => console.error('Initial search error:', searchErr));
      });

    return () => {
      isMounted = false;
    };
  }, [modpackId, currentUser, currentUserId, currentFriendCode]);

  // Periodic polling to sync incoming friend requests, accepted friends, and modpack invites
  useEffect(() => {
    if (!currentUserId) return;
    const interval = setInterval(() => {
      void refreshSocialAndPacks();
    }, 8000);
    return () => clearInterval(interval);
  }, [currentUserId, refreshSocialAndPacks]);

  // Synchronize recommendations dynamically whenever active modpack mods change
  useEffect(() => {
    let isMounted = true;

    getRecommendations(modpack.mods, modpack.modLoader, modpack.minecraftVersion)
      .then((recs) => {
        if (isMounted) {
          setRecommendations(recs);
        }
      })
      .catch((err) => console.error('Error fetching recommendations:', err));

    return () => {
      isMounted = false;
    };
  }, [modpack.minecraftVersion, modpack.modLoader, modpack.mods]);

  // Add mod (automatically resolves & installs required dependencies and persists to modpack_mods)
  const addModToTargetPack = useCallback(
    async (
      mod: ModItem,
      targetModpackId = modpack.id,
      user = currentUser
    ): Promise<{ addedDeps: ModItem[] }> => {
      const targetPack =
        targetModpackId === modpack.id
          ? modpack
          : modpacks.find((p) => p.id === targetModpackId) || modpack;

      const requiredDeps = await resolveModDependencies(
        mod,
        targetPack.modLoader,
        targetPack.minecraftVersion
      );

      const allToAdd: ModItem[] = [mod, ...requiredDeps].map((item) => ({
        ...item,
        addedBy: user,
        votes: item.votes || { yes: [user], no: [] },
        comments: item.comments || [],
      }));

      const mergeMods = (existing: ModItem[]) => {
        const next = [...existing];
        for (const candidate of allToAdd) {
          if (!next.some((m) => m.id === candidate.id || m.externalModId === candidate.externalModId)) {
            next.push(candidate);
          }
        }
        return next;
      };

      const updatedMods = mergeMods(targetPack.mods);

      if (targetModpackId === modpack.id) {
        setModpack((prev) => ({
          ...prev,
          mods: mergeMods(prev.mods),
        }));
      }

      setModpacks((prev) =>
        prev.map((p) => (p.id === targetModpackId ? { ...p, mods: mergeMods(p.mods) } : p))
      );

      for (const item of allToAdd) {
        addModToPackApi(targetModpackId, item, currentUserId).catch(() => {});
        socket.emit('mod_add', {
          modpackId: targetModpackId,
          mod: item,
          user,
        });
      }
      apiUpdateModpack(targetModpackId, { mods: updatedMods, userId: currentUserId }).catch(() => {});

      return { addedDeps: requiredDeps };
    },
    [currentUser, currentUserId, modpack, modpacks]
  );

  const addMod = useCallback(
    (mod: ModItem, user = currentUser) => {
      void addModToTargetPack(mod, modpack.id, user);
    },
    [addModToTargetPack, currentUser, modpack.id]
  );

  const removeMod = useCallback(
    (modId: string, user = currentUser) => {
      setModpack((prev) => {
        const nextMods = prev.mods.filter((m) => m.id !== modId);
        removeModFromPackApi(prev.id, modId, currentUserId).catch(() => {});
        apiUpdateModpack(prev.id, { mods: nextMods, userId: currentUserId }).catch(() => {});
        return {
          ...prev,
          mods: nextMods,
        };
      });

      setModpacks((prev) =>
        prev.map((p) =>
          p.id === modpack.id ? { ...p, mods: p.mods.filter((m) => m.id !== modId) } : p
        )
      );

      socket.emit('mod_remove', {
        modpackId: modpack.id,
        modId,
        user,
      });
    },
    [currentUser, currentUserId, modpack.id]
  );

  const voteMod = useCallback(
    (modId: string, vote: 'yes' | 'no', user = currentUser) => {
      setModpack((prev) => ({
        ...prev,
        mods: prev.mods.map((mod) => {
          if (mod.id !== modId) return mod;
          const currentVotes = mod.votes || { yes: [], no: [] };
          return { ...mod, votes: toggleUserVote(currentVotes, user, vote) };
        }),
      }));

      socket.emit('mod_vote', {
        modpackId: modpack.id,
        modId,
        vote,
        user,
      });
    },
    [currentUser, modpack.id]
  );

  const commentMod = useCallback(
    (modId: string, text: string, user = currentUser) => {
      const newComment: ModComment = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        user,
        text,
        createdAt: new Date().toISOString(),
      };

      setModpack((prev) => ({
        ...prev,
        mods: prev.mods.map((mod) => {
          if (mod.id !== modId) return mod;
          return {
            ...mod,
            comments: [...(mod.comments || []), newComment],
          };
        }),
      }));

      socket.emit('mod_comment', {
        modpackId: modpack.id,
        modId,
        comment: newComment,
      });
    },
    [currentUser, modpack.id]
  );

  // Modpack Project CRUD
  const createNewModpack = useCallback(
    async (payload: {
      title: string;
      description?: string;
      imageUrl?: string;
      contributors?: string[];
      minecraftVersion: string;
      modLoader: Modpack['modLoader'];
    }) => {
      const created = await apiCreateModpack({
        title: payload.title,
        description: payload.description,
        imageUrl: payload.imageUrl,
        pendingInvites: payload.contributors || [],
        minecraftVersion: payload.minecraftVersion || '1.21.1',
        modLoader: payload.modLoader,
        createdBy: currentUserId || currentUser,
        creatorName: currentUser,
      });
      setModpacks((prev) => [created, ...prev]);
      void refreshInvites();
      return created;
    },
    [currentUser, currentUserId, refreshInvites]
  );

  const editModpackProject = useCallback(
    async (
      id: string,
      payload: {
        title?: string;
        imageUrl?: string;
        contributors?: string[];
        pendingInvites?: string[];
      }
    ) => {
      const updated = await apiUpdateModpack(id, { ...payload, userId: currentUserId });
      setModpacks((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
      if (modpack.id === id) {
        setModpack((prev) => ({ ...prev, ...updated }));
      }
      return updated;
    },
    [currentUserId, modpack.id]
  );

  const deleteModpackProject = useCallback(
    async (id: string) => {
      await apiDeleteModpack(id, currentUserId);
      setModpacks((prev) => prev.filter((p) => p.id !== id));
    },
    [currentUserId]
  );

  const inviteContributor = useCallback(
    async (targetPackId: string, usernameOrCode: string) => {
      const cleaned = usernameOrCode.trim();
      if (!cleaned) return;

      const createdInvite = await sendModpackInvite(targetPackId, {
        invitedUser: cleaned,
        invitedBy: currentUser,
        invitedById: currentUserId,
      });

      const inviteLabel = createdInvite.invitedUser || cleaned;

      setModpacks((prev) =>
        prev.map((p) => {
          if (p.id !== targetPackId) return p;
          const pending = p.pendingInvites || [];
          return pending.includes(inviteLabel)
            ? p
            : { ...p, pendingInvites: [...pending, inviteLabel] };
        })
      );

      if (modpack.id === targetPackId) {
        setModpack((prev) => {
          const pending = prev.pendingInvites || [];
          return pending.includes(inviteLabel)
            ? prev
            : { ...prev, pendingInvites: [...pending, inviteLabel] };
        });
      }

      void refreshInvites();
    },
    [currentUser, currentUserId, modpack.id, refreshInvites]
  );

  const acceptInvite = useCallback(
    async (inviteId: string) => {
      const { invite, modpack: updatedPack } = await apiAcceptInvite(inviteId, {
        userId: currentUserId,
        username: currentUser,
      });

      setInvites((prev) => prev.filter((inv) => inv.id !== inviteId));

      if (updatedPack) {
        setModpacks((prev) => {
          const exists = prev.some((p) => p.id === updatedPack.id);
          return exists
            ? prev.map((p) => (p.id === updatedPack.id ? { ...p, ...updatedPack } : p))
            : [updatedPack, ...prev];
        });
      } else {
        void refreshSocialAndPacks();
      }

      if (modpack.id === invite.modpackId && updatedPack) {
        setModpack((prev) => ({ ...prev, ...updatedPack }));
      }
    },
    [currentUser, currentUserId, modpack.id, refreshSocialAndPacks]
  );

  const declineInvite = useCallback(
    async (inviteId: string) => {
      const { invite } = await apiDeclineInvite(inviteId, {
        userId: currentUserId,
        username: currentUser,
      });

      setInvites((prev) => prev.filter((inv) => inv.id !== inviteId));

      setModpacks((prev) =>
        prev.map((p) => {
          if (p.id !== invite.modpackId) return p;
          return {
            ...p,
            pendingInvites: (p.pendingInvites || []).filter(
              (u) => u.toLowerCase() !== invite.invitedUser.toLowerCase()
            ),
          };
        })
      );

      if (modpack.id === invite.modpackId) {
        setModpack((prev) => ({
          ...prev,
          pendingInvites: (prev.pendingInvites || []).filter(
            (u) => u.toLowerCase() !== invite.invitedUser.toLowerCase()
          ),
        }));
      }
    },
    [currentUser, currentUserId, modpack.id]
  );

  // Friend Requests & Friends CRUD
  const sendFriendRequestAction = useCallback(
    async (targetFriendCode: string) => {
      const req = await apiSendFriendRequest({
        fromUserId: currentUserId,
        fromUsername: currentUser,
        fromFriendCode: currentFriendCode,
        targetFriendCode: targetFriendCode.trim().toUpperCase(),
      });
      setOutgoingFriendRequests((prev) => [...prev, req]);
      return req;
    },
    [currentFriendCode, currentUser, currentUserId]
  );

  const acceptFriendRequestAction = useCallback(
    async (requestId: string) => {
      const { friend } = await apiAcceptFriendRequest(requestId, currentUserId);
      setIncomingFriendRequests((prev) => prev.filter((r) => r.id !== requestId));
      setFriends((prev) => {
        if (prev.some((f) => f.id === friend.id || f.userId === friend.userId)) return prev;
        return [...prev, friend];
      });
      return friend;
    },
    [currentUserId]
  );

  const declineFriendRequestAction = useCallback(
    async (requestId: string) => {
      await apiDeclineFriendRequest(requestId, currentUserId);
      setIncomingFriendRequests((prev) => prev.filter((r) => r.id !== requestId));
    },
    [currentUserId]
  );

  const deleteFriend = useCallback(async (id: string) => {
    await apiRemoveFriend(id);
    setFriends((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // Remote state synchronizers (triggered by incoming Socket.io events)
  const applyRemoteModAdded = useCallback((mod: ModItem, user: string) => {
    setModpack((prev) => {
      if (prev.mods.some((m) => m.id === mod.id)) return prev;
      return {
        ...prev,
        mods: [
          ...prev.mods,
          { ...mod, addedBy: user, votes: mod.votes || { yes: [user], no: [] } },
        ],
      };
    });
  }, []);

  const applyRemoteModRemoved = useCallback((modId: string) => {
    setModpack((prev) => ({
      ...prev,
      mods: prev.mods.filter((m) => m.id !== modId),
    }));
  }, []);

  const applyRemoteModVoted = useCallback(
    (modId: string, vote: 'yes' | 'no', user: string) => {
      if (user === currentUser) return;
      setModpack((prev) => ({
        ...prev,
        mods: prev.mods.map((mod) => {
          if (mod.id !== modId) return mod;
          const currentVotes = mod.votes || { yes: [], no: [] };
          return { ...mod, votes: toggleUserVote(currentVotes, user, vote) };
        }),
      }));
    },
    [currentUser]
  );

  const applyRemoteModCommented = useCallback(
    (modId: string, comment: ModComment) => {
      if (comment.user === currentUser) return;
      setModpack((prev) => ({
        ...prev,
        mods: prev.mods.map((mod) => {
          if (mod.id !== modId) return mod;
          if ((mod.comments || []).some((c) => c.id === comment.id)) return mod;
          return {
            ...mod,
            comments: [...(mod.comments || []), comment],
          };
        }),
      }));
    },
    [currentUser]
  );

  const updateLoader = useCallback((loader: string) => {
    setSelectedLoader(loader);
  }, []);

  const updateVersion = useCallback((version: string) => {
    setSelectedVersion(version);
  }, []);

  const installedModIds = new Set(modpack.mods.map((m) => m.id));
  const isNotFound = notFoundModpackId === modpackId;
  const isAccessDenied = accessDeniedModpackId === modpackId;

  return {
    modpacks: currentUserId ? modpacks : [],
    modpacksLoaded: currentUserId ? modpacksLoaded : false,
    modpack,
    setModpack,
    isNotFound,
    isAccessDenied,
    friends: currentUserId ? friends : [],
    incomingFriendRequests: currentUserId ? incomingFriendRequests : [],
    outgoingFriendRequests: currentUserId ? outgoingFriendRequests : [],
    invites: currentUserId ? invites : [],
    sendFriendRequest: sendFriendRequestAction,
    acceptFriendRequest: acceptFriendRequestAction,
    declineFriendRequest: declineFriendRequestAction,
    deleteFriend,
    createNewModpack,
    editModpackProject,
    deleteModpackProject,
    inviteContributor,
    acceptInvite,
    declineInvite,
    selectedLoader,
    selectedVersion,
    selectedCategory,
    selectedSource,
    searchPage,
    searchTotal,
    searchQuery,
    updateLoader,
    updateVersion,
    setSelectedCategory,
    setSelectedSource,
    setSearchPage,
    installedModIds,
    searchResults,
    searchSource,
    isSearching,
    handleSearch,
    recommendations,
    isLoadingRecs,
    fetchRecommendations,
    addMod,
    addModToTargetPack,
    removeMod,
    voteMod,
    commentMod,
    applyRemoteModAdded,
    applyRemoteModRemoved,
    applyRemoteModVoted,
    applyRemoteModCommented,
  };
}
