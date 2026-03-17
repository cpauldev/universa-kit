import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import * as React from "react";

import type { FileTreeNode } from "../types.js";
import { cn } from "./utils.js";

export interface FileTreeProps {
  nodes: FileTreeNode[];
  selectedPath?: string | null;
  forceExpand?: boolean;
  onFileClick?: (path: string) => void;
  fileIconRenderer?: (node: FileTreeNode) => React.ReactNode;
}

interface FileNodeProps {
  node: FileTreeNode;
  selectedPath?: string | null;
  forceExpand?: boolean;
  onFileClick?: (path: string) => void;
  fileIconRenderer?: (node: FileTreeNode) => React.ReactNode;
}

function FileIcon({
  node,
  renderer,
}: {
  node: FileTreeNode;
  renderer?: (n: FileTreeNode) => React.ReactNode;
}) {
  return (
    <span aria-hidden="true" className="shrink-0 text-muted-foreground">
      {renderer?.(node)}
    </span>
  );
}

function FileNode({
  node,
  selectedPath,
  forceExpand,
  onFileClick,
  fileIconRenderer,
}: FileNodeProps) {
  const [expanded, setExpanded] = React.useState(forceExpand ?? false);

  React.useEffect(() => {
    if (forceExpand !== undefined) setExpanded(forceExpand);
  }, [forceExpand]);

  if (node.type === "directory") {
    return (
      <li>
        <button
          type="button"
          className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm leading-[1.4] outline-none hover:bg-secondary/70 focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
        >
          <ChevronRight
            aria-hidden="true"
            className={cn(
              "size-3 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-90",
            )}
          />
          {expanded ? (
            <FolderOpen
              aria-hidden="true"
              className="size-3.5 shrink-0 text-blue-600 dark:text-blue-400"
            />
          ) : (
            <Folder
              aria-hidden="true"
              className="size-3.5 shrink-0 text-blue-600 dark:text-blue-400"
            />
          )}
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
        </button>
        {expanded && node.children && node.children.length > 0 && (
          <ul className="ml-[9px] border-l border-border pl-2">
            {node.children.map((child) => (
              <FileNode
                key={child.path}
                node={child}
                selectedPath={selectedPath}
                forceExpand={forceExpand}
                onFileClick={onFileClick}
                fileIconRenderer={fileIconRenderer}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm leading-[1.4] outline-none hover:bg-secondary/70 focus-visible:ring-2 focus-visible:ring-ring",
          node.path === selectedPath && "bg-primary/10 text-primary",
        )}
        onClick={() => onFileClick?.(node.path)}
      >
        <FileIcon node={node} renderer={fileIconRenderer} />
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
      </button>
    </li>
  );
}

export const FileTree = ({
  nodes,
  selectedPath,
  forceExpand,
  onFileClick,
  fileIconRenderer,
}: FileTreeProps) => (
  <div className="py-0.5">
    <ul className="m-0 list-none p-0">
      {nodes.map((node) => (
        <FileNode
          key={node.path}
          node={node}
          selectedPath={selectedPath}
          forceExpand={forceExpand}
          onFileClick={onFileClick}
          fileIconRenderer={fileIconRenderer}
        />
      ))}
    </ul>
  </div>
);

export function filterFileTree(
  nodes: FileTreeNode[],
  query: string,
): { nodes: FileTreeNode[]; forceExpand: boolean } {
  const q = query.toLowerCase();

  function matchesNode(node: FileTreeNode): boolean {
    return node.name.toLowerCase().includes(q);
  }

  function filterNodes(list: FileTreeNode[]): FileTreeNode[] {
    const result: FileTreeNode[] = [];
    for (const node of list) {
      if (node.type === "directory") {
        const filteredChildren = filterNodes(node.children ?? []);
        if (filteredChildren.length > 0 || matchesNode(node)) {
          result.push({
            ...node,
            children:
              filteredChildren.length > 0 ? filteredChildren : node.children,
          });
        }
      } else if (matchesNode(node)) {
        result.push(node);
      }
    }
    return result;
  }

  return { nodes: filterNodes(nodes), forceExpand: true };
}
