export function formatDownloads(downloads?: number): string {
  if (!downloads || downloads <= 0) return '0 downloads';
  if (downloads >= 1_000_000_000) {
    return `${(downloads / 1_000_000_000).toFixed(1)}B downloads`;
  }
  if (downloads >= 1_000_000) {
    return `${(downloads / 1_000_000).toFixed(1)}M downloads`;
  }
  if (downloads >= 1_000) {
    return `${(downloads / 1_000).toFixed(1)}K downloads`;
  }
  return `${downloads.toLocaleString()} downloads`;
}

export function getModProjectUrl(mod: {
  source: string;
  externalModId: string;
  slug?: string;
  projectUrl?: string;
}): string {
  if (mod.projectUrl) return mod.projectUrl;
  if (mod.source === 'modrinth') {
    return `https://modrinth.com/mod/${mod.slug || mod.externalModId}`;
  }
  return `https://www.curseforge.com/minecraft/mc-mods/${mod.slug || mod.externalModId}`;
}
