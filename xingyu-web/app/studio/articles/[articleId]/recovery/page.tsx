import { redirect } from "next/navigation";
export default function DraftRecoveryPage({ params }: { params: { articleId: string } }) { redirect(`/studio/articles/${params.articleId}/edit`); }
