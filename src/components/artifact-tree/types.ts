import type { ArtifactTreeNode, ArtifactTreeRoot } from "@/lib/artifact/tree";

export type ArtifactTreeProps = {
	roots: ArtifactTreeRoot[];
	selectedFilePath?: string;
	onSelectFile: (path: string) => void;
	onRefresh?: () => void;
	direction?: "ltr" | "rtl";
	showPath?: boolean;
	showHeader?: boolean;
};

export type ArtifactTreeNodeProps = {
	node: ArtifactTreeNode;
	depth: number;
	expanded: Record<string, boolean>;
	selectedFilePath?: string;
	onToggle: (id: string) => void;
	onSelectFile: (path: string) => void;
	direction: "ltr" | "rtl";
	showPath?: boolean;
};
