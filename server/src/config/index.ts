import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from server dir or root dir
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',

  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },

  huggingface: {
    apiKey: process.env.HUGGINGFACE_API_KEY || '',
    embeddingModel: process.env.HUGGINGFACE_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2',
  },

  curseforge: {
    apiKey: process.env.CURSEFORGE_API_KEY || '',
    baseUrl: 'https://api.curseforge.com/v1',
  },

  modrinth: {
    baseUrl: 'https://api.modrinth.com/v2',
    userAgent: process.env.MODRINTH_USER_AGENT || 'COMP7082-Group1-ModpackMaker/0.1.0',
    token: process.env.MODRINTH_API_TOKEN || '',
  },
};
