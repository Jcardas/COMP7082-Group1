import { HfInference } from '@huggingface/inference';
import { config } from '../config/index.js';

const isConfigured = Boolean(
  config.huggingface.apiKey && !config.huggingface.apiKey.includes('your_huggingface_access_token')
);

if (!isConfigured) {
  console.log(
    'ℹ️  [Hugging Face] HUGGINGFACE_API_KEY is not set. Using keyword matching & Modrinth search until configured.'
  );
}

export const hf = isConfigured ? new HfInference(config.huggingface.apiKey) : null;

/**
 * Generate a dense vector embedding for a given text query or description.
 * Defaults to 'sentence-transformers/all-MiniLM-L6-v2' (384 dimensions).
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!hf) {
    return null;
  }

  try {
    const result = await hf.featureExtraction({
      model: config.huggingface.embeddingModel,
      inputs: text.trim(),
    });

    if (Array.isArray(result)) {
      if (typeof result[0] === 'number') {
        return result as number[];
      }
      if (Array.isArray(result[0]) && typeof result[0][0] === 'number') {
        return result[0] as number[];
      }
    }

    return null;
  } catch (error) {
    console.error('Error generating Hugging Face embedding:', error);
    return null;
  }
}
