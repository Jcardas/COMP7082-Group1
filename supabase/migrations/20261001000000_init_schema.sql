-- ==============================================================
-- Minecraft Collaborative Modpack Maker Database Migration
-- Enables pgvector, creates modpack management tables,
-- and sets up natural language semantic search for mods.
-- ==============================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Modpacks Table
CREATE TABLE IF NOT EXISTS modpacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    minecraft_version VARCHAR(32) NOT NULL DEFAULT '1.20.1',
    mod_loader VARCHAR(32) NOT NULL DEFAULT 'forge', -- 'forge', 'fabric', 'neoforge', 'quilt'
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Modpack Mods Table (Items currently installed in a collaborative modpack)
CREATE TABLE IF NOT EXISTS modpack_mods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modpack_id UUID NOT NULL REFERENCES modpacks(id) ON DELETE CASCADE,
    source VARCHAR(32) NOT NULL CHECK (source IN ('modrinth', 'curseforge')),
    external_mod_id VARCHAR(128) NOT NULL,
    slug VARCHAR(128),
    name VARCHAR(255) NOT NULL,
    summary TEXT,
    icon_url TEXT,
    version_id VARCHAR(128),
    version_name VARCHAR(128),
    download_url TEXT,
    filename TEXT,
    dependencies JSONB DEFAULT '[]'::jsonb,
    added_by VARCHAR(128) DEFAULT 'Anonymous',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(modpack_id, source, external_mod_id)
);

-- 4. Mod Embeddings Table (Vector storage for Natural Language search & recommendations)
-- Dimension 384 matches Hugging Face 'sentence-transformers/all-MiniLM-L6-v2'
CREATE TABLE IF NOT EXISTS mod_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(32) NOT NULL CHECK (source IN ('modrinth', 'curseforge')),
    external_mod_id VARCHAR(128) NOT NULL,
    title VARCHAR(255) NOT NULL,
    summary TEXT NOT NULL,
    categories TEXT[] DEFAULT ARRAY[]::TEXT[],
    loaders TEXT[] DEFAULT ARRAY[]::TEXT[],
    game_versions TEXT[] DEFAULT ARRAY[]::TEXT[],
    icon_url TEXT,
    embedding vector(384),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(source, external_mod_id)
);

-- 5. Create HNSW index for high performance vector similarity search
CREATE INDEX IF NOT EXISTS mod_embeddings_hnsw_idx 
ON mod_embeddings 
USING hnsw (embedding vector_cosine_ops);

-- 6. RPC Function for Natural Language Vector Search with metadata filtering
CREATE OR REPLACE FUNCTION match_mods (
    query_embedding vector(384),
    match_threshold float DEFAULT 0.25,
    match_count int DEFAULT 20,
    filter_loader text DEFAULT NULL,
    filter_version text DEFAULT NULL
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
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
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
        1 - (me.embedding <=> query_embedding) AS similarity
    FROM mod_embeddings me
    WHERE 
        (filter_loader IS NULL OR filter_loader = ANY(me.loaders))
        AND (filter_version IS NULL OR filter_version = ANY(me.game_versions))
        AND 1 - (me.embedding <=> query_embedding) > match_threshold
    ORDER BY me.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 7. Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_modpacks_updated_at
    BEFORE UPDATE ON modpacks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
