import { redirect } from "next/navigation";
export default function DraftConflictPage({ params }: { params: { articleId: string } }) { redirect(`/studio/articles/${params.articleId}/edit`); }
