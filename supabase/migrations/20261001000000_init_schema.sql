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
    -- Identifier (user ID) of the owner/creator; defaults to the Supabase authenticated user ID
    created_by VARCHAR(128) NOT NULL DEFAULT auth.uid()::text,

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
-- STEP 5: Create Collaborators Table
-- ==============================================================
-- Manages a list of users authorized to own, edit, or view modpack tables.
CREATE TABLE IF NOT EXISTS modpack_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modpack_id UUID NOT NULL REFERENCES modpacks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL DEFAULT 'editor', -- 'owner', 'editor', 'viewer'
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(modpack_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_modpack_collaborators_lookup
ON modpack_collaborators(modpack_id, user_id);

CREATE INDEX IF NOT EXISTS idx_modpack_collaborators_user_id
ON modpack_collaborators(user_id);


-- ==============================================================
-- STEP 6: Performance Indexes
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

CREATE INDEX IF NOT EXISTS idx_mod_embeddings_categories
ON mod_embeddings USING GIN (categories);

CREATE INDEX IF NOT EXISTS idx_mod_embeddings_downloads
ON mod_embeddings (downloads DESC);


-- ==============================================================
-- STEP 7: Row Level Security (RLS) & Access Policies
-- ==============================================================
ALTER TABLE modpacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE modpack_mods ENABLE ROW LEVEL SECURITY;
ALTER TABLE mod_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE modpack_collaborators ENABLE ROW LEVEL SECURITY;

-- Helper security function: checks if the current user can edit a given modpack
-- SECURITY DEFINER bypasses RLS on modpacks/collaborators during the check, preventing recursion
CREATE OR REPLACE FUNCTION is_modpack_editor(check_pack_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM modpacks
        WHERE id = check_pack_id AND created_by = auth.uid()::text
    )
    OR EXISTS (
        SELECT 1 FROM modpack_collaborators
        WHERE modpack_id = check_pack_id
          AND user_id = auth.uid()
          AND role IN ('owner', 'editor')
    );
$$;

-- --------------------------------------------------------------
-- 1. mod_embeddings (Public Search Catalog)
-- --------------------------------------------------------------
CREATE POLICY "Allow public read access to mod_embeddings"
ON mod_embeddings FOR SELECT
TO anon, authenticated
USING (true);

-- --------------------------------------------------------------
-- 2. modpack_collaborators
-- --------------------------------------------------------------
CREATE POLICY "View collaborators"
ON modpack_collaborators FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM modpacks
        WHERE modpacks.id = modpack_collaborators.modpack_id
          AND modpacks.created_by = auth.uid()::text
    )
);

CREATE POLICY "Manage collaborators"
ON modpack_collaborators FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM modpacks
        WHERE modpacks.id = modpack_collaborators.modpack_id
          AND modpacks.created_by = auth.uid()::text
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM modpacks
        WHERE modpacks.id = modpack_collaborators.modpack_id
          AND modpacks.created_by = auth.uid()::text
    )
);

-- --------------------------------------------------------------
-- 3. modpacks
-- --------------------------------------------------------------
CREATE POLICY "Allow viewing modpacks"
ON modpacks FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow creating modpacks"
ON modpacks FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid()::text);

CREATE POLICY "Allow modifying modpacks"
ON modpacks FOR UPDATE
TO authenticated
USING (is_modpack_editor(id));

CREATE POLICY "Allow deleting modpacks"
ON modpacks FOR DELETE
TO authenticated
USING (created_by = auth.uid()::text);

-- --------------------------------------------------------------
-- 4. modpack_mods
-- --------------------------------------------------------------
CREATE POLICY "Allow viewing modpack_mods"
ON modpack_mods FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow modifying modpack_mods"
ON modpack_mods FOR ALL
TO authenticated
USING (is_modpack_editor(modpack_id))
WITH CHECK (is_modpack_editor(modpack_id));


-- ==============================================================
-- STEP 8: RPC Function for Natural Language Vector Search
-- ==============================================================
CREATE OR REPLACE FUNCTION match_mods (
    query_embedding vector(384),
    match_threshold float DEFAULT 0.25,
    match_count int DEFAULT 20,
    filter_loader text DEFAULT NULL,
    filter_version text DEFAULT NULL,
    filter_categories text[] DEFAULT NULL,
    popularity_weight float DEFAULT 0.15
)
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
            (1 - (me.embedding <=> query_embedding))::float AS sim,
            LEAST(1.0, GREATEST(0.0, ln(1 + me.downloads) / ln(100000001)))::float AS pop_score
        FROM mod_embeddings me
        WHERE
            (filter_loader IS NULL OR filter_loader = ANY(me.loaders))
            AND (filter_version IS NULL OR filter_version = ANY(me.game_versions))
            AND (filter_categories IS NULL OR me.categories && filter_categories)
            AND (1 - (me.embedding <=> query_embedding)) > match_threshold
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
        ((1.0 - popularity_weight) * sc.sim + popularity_weight * sc.pop_score)::float AS final_score
    FROM scored_candidates sc
    ORDER BY final_score DESC
    LIMIT match_count;
END;
$$;


-- ==============================================================
-- STEP 9: Automatic Timestamp Update Trigger
-- ==============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_modpacks_updated_at ON modpacks;
CREATE TRIGGER update_modpacks_updated_at
    BEFORE UPDATE ON modpacks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
