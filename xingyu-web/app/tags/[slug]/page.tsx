import { redirect } from "next/navigation";

export default async function LegacyTagDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/topics/${encodeURIComponent(slug)}`);
}
