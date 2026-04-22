import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import type { PublicStory } from "./types";
import MultiScenePlayer from "./components/MultiScenePlayer";
import "./app/globals.css";

function PlayerApp() {
  const [story, setStory] = useState<PublicStory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("data/story.json")
      .then((r) => r.json())
      .then(setStory)
      .catch(() => setError("Impossible de charger la story."));
  }, []);

  if (error) {
    return (
      <div style={{ color: "white", padding: "2rem", textAlign: "center" }}>
        {error}
      </div>
    );
  }

  if (!story) return null;

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <h1 className="text-white/50 text-sm font-medium text-center mb-4">
          {story.title}
        </h1>
        <MultiScenePlayer
          scenes={story.scenes}
          characters={story.characters}
          title={story.title}
        />
      </div>
    </div>
  );
}

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<PlayerApp />);
}
