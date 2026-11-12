// server/src/schemas/modpackSchemas.ts
// Created by Jacob F on 2026-11-08
//
// Defines Zod validation schemas for all REST API request
// payloads and query parameters.
//
// Enforces strict type safety, string length boundaries,
// and enum constraints before controller/service execution.

import { z } from 'zod';

/**
 * Supported mod loaders across Modrinth and CurseForge
 */
export const modLoaderEnum = z.enum(['forge', 'fabric', 'neoforge', 'quilt']);

/**
 * Supported dependency relationship types
 */
export const dependencyTypeEnum = z.enum([
  'required',
  'optional',
  'incompatible',
  'embedded',
]);

/**
 * Schema for an individual mod dependency entry
 */
export const modDependencySchema = z
  .object({
    id: z.string().optional(),
    projectId: z.string().optional(),
    name: z.string().min(1, 'Dependency name cannot be empty').optional(),
    slug: z.string().optional(),
    type: dependencyTypeEnum.optional(),
    dependencyType: dependencyTypeEnum.optional(),
    versionId: z.string().nullable().optional(),
    projectUrl: z.string().url().optional(),
  })
  .passthrough();

/**
 * Schema for adding or validating a ModItem
 * Enforces externalModId, source, name, and dependencies
 */
export const addModSchema = z
  .object({
    id: z.string().optional(),
    externalModId: z.string().trim().min(1, 'externalModId is required'),
    source: z.enum(['modrinth', 'curseforge'], {
      message: "Source must be either 'modrinth' or 'curseforge'",
    }),
    slug: z.string().optional(),
    name: z.string().trim().min(1, 'Mod name is required'),
    summary: z.string().optional().default(''),
    iconUrl: z.string().optional(),
    projectUrl: z.string().optional(),
    downloads: z.number().nonnegative().optional().default(0),
    categories: z.array(z.string()).optional().default([]),
    loaders: z.array(z.string()).optional().default([]),
    gameVersions: z.array(z.string()).optional().default([]),
    dependencies: z.array(modDependencySchema).optional().default([]),
  })
  .passthrough();

/**
 * Schema for creating a new Modpack
 * Requires non-empty title, valid minecraftVersion (defaulting to 1.21.1), and valid modLoader
 */
export const createModpackSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Modpack title cannot be empty')
    .max(100, 'Modpack title cannot exceed 100 characters'),
  description: z
    .string()
    .max(1000, 'Description cannot exceed 1000 characters')
    .optional()
    .default(''),
  imageUrl: z.string().optional().default('/MCMC.png'),
  contributors: z.array(z.string()).optional().default([]),
  pendingInvites: z.array(z.string()).optional().default([]),
  minecraftVersion: z
    .string()
    .trim()
    .min(1, 'Minecraft version is required')
    .default('1.21.1'),
  modLoader: modLoaderEnum.default('forge'),
  createdBy: z.string().trim().min(1).optional().default('Anonymous'),
  creatorName: z.string().trim().optional(),
});

/**
 * Schema for updating an existing Modpack (PATCH /api/modpacks/:id)
 * All fields are optional, but if provided, must be valid and non-empty
 */
export const updateModpackSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Modpack title cannot be empty')
    .max(100, 'Modpack title cannot exceed 100 characters')
    .optional(),
  description: z
    .string()
    .max(1000, 'Description cannot exceed 1000 characters')
    .optional(),
  imageUrl: z.string().optional(),
  contributors: z.array(z.string()).optional(),
  pendingInvites: z.array(z.string()).optional(),
  minecraftVersion: z
    .string()
    .trim()
    .min(1, 'Minecraft version cannot be empty')
    .optional(),
  modLoader: modLoaderEnum.optional(),
  mods: z.array(z.any()).optional(),
  userId: z.string().trim().optional(),
});

/**
 * Schema for inviting a collaborator to a modpack
 */
export const inviteCollaboratorSchema = z.object({
  invitedUser: z.string().trim().min(1, 'Invited friend code or user is required'),
  invitedUserId: z.string().trim().optional(),
  invitedBy: z.string().trim().optional().default('Collaborator'),
  invitedById: z.string().trim().optional(),
});

/**
 * Schema for responding to a collaborator invite ('accept' | 'decline')
 */
export const respondInviteSchema = z.object({
  userId: z.string().trim().optional(),
  username: z.string().trim().optional(),
});

/**
 * Schema for voting on a mod ('yes' | 'no')
 */
export const voteModSchema = z.object({
  vote: z.enum(['yes', 'no'], {
    message: "Vote must be strictly 'yes' or 'no'",
  }),
  userId: z.string().trim().min(1).optional().default('Anonymous'),
});

/**
 * Schema for posting a comment on a mod (1 to 1000 characters)
 */
export const commentModSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Comment text cannot be empty')
    .max(1000, 'Comment text cannot exceed 1000 characters'),
  user: z.string().trim().min(1).optional(),
  author: z.string().trim().min(1).optional(),
});

/**
 * Schema for Natural Language Search query parameters (GET /api/search)
 */
export const searchQuerySchema = z.object({
  q: z.string().optional().default(''),
  loader: z.string().optional(),
  version: z.string().optional(),
  category: z.string().optional(),
  source: z.enum(['modrinth', 'curseforge', 'both']).optional().default('both'),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

/**
 * Schema for Mod Dependencies query parameters (GET /api/mods/:id/dependencies)
 */
export const modDependenciesQuerySchema = z.object({
  loader: z.string().trim().min(1).optional(),
  version: z.string().trim().min(1).optional(),
});

/**
 * Schema for Modpack Recommendations body (POST /api/recommendations)
 */
export const recommendationsBodySchema = z.object({
  mods: z.array(z.any()).optional().default([]),
  loader: z.string().optional(),
  gameVersion: z.string().optional(),
});

/**
 * Schema for Resolving Required Dependencies for a single mod (POST /api/resolve-mod-dependencies)
 */
export const resolveModDependenciesBodySchema = z.object({
  mod: addModSchema,
  loader: z.string().optional(),
  gameVersion: z.string().optional(),
});

/**
 * Schema for Dependency Graph Analysis body (POST /api/analyze-dependencies)
 */
export const analyzeDependenciesBodySchema = z.object({
  mods: z.array(z.any()).default([]),
  targetGameVersion: z.string().optional(),
  targetLoader: z.string().optional(),
});

/**
 * Schema for Exporting a Modpack (POST /api/modpacks/:id/export)
 */
export const exportModpackBodySchema = z.object({
  modpack: z
    .object({
      id: z.string().optional(),
      title: z.string().min(1, 'Modpack title is required for export'),
      minecraftVersion: z.string().min(1, 'Minecraft version is required for export'),
      modLoader: modLoaderEnum,
      mods: z.array(z.any()).default([]),
    })
    .passthrough(),
  format: z.enum(['curseforge', 'modrinth']).optional().default('curseforge'),
});

/**
 * Schema for sending a Friend request (POST /api/friends or POST /api/friends/requests)
 */
export const addFriendSchema = z.object({
  fromUserId: z.string().trim().min(1).optional(),
  fromUsername: z.string().trim().optional(),
  fromFriendCode: z.string().trim().optional(),
  targetFriendCode: z
    .string()
    .trim()
    .min(3, 'Friend code must be at least 3 characters')
    .max(20, 'Friend code cannot exceed 20 characters')
    .optional(),
  friendCode: z
    .string()
    .trim()
    .min(3, 'Friend code must be at least 3 characters')
    .max(20, 'Friend code cannot exceed 20 characters')
    .optional(),
  username: z.string().trim().max(50).optional(),
});

export const respondFriendRequestSchema = z.object({
  userId: z.string().trim().optional(),
});

export const syncUserSchema = z.object({
  userId: z.string().trim().min(1),
  username: z.string().trim().min(1).max(80),
  friendCode: z.string().trim().optional(),
  avatarUrl: z.string().trim().optional(),
});

export const uploadImageSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().min(1),
  dataBase64: z.string().min(1),
});

export const deleteAccountSchema = z.object({
  userId: z.string().trim().min(1),
});
