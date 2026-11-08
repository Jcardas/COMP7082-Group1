// server/src/types/index.ts
// Created by Jacob F on 2026-11-08

/**
 * Defines the types for the entire backend.
 * Provides interfaces that are used in different modules
 * to ensure dependency and type safety.
 */

/**
 * Types of relationships between mods as defined by API
 */
export type DependencyType = 
    'required' | 
    'optional' | 
    'incompatible' | 
    'embedded';
    
/**
 * Normalized mod dependency used in the application
 */
export interface ModDependency {
    // Project ID of the mod dependency
    projectId: string;
    // Mod display name
    name: string;
    // URL slug
    slug: string;
    // Type of dependency relationship
    type: DependencyType;
    // VersionId if pinned by mod author
    versionId?: string;
    // External URL to the dependency page
    projectUrl: string;
}

/**
 * Raw dependency entry returned by Modrinth API for a version:
 * GET /project/{id}/version
 */
export interface ModrinthVersionDependency {
    version_id: string | null;
    project_id: string |null;
    file_name: string | null;
    dependency_type: DependencyType;
}

/**
 * Raw version model returned by Modrinth API:
 * GET /project/{id}/version
 */
export interface ModrinthVersion {
    // All the fields returned by the Modrinth API for a version object
    id: string;
    project_id: string;
    author_id: string;
    featured: boolean;
    name: string;
    version_number: string;
    game_versions: string[];
    loaders: string[];
    version_type: 'release' | 'beta' | 'alpha';
    date_published: string;
    downloads: number;
    files: Array<{
        hashes: {
            // SHA1 and SHA512 are hashed values for file integrity verification
            sha1: string;
            sha512: string;
        };
        url: string; // Direct download URL
        filename: string;   // Name of the file as stored
        primary: boolean;   // Indicates if this is the main file for the version
        size: number;   // File size in bytes
        file_type?: string | null; // File extension/type if applicable
    }>;
    // The crucial part: the array of dependencies
    dependencies: ModrinthVersionDependency[];
}

/**
 * Minimal project details fetched from Modrinth:
 * GET /projects?ids=[. . .]
 */
export interface ModrinthBatchProject {
    id: string;
    slug: string;   // URL-friendly identifier for the mod
    title: string;
    description: string;
    icon_url?: string;  // URL to the mod's icon image
}

/**
 * API Response payload for the dependency endpoint:
 * GET /api/mods/:id/dependencies
 */
export interface ModDependenciesResponse {
    projectId: string;
    loader?: string;
    gameVersion?: string;
    resolvedVersion?: { // The version object that was resolved for the given filters
        id: string;
        versionNumber: string;
        datePublished: string;
    } | null;
    dependencies: ModDependency[];
}