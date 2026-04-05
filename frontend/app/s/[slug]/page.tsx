import { api } from "@/lib/api";
import PublicPlayer from "./PublicPlayer";

export default async function PublicStoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let story;
  try {
    story = await api.stories.getBySlug(slug);
  } catch {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center text-slate-400">
          <div className="text-4xl mb-4">📭</div>
          <p className="text-lg font-medium text-white mb-2">Story introuvable</p>
          <p className="text-sm">
            Cette story n&apos;existe pas ou n&apos;est pas publiée.
          </p>
        </div>
      </div>
    );
  }

  return <PublicPlayer story={story} />;
}
