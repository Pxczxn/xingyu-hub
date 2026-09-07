import { redirect } from "next/navigation";
export default function ArticleReviewPage({ params }: { params: { articleId: string } }) { redirect(`/studio/submissions/${params.articleId}`); }
