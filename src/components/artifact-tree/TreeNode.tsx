import {
  ChevronDown,
  ChevronRight,
  File,
  FileImage,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TreeNodeContextMenu } from "./TreeNodeContextMenu";
import type { ArtifactTreeNodeProps } from "./types";

function FileTypeIcon({ name, className }: { name: string; className?: string }) {
  const lower = name.toLowerCase();
  if (/\.(png|jpg|jpeg|webp|gif|svg)$/i.test(lower)) {
    return <FileImage className={className} />;
  }
  if (/\.(md|txt)$/i.test(lower)) {
    return <FileText className={className} />;
  }
  if (/\.(json|ya?ml)$/i.test(lower)) {
    return <FileJson className={className} />;
  }
  return <File className={className} />;
}

function getIndentStyle(depth: number, direction: "ltr" | "rtl") {
  const offset = 8 + depth * 16;
  return direction === "rtl"
    ? { paddingRight: `${offset}px` }
    : { paddingLeft: `${offset}px` };
}

export function TreeNode({
  node,
  depth,
  expanded,
  selectedFilePath,
  onToggle,
  onSelectFile,
  direction,
  showPath,
}: ArtifactTreeNodeProps) {
  if (node.kind === "file") {
    const selected = node.filePath === selectedFilePath;

    return (
      <TreeNodeContextMenu>
        <button
          type="button"
          onClick={() => {
            if (node.filePath) onSelectFile(node.filePath);
          }}
          className={cn(
            "flex w-full items-start gap-1.5 rounded-md px-2 py-1 text-sm transition",
            direction === "rtl" ? "flex-row-reverse text-right" : "text-left",
            selected
              ? "bg-indigo-50 text-indigo-700"
              : "text-slate-600 hover:bg-slate-100",
          )}
          style={getIndentStyle(depth, direction)}
          title={node.path}
        >
          <FileTypeIcon name={node.name} className="size-3.5" />
          <span className="min-w-0 flex-1">
            <span className="block truncate">{node.name}</span>
            {showPath && (
              <span className="block truncate text-[11px] text-slate-400">
                {node.relativePath ?? node.path}
              </span>
            )}
          </span>
        </button>
      </TreeNodeContextMenu>
    );
  }

  const isOpen = !!expanded[node.id];

  return (
    <TreeNodeContextMenu>
      <div>
        <button
          type="button"
          onClick={() => onToggle(node.id)}
          className={cn(
            "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100",
            direction === "rtl" ? "flex-row-reverse text-right" : "text-left",
          )}
          style={getIndentStyle(depth, direction)}
          title={node.path}
        >
          {isOpen ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
          {isOpen ? (
            <FolderOpen className="size-3.5 text-amber-600" />
          ) : (
            <Folder className="size-3.5 text-amber-600" />
          )}
          <span className="truncate">{node.name}</span>
        </button>

        {isOpen && (
          <div>
            {node.children.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                expanded={expanded}
                selectedFilePath={selectedFilePath}
                onToggle={onToggle}
                onSelectFile={onSelectFile}
                direction={direction}
                showPath={showPath}
              />
            ))}
          </div>
        )}
      </div>
    </TreeNodeContextMenu>
  );
}
