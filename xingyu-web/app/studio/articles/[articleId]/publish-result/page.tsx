import { redirect } from "next/navigation";
export default function ArticlePublishResultPage({ params }: { params: { articleId: string } }) { redirect(`/articles/${params.articleId}`); }
