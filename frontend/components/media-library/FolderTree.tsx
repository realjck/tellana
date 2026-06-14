"use client";

import useSWR from "swr";
import { api, API_BASE } from "@/lib/api";
import type { MediaLibraryConfig } from "@/types";

type TreeNode = { name: string; path: string; children: TreeNode[] };

function buildTree(folders: string[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  for (const path of folders) {
    const parts = path.split("/");
    for (let i = 0; i < parts.length; i++) {
      const fullPath = parts.slice(0, i + 1).join("/");
      if (!map.has(fullPath)) {
        const node: TreeNode = { name: parts[i], path: fullPath, children: [] };
        map.set(fullPath, node);
        if (i === 0) roots.push(node);
        else map.get(parts.slice(0, i).join("/"))!.children.push(node);
      }
    }
  }
  return roots;
}

interface Props {
  config: MediaLibraryConfig;
  selectedFolder: string | null;
  onSelectFolder: (folder: string) => void;
}

function TreeNodeItem({
  node,
  selectedFolder,
  onSelectFolder,
  depth,
}: {
  node: TreeNode;
  selectedFolder: string | null;
  onSelectFolder: (folder: string) => void;
  depth: number;
}) {
  const isSelected = node.path === selectedFolder;
  return (
    <div>
      <div
        data-selected={isSelected ? "true" : undefined}
        onClick={() => onSelectFolder(node.path)}
        className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-sm select-none ${
          isSelected
            ? "bg-primary/20 text-fore font-medium"
            : "text-muted hover:bg-elevated hover:text-fore"
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <span>{node.children.length > 0 ? "▸" : "·"}</span>
        <span>{node.name}</span>
      </div>
      {node.children.map((child) => (
        <TreeNodeItem
          key={child.path}
          node={child}
          selectedFolder={selectedFolder}
          onSelectFolder={onSelectFolder}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export default function FolderTree({ config, selectedFolder, onSelectFolder }: Props) {
  const { data: folders = [], mutate } = useSWR<string[]>(
    "asset-folders",
    api.assets.getFolders
  );

  const filtered = config.allowedFolders
    ? folders.filter((f) =>
        config.allowedFolders!.some(
          (a) => f === a || f.startsWith(a + "/") || a.startsWith(f + "/")
        )
      )
    : folders;

  const tree = buildTree(filtered);

  const handleNewFolder = async () => {
    const name = prompt("Nom du nouveau dossier :")?.trim();
    if (!name) return;
    const folder = selectedFolder ? `${selectedFolder}/${name}` : name;
    const formData = new FormData();
    formData.append("file", new Blob([], { type: "application/x-empty" }), ".keep");
    formData.append("folder", folder);
    const res = await fetch(`${API_BASE}/api/assets`, { method: "POST", body: formData });
    if (!res.ok) return;
    await mutate();
  };

  return (
    <div className="flex flex-col h-full py-2">
      <div className="flex-1 overflow-y-auto">
        {tree.map((node) => (
          <TreeNodeItem
            key={node.path}
            node={node}
            selectedFolder={selectedFolder}
            onSelectFolder={onSelectFolder}
            depth={0}
          />
        ))}
      </div>
      {config.mode === "navigation" && (
        <div className="px-2 py-2 flex-shrink-0 border-t border-white/10">
          <button
            onClick={handleNewFolder}
            className="w-full text-left text-xs text-muted hover:text-fore px-2 py-1 rounded hover:bg-elevated transition-colors"
          >
            + Nouveau dossier
          </button>
        </div>
      )}
    </div>
  );
}
