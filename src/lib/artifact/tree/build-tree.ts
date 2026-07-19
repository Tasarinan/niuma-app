import { getEntryName } from "../path-adapter";
import type { ArtifactTreeNode, ArtifactTreeRoot } from "./types";

type TreeFileItem = {
  filePath: string;
  relativePath: string;
  rootDir: string;
};

function sortTreeNodes(nodes: ArtifactTreeNode[]): ArtifactTreeNode[] {
  const sorted = [...nodes].sort((a, b) => {
    if (a.kind !== b.kind) {
      if (a.kind === "folder") return -1;
      if (b.kind === "folder") return 1;
      if (a.kind === "file") return 1;
      if (b.kind === "file") return -1;
    }
    return a.name.localeCompare(b.name);
  });

  return sorted.map((node) => ({
    ...node,
    children: sortTreeNodes(node.children),
  }));
}

export function buildTreeFromRelativeFiles(files: TreeFileItem[]): ArtifactTreeRoot[] {
  const rootMap = new Map<string, ArtifactTreeRoot>();

  for (const file of files) {
    const rootId = `root:${file.rootDir}`;
    let root = rootMap.get(rootId);
    if (!root) {
      root = {
        id: rootId,
        name: getEntryName(file.rootDir) || file.rootDir,
        rootDir: file.rootDir,
        children: [],
      };
      rootMap.set(rootId, root);
    }

    const segments = file.relativePath
      .replace(/\\/g, "/")
      .split("/")
      .filter(Boolean);

    if (!segments.length) continue;

    let currentChildren = root.children;
    let currentPath = "";

    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i];
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const isFile = i === segments.length - 1;
      const kind = isFile ? "file" : "folder";
      const nodeId = `${rootId}:${currentPath}`;

      let node = currentChildren.find((item) => item.id === nodeId);
      if (!node) {
        node = {
          id: nodeId,
          name: segment,
          kind,
          path: currentPath,
          children: [],
          rootDir: file.rootDir,
          filePath: isFile ? file.filePath : undefined,
          relativePath: isFile ? file.relativePath : undefined,
        };
        currentChildren.push(node);
      }

      currentChildren = node.children;
    }
  }

  return Array.from(rootMap.values())
    .map((root) => ({
      ...root,
      children: sortTreeNodes(root.children),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
