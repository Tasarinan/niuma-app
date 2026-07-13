export interface TalentAvatarItem {
  fileName: string;
  avatarUrl: string;
}

type AvatarModuleMap = Record<string, string>;

const avatarModules = import.meta.glob('../assets/talent_icon/*.{png,jpg,jpeg,webp,avif,gif}', {
  eager: true,
  import: 'default',
}) as AvatarModuleMap;

export const TALENT_AVATAR_ITEMS: TalentAvatarItem[] = Object.entries(avatarModules)
  .map(([modulePath, avatarUrl]) => ({
    fileName: modulePath.split('/').pop() ?? modulePath,
    avatarUrl,
  }))
  .sort((a, b) => a.fileName.localeCompare(b.fileName, 'en'));
