export type ArtifactTreeNodeKind = "root" | "folder" | "file";

export type ArtifactTreeNode = {
  id: string;
  name: string;
  path: string;
  kind: ArtifactTreeNodeKind;
  children: ArtifactTreeNode[];
  filePath?: string;
  relativePath?: string;
  rootDir?: string;
};

export type ArtifactTreeRoot = {
  id: string;
  name: string;
  rootDir: string;
  children: ArtifactTreeNode[];
};
