import { useCallback, useEffect, useState } from 'react';
import {
  acceptModpackInvite as apiAcceptInvite,
  addFriend as apiAddFriend,
  addModToPackApi,
  createModpack as apiCreateModpack,
  declineModpackInvite as apiDeclineInvite,
  deleteModpack as apiDeleteModpack,
  getModpack,
  getRecommendations,
  listFriends,
  listModpackInvites,
  listModpacks,
  ModpackNotFoundError,
  removeFriend as apiRemoveFriend,
  removeModFromPackApi,
  resolveModDependencies,
  searchMods,
  type SearchFilterOptions,
  sendModpackInvite,
  updateModpack as apiUpdateModpack,
} from '../services/api';
import { socket } from '../services/socket';
import type { FriendItem, ModComment, ModItem, Modpack, ModpackInvite } from '../types/consts';

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
  modpackId = 'demo-modpack',
  currentUser = 'Crafter',
  currentUserId = 'Anonymous',
  currentFriendCode = ''
) {
  const [modpacks, setModpacks] = useState<Modpack[]>([]);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [invites, setInvites] = useState<ModpackInvite[]>([]);
  const [notFoundModpackId, setNotFoundModpackId] = useState<string | null>(null);

  const [modpack, setModpack] = useState<Modpack>(() => ({
    id: modpackId,
    title: 'Group 1 Collaborative Pack',
    description: 'Collaborative Minecraft modpack workspace',
    imageUrl: '/MCMC.png',
    contributors: ['Alex', 'Steve'],
    pendingInvites: [],
    minecraftVersion: '1.20.1',
    modLoader: 'forge',
    mods: [],
    createdAt: INITIAL_TIMESTAMP,
    updatedAt: INITIAL_TIMESTAMP,
  }));

  const [selectedLoader, setSelectedLoader] = useState<string>('forge');
  const [selectedVersion, setSelectedVersion] = useState<string>('1.20.1');
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
    try {
      const list = await listModpackInvites();
      setInvites(list);
    } catch (err) {
      console.warn('Could not fetch invites:', err);
    }
  }, []);

  // Initial load of modpacks list, friends, invites, active modpack metadata, and starter search
  useEffect(() => {
    let isMounted = true;

    listModpacks()
      .then((packs) => {
        if (isMounted) setModpacks(packs);
      })
      .catch((err) => console.warn('Could not list modpacks:', err));

    listFriends()
      .then((list) => {
        if (isMounted) setFriends(list);
      })
      .catch((err) => console.warn('Could not list friends:', err));

    listModpackInvites()
      .then((list) => {
        if (isMounted) setInvites(list);
      })
      .catch((err) => console.warn('Could not list invites:', err));

    if (!modpackId) {
      return () => {
        isMounted = false;
      };
    }

    getModpack(modpackId)
      .then((pack) => {
        if (!isMounted || !pack) return;
        setNotFoundModpackId(null);
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
        if (err instanceof ModpackNotFoundError && modpackId !== 'demo-modpack') {
          setNotFoundModpackId(modpackId);
          return;
        }
        console.warn('Could not fetch modpack from server, loading default starter search:', err);
        searchMods({ query: '', loader: 'forge', version: '1.20.1', page: 1, limit: 10 })
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

      // Persist each added mod directly to Supabase `modpack_mods` via POST /api/modpacks/:id/mods
      // as well as full mod list sync via PATCH /api/modpacks/:id
      for (const item of allToAdd) {
        addModToPackApi(targetModpackId, item).catch(() => {});
        socket.emit('mod_add', {
          modpackId: targetModpackId,
          mod: item,
          user,
        });
      }
      apiUpdateModpack(targetModpackId, { mods: updatedMods }).catch(() => {});

      return { addedDeps: requiredDeps };
    },
    [currentUser, modpack, modpacks]
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
        removeModFromPackApi(prev.id, modId).catch(() => {});
        apiUpdateModpack(prev.id, { mods: nextMods }).catch(() => {});
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
    [currentUser, modpack.id]
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

  // Modpack Project CRUD (tracks authenticated user ID in created_by and sends pending invites)
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
        minecraftVersion: payload.minecraftVersion,
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
      const updated = await apiUpdateModpack(id, payload);
      setModpacks((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
      if (modpack.id === id) {
        setModpack((prev) => ({ ...prev, ...updated }));
      }
      return updated;
    },
    [modpack.id]
  );

  const deleteModpackProject = useCallback(async (id: string) => {
    await apiDeleteModpack(id);
    setModpacks((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // Inviting a collaborator sends a pending invite rather than immediately adding them to the pack
  const inviteContributor = useCallback(
    async (targetPackId: string, usernameOrCode: string) => {
      const cleaned = usernameOrCode.trim();
      if (!cleaned) return;

      const createdInvite = await sendModpackInvite(targetPackId, {
        invitedUser: cleaned,
        invitedBy: currentUser,
      });

      setInvites((prev) => {
        if (prev.some((inv) => inv.id === createdInvite.id)) return prev;
        return [...prev, createdInvite];
      });

      setModpacks((prev) =>
        prev.map((p) => {
          if (p.id !== targetPackId) return p;
          const pending = p.pendingInvites || [];
          return pending.includes(cleaned)
            ? p
            : { ...p, pendingInvites: [...pending, cleaned] };
        })
      );

      if (modpack.id === targetPackId) {
        setModpack((prev) => {
          const pending = prev.pendingInvites || [];
          return pending.includes(cleaned)
            ? prev
            : { ...prev, pendingInvites: [...pending, cleaned] };
        });
      }
    },
    [currentUser, modpack.id]
  );

  // Accepting an invite permanently adds the user to the modpack as a collaborator
  const acceptInvite = useCallback(
    async (inviteId: string) => {
      const { invite, modpack: updatedPack } = await apiAcceptInvite(inviteId, {
        userId: currentUserId,
        username: currentUser,
      });

      setInvites((prev) => prev.filter((inv) => inv.id !== inviteId));

      const acceptedUser = invite.invitedUser || currentUser;

      setModpacks((prev) =>
        prev.map((p) => {
          if (p.id !== invite.modpackId) return p;
          if (updatedPack) return { ...p, ...updatedPack };
          const existing = p.contributors || [];
          const nextContributors = existing.includes(acceptedUser)
            ? existing
            : [...existing, acceptedUser];
          const nextPending = (p.pendingInvites || []).filter(
            (u) => u.toLowerCase() !== invite.invitedUser.toLowerCase()
          );
          return { ...p, contributors: nextContributors, pendingInvites: nextPending };
        })
      );

      if (modpack.id === invite.modpackId) {
        setModpack((prev) => {
          if (updatedPack) return { ...prev, ...updatedPack };
          const existing = prev.contributors || [];
          const nextContributors = existing.includes(acceptedUser)
            ? existing
            : [...existing, acceptedUser];
          const nextPending = (prev.pendingInvites || []).filter(
            (u) => u.toLowerCase() !== invite.invitedUser.toLowerCase()
          );
          return { ...prev, contributors: nextContributors, pendingInvites: nextPending };
        });
      }
    },
    [currentUser, currentUserId, modpack.id]
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

  // Friends CRUD
  const createFriend = useCallback(async (payload: { username?: string; friendCode: string }) => {
    const added = await apiAddFriend(payload);
    setFriends((prev) => [...prev, added]);
    return added;
  }, []);

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

  return {
    modpacks,
    modpack,
    setModpack,
    isNotFound,
    friends,
    invites,
    createFriend,
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
