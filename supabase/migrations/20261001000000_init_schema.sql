-- ==============================================================
-- Minecraft Collaborative Modpack Maker Database Migration
-- Enables pgvector, creates modpack management tables,
-- and sets up natural language semantic search for mods.
--
-- Reviewed by Justin C
-- ==============================================================

-- ==============================================================
-- STEP 1: Enable the pgvector Extension
-- ==============================================================
-- Registers the vector data type and distance operators (<=>, <->, <#>)
-- inside PostgreSQL. Required before any column can use `vector(n)`.
CREATE EXTENSION IF NOT EXISTS vector;


-- ==============================================================
-- STEP 2: Create the Modpacks Table
-- ==============================================================
-- Stores top-level metadata for each collaborative modpack project.
-- Acts as the parent container for installed mods, config state, and team edits.
CREATE TABLE IF NOT EXISTS modpacks (
    -- Unique identifier
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Display name for the pack (e.g "My Modpack")
    title VARCHAR(255) NOT NULL,
    -- Longer description
    description TEXT,
    -- Minecraft Version for the modpack; defaults to 1.21.1
    minecraft_version VARCHAR(32) NOT NULL DEFAULT '1.21.1',
    -- Modloader target; ensures mods added share the same platform
    mod_loader VARCHAR(32) NOT NULL DEFAULT 'forge', -- 'forge', 'fabric', 'neoforge', 'quilt'
    -- Identifier (user ID) of the owner/creator
    created_by VARCHAR(128) NOT NULL,

    -- Automatic UTC audit timestamps for creation and modification tracking
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);


-- ==============================================================
-- STEP 3: Create the Modpack Mods Table
-- ==============================================================
-- Join/item table tracking mods currently installed inside a specific modpack.
-- Denormalizes core metadata (name, files, URLs) so the UI can render
-- the installed manifest instantly without hitting external platform APIs.
CREATE TABLE IF NOT EXISTS modpack_mods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign key linking back to the parent modpack;
    -- ON DELETE CASCADE ensures deleting a modpack cleanly removes all its installed mods
    modpack_id UUID NOT NULL REFERENCES modpacks(id) ON DELETE CASCADE,

    -- Origin platform of the mod asset
    source VARCHAR(32) NOT NULL CHECK (source IN ('modrinth', 'curseforge')),

    -- ID assigned by the upstream platform (e.g., Modrinth project ID or CurseForge project ID)
    external_mod_id VARCHAR(128) NOT NULL,

    -- Human-readable URL slug for links and routing
    slug VARCHAR(128),
    name VARCHAR(255) NOT NULL,
    summary TEXT,
    icon_url TEXT,

    -- Exact release / build metadata selected for this mod
    version_id VARCHAR(128),
    version_name VARCHAR(128),
    download_url TEXT,
    filename TEXT,

    -- Stores parsed upstream dependency objects (e.g., [{ "project_id": "...", "type": "required" }])
    -- Stored as JSONB to allow dynamic dependency graph validation and missing-mod checks
    dependencies JSONB DEFAULT '[]'::jsonb,

    -- Tracks which collaborator in the session added this mod to the pack
    added_by VARCHAR(128) DEFAULT 'Anonymous',

    -- And when
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Composite unique constraint: prevents accidentally adding the same mod twice to one pack
    UNIQUE(modpack_id, source, external_mod_id)
);

-- Foreign key B-Tree index: PostgreSQL does not auto-index foreign keys.
-- Essential for fast lookups when loading a pack's mod list and optimizing cascade deletes.
CREATE INDEX IF NOT EXISTS idx_modpack_mods_modpack_id
ON modpack_mods(modpack_id);


-- ==============================================================
-- STEP 4: Mod Embeddings Table (Semantic Search Catalog)
-- ==============================================================
-- Shared global cache of mods ingested from Modrinth/CurseForge.
-- Stores precomputed text embeddings for natural language search and recommendations.
CREATE TABLE IF NOT EXISTS mod_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- ID

    -- Origin platform identifier
    source VARCHAR(32) NOT NULL CHECK (source IN ('modrinth', 'curseforge')),

    -- Upstream platform mod identifier
    external_mod_id VARCHAR(128) NOT NULL,

    title VARCHAR(255) NOT NULL,
    summary TEXT NOT NULL,

    -- Categorization and compatibility arrays used for pre-filtering search results
    categories TEXT[] DEFAULT ARRAY[]::TEXT[],    -- e.g., ARRAY['technology', 'magic', 'storage']
    loaders TEXT[] DEFAULT ARRAY[]::TEXT[],       -- e.g., ARRAY['neoforge', 'fabric']
    game_versions TEXT[] DEFAULT ARRAY[]::TEXT[], -- e.g., ARRAY['1.21.1', '1.20.1']

    icon_url TEXT, -- Icon for the mod

    downloads BIGINT NOT NULL DEFAULT 0, -- How many downloads this mod has.

    -- 384-dimension vector matching 'sentence-transformers/all-MiniLM-L6-v2' output embeddings
    embedding vector(384),

    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Ensures each external mod is stored only once per platform; enables UPSERT synchronization
    UNIQUE(source, external_mod_id)
);


-- ==============================================================
-- STEP 5: Performance Indexes
-- ==============================================================
-- 1. HNSW (Hierarchical Navigable Small World) Index:
-- Builds a multi-layer graph for fast Approximate Nearest Neighbor (ANN) search.
-- Uses `vector_cosine_ops` to accelerate cosine distance calculations (`<=>`).
-- More info: https://www.pinecone.io/learn/series/faiss/hnsw/
CREATE INDEX IF NOT EXISTS mod_embeddings_hnsw_idx
ON mod_embeddings
USING hnsw (embedding vector_cosine_ops);

-- 2. GIN (Generalized Inverted Index) Indexes on metadata arrays:
-- Dramatically speeds up array membership filtering (e.g., `filter_loader = ANY(loaders)`)
-- during hybrid search, avoiding full sequential scans on large catalogs.
CREATE INDEX IF NOT EXISTS idx_mod_embeddings_loaders
ON mod_embeddings USING GIN (loaders);

CREATE INDEX IF NOT EXISTS idx_mod_embeddings_game_versions
ON mod_embeddings USING GIN (game_versions);


-- ==============================================================
-- STEP 6: RPC Function for Natural Language Vector Search
-- ==============================================================
-- Stored procedure called by the client/backend (e.g., Supabase RPC) to run
-- combined semantic vector search with technical metadata constraints in one round-trip.
-- This is used to find mods that match a search query semantically.
CREATE OR REPLACE FUNCTION match_mods (
    query_embedding vector(384),         -- User prompt (the text they enter into the searchbox) embedded into a 384-dim vector just like the mod embeddings.
    match_threshold float DEFAULT 0.25,  -- Minimum similarity score (0.0 to 1.0) to filter noise
    match_count int DEFAULT 20,          -- Max number of results returned (LIMIT)
    filter_loader text DEFAULT NULL,     -- Optional loader filter (e.g., 'neoforge')
    filter_version text DEFAULT NULL,     -- Optional game version filter (e.g., '1.21.1')
    filter_categories text[] DEFAULT NULL  -- Optional mod category filter, e.g., ARRAY['technology', 'optimization'] or NULL

    popularity_weight float DEFAULT 0.15 -- Weighted results based on how popular the mod is (downloads) with 0.0 = pure semantic, 1.0  = pure downloads.

)
-- This is the table of resulting mods, sorted by similarity to the users semantic prompt.
--
RETURNS TABLE (
    id UUID,
    source VARCHAR(32),
    external_mod_id VARCHAR(128),
    title VARCHAR(255),
    summary TEXT,
    categories TEXT[],
    loaders TEXT[],
    game_versions TEXT[],
    icon_url TEXT,
    downloads BIGINT,
    semantic_similarity float,
    final_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH scored_candidates AS (
        SELECT
            me.id,
            me.source,
            me.external_mod_id,
            me.title,
            me.summary,
            me.categories,
            me.loaders,
            me.game_versions,
            me.icon_url,
            me.downloads,
            -- Base semantic similarity [0 to 1]
            (1 - (me.embedding <=> query_embedding))::float AS sim,
            -- Normalized log download score: ln(1 + downloads) / ln(1 + 100,000,000) So that we only focus on differences between mods with very little downloads, instead of only ever getting popular mods.
            -- Clamped between 0.0 and 1.0
            LEAST(1.0, GREATEST(0.0, ln(1 + me.downloads) / ln(100000001)))::float AS pop_score
        FROM mod_embeddings me
        WHERE
            -- Match loader filter if provided; if NULL, ignore loader constraint
            (filter_loader IS NULL OR filter_loader = ANY(me.loaders))
            -- Match version filter if provided; if NULL, ignore version constraint
            AND (filter_version IS NULL OR filter_version = ANY(me.game_versions))
            -- Match category filter if provided; if NULL, ignore category restraint
            AND (filter.categories IS NULL OR me.categories && filter_categories)
            -- Enforce minimum relevance cut-off
            AND (1 - (me.embedding <=> query_embedding)) > match_threshold
            -- Rank nearest vectors first (ascending distance = highest similarity)
    )
    SELECT
        sc.id,
        sc.source,
        sc.external_mod_id,
        sc.title,
        sc.summary,
        sc.categories,
        sc.loaders,
        sc.game_versions,
        sc.icon_url,
        sc.downloads,
        sc.sim AS semantic_similarity,
        -- Weighted composite score
        ((1.0 - popularity_weight) * sc.sim + popularity_weight * sc.pop_score)::float AS final_score
    FROM scored_candidates sc
    ORDER BY final_score DESC
    LIMIT match_count; -- Only return the amount of results defined earlier by the limit.
END;
$$;


-- ==============================================================
-- STEP 7: Automatic Timestamp Update Trigger
-- ==============================================================
-- Reusable trigger function: updates the `updated_at` column to current UTC time
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind trigger to `modpacks`: automatically sets `updated_at` on every row UPDATE
DROP TRIGGER IF EXISTS update_modpacks_updated_at ON modpacks;
CREATE TRIGGER update_modpacks_updated_at
    BEFORE UPDATE ON modpacks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
