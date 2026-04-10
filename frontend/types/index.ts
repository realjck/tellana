export type NodeType = "dialogue" | "text" | "quiz";
export type QuizType = "qcm" | "qcu";

export type AssetSource = "upload" | "remote" | "local" | "generated";

export interface AssetRef {
  type: AssetSource;
  url: string | null;
  opfs_key: string | null;
  job_id: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
}

export interface Character {
  id: number;
  story_id: number;
  name: string;
  sprites: Record<string, AssetRef>;
}

export interface QuizOption {
  text: string;
  is_correct: boolean;
}

export interface DialogueNodeData {
  character_id: number | null;
  text: string;
  /** Per-character pose key: Record<charId (string), pose name> */
  sprite_keys?: Record<string, string>;
}

export interface TextNodeData {
  text: string;
}

export interface QuizNodeData {
  question: string;
  type: QuizType;
  feedback: string;
  options: QuizOption[];
}

export type NodeData = DialogueNodeData | TextNodeData | QuizNodeData;

export interface StoryNode {
  id: number;
  scene_id: number;
  order: number;
  type: NodeType;
  data: NodeData;
}

export interface CharacterPosition {
  x: number;       // -1 to +1, 0 = center
  y: number;       // -1 to +1, 0 = default vertical
  scale: number;   // 0 (excl.) to 2.5, 1 = 100% of scene height
  flip_x: boolean;
}

export interface SceneSummary {
  id: number;
  story_id: number;
  title: string;
  order: number;
  background_asset: AssetRef | null;
  background_loop: boolean;
  character_ids: number[];
  character_positions: Record<string, CharacterPosition>;
  created_at: string;
  updated_at: string;
}

export interface Scene extends SceneSummary {
  nodes: StoryNode[];
  bg_custom_uploads: string[];
}

export interface Story {
  id: number;
  title: string;
  slug: string;
  published: boolean;
  created_at: string;
  updated_at: string;
  scenes: SceneSummary[];
  characters: Character[];
}

export interface StorySummary {
  id: number;
  title: string;
  slug: string;
  published: boolean;
  first_scene_background: AssetRef | null;
  first_scene_character_ids: number[];
  first_scene_character_positions: Record<string, CharacterPosition>;
  characters: Character[];
  created_at: string;
  updated_at: string;
}

// For the public player: scenes include their nodes
export interface PublicStory {
  id: number;
  title: string;
  slug: string;
  published: boolean;
  created_at: string;
  updated_at: string;
  scenes: Scene[];
  characters: Character[];
}
