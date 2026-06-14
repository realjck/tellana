import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import type { GraphResponse, PublicStory } from "./types";
import GraphPlayer from "./components/GraphPlayer";
import "./app/globals.css";

function PlayerApp() {
  const [story, setStory] = useState<PublicStory | null>(null);
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("data/story.json").then((r) => r.json()),
      fetch("data/graph.json").then((r) => r.json()),
    ])
      .then(([s, g]) => {
        setStory(s as PublicStory);
        setGraph(g as GraphResponse);
      })
      .catch(() => setError("Impossible de charger la story."));
  }, []);

  if (error) {
    return (
      <div style={{ color: "white", padding: "2rem", textAlign: "center" }}>
        {error}
      </div>
    );
  }

  if (!story || !graph) return null;

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <h1 className="text-white/50 text-sm font-medium text-center mb-4">
          {story.title}
        </h1>
        <GraphPlayer story={story} graph={graph} storyId={story.id} />
      </div>
    </div>
  );
}

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<PlayerApp />);
}
