import { redirect } from "next/navigation";
export default function ArticlePreflightPage({ params }: { params: { articleId: string } }) { redirect(`/studio/articles/${params.articleId}/submit`); }
