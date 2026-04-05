export type NodeType = "dialogue" | "text" | "quiz";
export type Position = "left" | "right";
export type QuizType = "qcm" | "qcu";

export interface Character {
  id: number;
  story_id: number;
  name: string;
  image_url: string;
  position: Position;
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
  story_id: number;
  order: number;
  type: NodeType;
  data: NodeData;
}

export interface Story {
  id: number;
  title: string;
  slug: string;
  published: boolean;
  background_url: string | null;
  created_at: string;
  updated_at: string;
  nodes: StoryNode[];
  characters: Character[];
}

export interface StorySummary {
  id: number;
  title: string;
  slug: string;
  published: boolean;
  background_url: string | null;
  created_at: string;
  updated_at: string;
}
