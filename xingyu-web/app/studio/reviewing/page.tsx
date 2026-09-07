import { StudioArticleListPage } from "@/components/community/studio-article-list-page";

export default function Page() {
  return (
    <StudioArticleListPage
      title="审核中"
      description="已提交、等待审核的文章"
      statusFilter={["IN_REVIEW"]}
    />
  );
}
