import React from "react";
import { render, screen } from "@testing-library/react";
import ScenePreviewThumbnail from "@/components/ScenePreviewThumbnail";
import type { AssetRef, Character, CharacterPosition } from "@/types";

jest.mock("@/lib/api", () => ({
  resolveAsset: (ref: string | AssetRef | null | undefined) => {
    if (!ref) return "";
    if (typeof ref === "string") return ref;
    return ref.url ?? "";
  },
}));

const makeChar = (overrides: Partial<Character> = {}): Character => ({
  id: 1,
  story_id: 1,
  name: "Alice",
  sprites: {
    default: { type: "local", url: "/sprite_woman.png", opfs_key: null, job_id: null, mime_type: null, width: null, height: null },
  },
  ...overrides,
});

describe("ScenePreviewThumbnail", () => {
  it("rend le fond si backgroundAsset est fourni", () => {
    const bg: AssetRef = { type: "local", url: "/bg.png", opfs_key: null, job_id: null, mime_type: null, width: null, height: null };
    const { container } = render(
      <ScenePreviewThumbnail backgroundAsset={bg} characters={[]} characterPositions={{}} />
    );
    const bgDiv = container.querySelector("[style*='bg.png']");
    expect(bgDiv).toBeInTheDocument();
  });

  it("rend les sprites des personnages fournis", () => {
    render(
      <ScenePreviewThumbnail
        backgroundAsset={null}
        characters={[makeChar({ id: 1, name: "Alice" })]
        }
        characterPositions={{}}
      />
    );
    expect(screen.getByAltText("Alice")).toBeInTheDocument();
  });

  it("applique la position stockée si disponible", () => {
    const pos: CharacterPosition = { x: 0.5, y: 0, scale: 1, flip_x: false };
    render(
      <ScenePreviewThumbnail
        backgroundAsset={null}
        characters={[makeChar({ id: 1 })]}
        characterPositions={{ "1": pos }}
      />
    );
    const img = screen.getByAltText("Alice") as HTMLImageElement;
    // x=0.5 → left = ((0.5+1)/2)*100 = 75%
    expect(img).toHaveStyle({ left: "75%" });
  });

  it("utilise DEFAULT_POSITIONS[0] si aucune position stockée (x=-0.35 → left=32.5%)", () => {
    render(
      <ScenePreviewThumbnail
        backgroundAsset={null}
        characters={[makeChar({ id: 1 })]}
        characterPositions={{}}
      />
    );
    const img = screen.getByAltText("Alice") as HTMLImageElement;
    expect(img).toHaveStyle({ left: "32.5%" });
  });

  it("n'affiche pas de personnages si la liste est vide", () => {
    render(
      <ScenePreviewThumbnail backgroundAsset={null} characters={[]} characterPositions={{}} />
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
