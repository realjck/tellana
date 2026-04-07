import type { AssetRef, Character, Story, StorySummary, StoryNode } from "@/types";

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
    getBySlug: (slug: string, options?: RequestInit) =>
      request<Story>(`/api/stories/by-slug/${slug}`, options),
    create: (title: string) =>
      request<Story>("/api/stories/", {
        method: "POST",
        body: JSON.stringify({ title }),
      }),
    update: (id: number, data: Partial<Story>) =>
      request<Story>(`/api/stories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      request<void>(`/api/stories/${id}`, { method: "DELETE" }),
  },
  nodes: {
    create: (
      storyId: number,
      data: Pick<StoryNode, "type" | "data" | "order">
    ) =>
      request<StoryNode>(`/api/stories/${storyId}/nodes/`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (
      storyId: number,
      nodeId: number,
      data: Partial<Pick<StoryNode, "type" | "data" | "order">>
    ) =>
      request<StoryNode>(`/api/stories/${storyId}/nodes/${nodeId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (storyId: number, nodeId: number) =>
      request<void>(`/api/stories/${storyId}/nodes/${nodeId}`, {
        method: "DELETE",
      }),
    reorder: (storyId: number, order: number[]) =>
      request<StoryNode[]>(`/api/stories/${storyId}/nodes/reorder`, {
        method: "POST",
        body: JSON.stringify({ order }),
      }),
  },
  characters: {
    create: (
      storyId: number,
      data: Pick<Character, "name" | "sprites">
    ) =>
      request<Character>(`/api/stories/${storyId}/characters/`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (
      storyId: number,
      charId: number,
      data: Partial<Pick<Character, "name" | "sprites">>
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

/** Default sprites available without upload */
export const DEFAULT_SPRITES = [
  { label: "Personnage homme", url: "/sprite_man.png" },
  { label: "Personnage femme", url: "/sprite_woman.png" },
];

/** Default backgrounds */
export const DEFAULT_BACKGROUNDS = [
  { label: "Bureau moderne", url: "/background_1.png" },
  { label: "Extérieur ville", url: "/background_2.png" },
];
