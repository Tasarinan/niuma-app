/**
 * Clawpack agent catalog — preset agents bundled with niuma-app.
 * Source files live in <root>/clawpacks/agents/*.json.
 * Images live in <root>/clawpacks/talent_icon/*.jpeg, served at /clawpacks/talent_icon/...
 */

export interface ClawpackAgent {
  /** File name without path, e.g. "alice.json" */
  file: string;
  name: string;
  role: string;
  avatar: string;
  description: string;
  systemPrompt: string;
  providerId: string;
  modelId: string;
  enabledInternalTools: string[];
  enabledSkillIds: string[];
  enabledMcpServerIds: string[];
  sandboxMode: string;
  temperature: number;
  maxTokens: number;
  workspacePath: string;
}

/** All talent_icon image paths (served via /clawpacks/talent_icon/). */
export const CLAWPACK_TALENT_ICONS: string[] = [
  "/clawpacks/talent_icon/adjusted_avatar_004.png.jpeg",
  "/clawpacks/talent_icon/cartoon_avatar_002.png.jpeg",
  "/clawpacks/talent_icon/cartoon_avatar_003.png.jpeg",
  "/clawpacks/talent_icon/cartoon_avatar_005.png.jpeg",
  "/clawpacks/talent_icon/cartoon_avatar_006.png.jpeg",
  "/clawpacks/talent_icon/cartoon_avatar_007.png.jpeg",
  "/clawpacks/talent_icon/cartoon_avatar_008.png.jpeg",
  "/clawpacks/talent_icon/cartoon_avatar_009.png.jpeg",
  "/clawpacks/talent_icon/cartoon_avatar_010.png.jpeg",
  "/clawpacks/talent_icon/cartoon_avatar_011.png.jpeg",
  "/clawpacks/talent_icon/cartoon_avatar_012.png.jpeg",
  "/clawpacks/talent_icon/cartoon_avatar_013.png.jpeg",
  "/clawpacks/talent_icon/cartoon_avatar_014.png.jpeg",
  "/clawpacks/talent_icon/cartoon_avatar_016.png.jpeg",
  "/clawpacks/talent_icon/cartoon_avatar_017.png.jpeg",
  "/clawpacks/talent_icon/cartoon_avatar_018.png.jpeg",
  "/clawpacks/talent_icon/cartoon_avatar_021.png.jpeg",
  "/clawpacks/talent_icon/cartoon_avatar_022.png.jpeg",
  "/clawpacks/talent_icon/cartoon_avatar_023.png.jpeg",
  "/clawpacks/talent_icon/cartoon_avatar_025.png.jpeg",
  "/clawpacks/talent_icon/cartoon_avatar_027.png.jpeg",
  "/clawpacks/talent_icon/cartoon_avatar_028.png.jpeg",
  "/clawpacks/talent_icon/cartoon_avatar_029.png.jpeg",
  "/clawpacks/talent_icon/cartoon_avatar_030.png.jpeg",
  "/clawpacks/talent_icon/cartoon_avatar_031.png.jpeg",
  "/clawpacks/talent_icon/cartoon_avatar_032.png.jpeg",
  "/clawpacks/talent_icon/cartoon_avatar_033.png.jpeg",
  "/clawpacks/talent_icon/cartoon_avatar_034.png.jpeg",
  "/clawpacks/talent_icon/cartoon_avatar_036.png.jpeg",
  "/clawpacks/talent_icon/centered_avatar_002.png.jpeg",
  "/clawpacks/talent_icon/focused_avatar_001.png.jpeg",
  "/clawpacks/talent_icon/focused_avatar_002.png.jpeg",
  "/clawpacks/talent_icon/more_avatar_001.png.jpeg",
  "/clawpacks/talent_icon/more_avatar_005.png.jpeg",
  "/clawpacks/talent_icon/more_avatar_012.png.jpeg",
  "/clawpacks/talent_icon/more_avatar_014.png.jpeg",
  "/clawpacks/talent_icon/varied_avatar_001.png.jpeg",
];

/**
 * Fetch the full catalog of preset agents from /clawpacks/agents/index.json
 * and then load each individual agent JSON.
 */
export async function fetchClawpackCatalog(): Promise<ClawpackAgent[]> {
  const indexRes = await fetch("/clawpacks/agents/index.json");
  const files: string[] = await indexRes.json();

  const agents = await Promise.all(
    files.map(async (file) => {
      const res = await fetch(`/clawpacks/agents/${file}`);
      const data = await res.json();
      return { file, ...data } as ClawpackAgent;
    })
  );
  return agents;
}
