import { redirect } from "next/navigation";

type Params = Promise<{ id: string }>;

export default async function OldEditRedirect({ params }: { params: Params }) {
  const { id } = await params;
  redirect(`/stories/${id}`);
}
