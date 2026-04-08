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
}

export interface TextNodeData {
  character_id: number | null;
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

export interface SceneSummary {
  id: number;
  story_id: number;
  title: string;
  order: number;
  background_asset: AssetRef | null;
  background_loop: boolean;
  created_at: string;
  updated_at: string;
}

export interface Scene extends SceneSummary {
  nodes: StoryNode[];
  character_ids: number[];
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
