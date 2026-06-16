import React from "react";
import { render, screen, act } from "@testing-library/react";
import { resolveImage, resolveAsset } from "@/lib/api";
import { useAssetBust, bustAssetCache } from "@/lib/assetBust";

describe("resolveImage cache-bust param", () => {
  it("n'ajoute pas de ?v sans bust", () => {
    expect(resolveImage("/uploads/a.png")).toBe("http://localhost:8000/uploads/a.png");
  });

  it("ajoute ?v=N avec bust > 0", () => {
    expect(resolveImage("/uploads/a.png", 3)).toBe("http://localhost:8000/uploads/a.png?v=3");
  });

  it("ignore le bust pour les refs non-upload", () => {
    expect(resolveAsset({ type: "generated", url: "blob:x" } as never, 3)).toBe("blob:x");
  });
});

// Reproduit le scénario réel : le prop `sprite` ne change pas, seul le bump global
// doit faire évoluer le src. Si `bust` n'est pas une dépendance de resolveAsset,
// React Compiler réutiliserait l'URL mémoïsée et ce test échouerait.
function StablePreview({ sprite }: { sprite: string }) {
  const bust = useAssetBust();
  return <img alt="preview" src={resolveAsset(sprite, bust)} />;
}

describe("useAssetBust force le rechargement d'un src stable", () => {
  it("met à jour le src après bustAssetCache, prop inchangé", () => {
    render(<StablePreview sprite="/uploads/alice/default.png" />);
    const before = screen.getByAltText("preview").getAttribute("src");
    expect(before).toBe("http://localhost:8000/uploads/alice/default.png");

    act(() => { bustAssetCache(); });

    const after = screen.getByAltText("preview").getAttribute("src");
    expect(after).toMatch(/\/uploads\/alice\/default\.png\?v=\d+$/);
    expect(after).not.toBe(before);
  });
});
