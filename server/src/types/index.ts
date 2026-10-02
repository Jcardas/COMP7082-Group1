export type ModSource = 'modrinth' | 'curseforge';

export interface ModDependency {
  id: string;
  name: string;
  source: ModSource;
  dependencyType: 'required' | 'optional' | 'incompatible' | 'embedded';
}

export interface ModComment {
  id: string;
  user: string;
  text: string;
  createdAt: string;
}

export interface ModVotes {
  yes: string[]; // List of usernames who voted yes
  no: string[];  // List of usernames who voted no
}

export interface ModItem {
  id: string;
  source: ModSource;
  externalModId: string;
  slug?: string;
  name: string;
  summary: string;
  iconUrl?: string;
  versionId?: string;
  versionName?: string;
  downloadUrl?: string;
  projectUrl?: string; // Direct link to CurseForge or Modrinth
  downloads?: number;  // Number of downloads from API
  filename?: string;
  dependencies: ModDependency[];
  categories: string[];
  loaders: string[];
  gameVersions: string[];
  addedBy?: string;
  votes?: ModVotes;
  comments?: ModComment[];
  createdAt?: string;
}

export interface Modpack {
  id: string;
  title: string;
  description?: string;
  minecraftVersion: string;
  modLoader: 'forge' | 'fabric' | 'neoforge' | 'quilt';
  mods: ModItem[];
  createdAt: string;
  updatedAt: string;
}

export interface DependencyAnalysisResult {
  isValid: boolean;
  cycles: string[][];
  missingDependencies: {
    modName: string;
    missing: ModDependency[];
  }[];
  installOrder: string[];
}

export interface UserPresence {
  socketId: string;
  username: string;
  color: string;
  activeView?: string;
}

export const COMMON_MC_VERSIONS = [
  '1.7.10',
  '1.8.9',
  '1.9.4',
  '1.10.2',
  '1.11.2',
  '1.12.2',
  '1.13.2',
  '1.14.4',
  '1.15.2',
  '1.16.5',
  '1.17.1',
  '1.18.2',
  '1.19.2',
  '1.19.4',
  '1.20.1',
  '1.20.4',
  '1.20.6',
  '1.21.1',
  '1.21.4',
  '1.21.11',
  '26.1',
  '26.2',
  '26.3',
] as const;
