import { pipeline } from '@huggingface/transformers';

// Singleton promise for the local feature-extraction pipeline
let extractorPromise: Promise<any> | null = null;

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

/**
 * Get or initialize the local feature-extraction pipeline.
 * Runs 100% free locally via ONNX Runtime without remote API keys or credit limits.
 */
async function getExtractor(): Promise<any> {
  if (!extractorPromise) {
    console.log(`🧠 [Local AI] Initializing local embedding pipeline (${MODEL_NAME})...`);
    extractorPromise = pipeline('feature-extraction', MODEL_NAME, {
      dtype: 'fp32',
    });
  }
  return extractorPromise;
}

export const isConfigured = true;
export const hf = { isLocal: true, model: MODEL_NAME };

/**
 * Generate a dense vector embedding (384 dimensions) for a given text query or description.
 * Matches the Supabase 'mod_embeddings' table and 'match_mods' pgvector function.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const extractor = await getExtractor();
    const output = await extractor(trimmed, {
      pooling: 'mean',
      normalize: true,
    });

    if (output && output.data) {
      return Array.from(output.data) as number[];
    }

    return null;
  } catch (error) {
    console.error('Error generating local embedding:', error);
    return null;
  }
}
