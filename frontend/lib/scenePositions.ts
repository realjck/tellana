import type { CharacterPosition } from "@/types";

export const DEFAULT_POSITIONS: CharacterPosition[] = [
  { x: -0.35, y: 0, scale: 1, flip_x: false },
  { x:  0.35, y: 0, scale: 1, flip_x: true  },
  { x: -0.7,  y: 0, scale: 1, flip_x: false },
  { x:  0.7,  y: 0, scale: 1, flip_x: true  },
];

export const FALLBACK_POSITION: CharacterPosition = { x: 0, y: 0, scale: 1, flip_x: false };
