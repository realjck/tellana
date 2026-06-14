import type { AssetRef, Character, GraphEdge, GraphNode, GraphResponse, PublicStory, Scene, SceneSummary, Story, StorySummary, StoryNode } from "@/types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Resolve a relative /uploads/ path to a full backend URL */
export function resolveImage(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("/uploads/")) return `${API_BASE}${url}`;
  return url;
}

/** Resolve an AssetRef (or legacy string) to a displayable URL */
export function resolveAsset(ref: string | AssetRef | null | undefined): string {
  if (!ref) return "";
  if (typeof ref === "string") return resolveImage(ref);
  if (!ref.url) return "";
  if (ref.type === "upload") return resolveImage(ref.url);
  return ref.url;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Erreur inconnue" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  stories: {
    list: () => request<StorySummary[]>("/api/stories/"),
    get: (id: number) => request<Story>(`/api/stories/${id}`),
    getForPlay: (id: number) => request<PublicStory>(`/api/stories/${id}/play`),
    getBySlug: (slug: string, options?: RequestInit) =>
      request<PublicStory>(`/api/stories/by-slug/${slug}`, options),
    create: (title: string) =>
      request<Story>("/api/stories/", {
        method: "POST",
        body: JSON.stringify({ title }),
      }),
    update: (id: number, data: Partial<Pick<Story, "title">>) =>
      request<Story>(`/api/stories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    publish: (id: number) =>
      request<Story>(`/api/stories/${id}/publish`, { method: "POST" }),
    unpublish: (id: number) =>
      request<Story>(`/api/stories/${id}/unpublish`, { method: "POST" }),
    delete: (id: number) =>
      request<void>(`/api/stories/${id}`, { method: "DELETE" }),
  },
  scenes: {
    list: (storyId: number) =>
      request<SceneSummary[]>(`/api/stories/${storyId}/scenes/`),
    get: (storyId: number, sceneId: number) =>
      request<Scene>(`/api/stories/${storyId}/scenes/${sceneId}`),
    create: (storyId: number, title: string) =>
      request<Scene>(`/api/stories/${storyId}/scenes/`, {
        method: "POST",
        body: JSON.stringify({ title }),
      }),
    update: (storyId: number, sceneId: number, data: Partial<Scene>) =>
      request<Scene>(`/api/stories/${storyId}/scenes/${sceneId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (storyId: number, sceneId: number) =>
      request<void>(`/api/stories/${storyId}/scenes/${sceneId}`, {
        method: "DELETE",
      }),
    reorder: (storyId: number, order: number[]) =>
      request<SceneSummary[]>(`/api/stories/${storyId}/scenes/reorder`, {
        method: "POST",
        body: JSON.stringify({ order }),
      }),
  },
  nodes: {
    create: (
      storyId: number,
      sceneId: number,
      data: Pick<StoryNode, "type" | "data" | "order">
    ) =>
      request<StoryNode>(`/api/stories/${storyId}/scenes/${sceneId}/nodes/`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (
      storyId: number,
      sceneId: number,
      nodeId: number,
      data: Partial<Pick<StoryNode, "type" | "data" | "order">>
    ) =>
      request<StoryNode>(
        `/api/stories/${storyId}/scenes/${sceneId}/nodes/${nodeId}`,
        { method: "PATCH", body: JSON.stringify(data) }
      ),
    delete: (storyId: number, sceneId: number, nodeId: number) =>
      request<void>(
        `/api/stories/${storyId}/scenes/${sceneId}/nodes/${nodeId}`,
        { method: "DELETE" }
      ),
    reorder: (storyId: number, sceneId: number, order: number[]) =>
      request<StoryNode[]>(
        `/api/stories/${storyId}/scenes/${sceneId}/nodes/reorder`,
        { method: "POST", body: JSON.stringify({ order }) }
      ),
  },
  characters: {
    create: (storyId: number, data: Pick<Character, "name" | "color" | "sprites">) =>
      request<Character>(`/api/stories/${storyId}/characters/`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (
      storyId: number,
      charId: number,
      data: Partial<Pick<Character, "name" | "color" | "sprites">>
    ) =>
      request<Character>(`/api/stories/${storyId}/characters/${charId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (storyId: number, charId: number) =>
      request<void>(`/api/stories/${storyId}/characters/${charId}`, {
        method: "DELETE",
      }),
  },
  graph: {
    get: (storyId: number) =>
      request<GraphResponse>(`/api/stories/${storyId}/graph`),
    createNode: (
      storyId: number,
      data: { type: string; position_x: number; position_y: number; data: Record<string, unknown> }
    ) =>
      request<GraphNode>(`/api/stories/${storyId}/graph/nodes`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateNode: (
      storyId: number,
      nodeId: number,
      data: { position_x?: number; position_y?: number; data?: Record<string, unknown> }
    ) =>
      request<GraphNode>(`/api/stories/${storyId}/graph/nodes/${nodeId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    deleteNode: (storyId: number, nodeId: number) =>
      request<void>(`/api/stories/${storyId}/graph/nodes/${nodeId}`, { method: "DELETE" }),
    createEdge: (
      storyId: number,
      data: { source_node_id: number; target_node_id: number; label?: string | null; order?: number; source_handle?: string | null }
    ) =>
      request<GraphEdge>(`/api/stories/${storyId}/graph/edges`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    deleteEdge: (storyId: number, edgeId: number) =>
      request<void>(`/api/stories/${storyId}/graph/edges/${edgeId}`, { method: "DELETE" }),
  },
  assets: {
    upload: async (file: File): Promise<AssetRef> => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/api/assets/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Échec de l'upload");
      const data = await res.json();
      return {
        type: "upload",
        url: data.url,
        opfs_key: null,
        job_id: null,
        mime_type: file.type || null,
        width: null,
        height: null,
      };
    },
  },
};

/** Rainbow palette for character default colors */
export const RAINBOW_COLORS = [
  "#FF6B6B", "#FF9F43", "#FECA57", "#1DD1A1",
  "#48DBFB", "#54A0FF", "#9B59B6", "#FF9FF3",
];

export function randomCharacterColor(): string {
  return RAINBOW_COLORS[Math.floor(Math.random() * RAINBOW_COLORS.length)];
}

/** Default sprites available without upload */
export const DEFAULT_SPRITES = [
  { label: "Personnage homme", url: "/sprite_man.png" },
  { label: "Personnage femme", url: "/sprite_woman.png" },
  { label: "Alice — Défaut", url: "/sprites/alice_default.png" },
  { label: "Alice — Question", url: "/sprites/alice_question.png" },
  { label: "Alice — Bras croisés", url: "/sprites/alice_crossed.png" },
  { label: "Bob — Défaut", url: "/sprites/bob_default.png" },
  { label: "Bob — Question", url: "/sprites/bob_question.png" },
  { label: "Bob — Bras croisés", url: "/sprites/bob_crossed.png" },
];

/** Default backgrounds */
export const DEFAULT_BACKGROUNDS = [
  { label: "Bureau moderne", url: "/background_1.png" },
  { label: "Extérieur ville", url: "/background_2.png" },
];
