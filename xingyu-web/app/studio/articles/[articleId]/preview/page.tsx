import { redirect } from "next/navigation";
export default function ArticlePreviewPage({ params }: { params: { articleId: string } }) { redirect(`/articles/${params.articleId}`); }
