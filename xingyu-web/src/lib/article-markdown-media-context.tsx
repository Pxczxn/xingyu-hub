import { createContext, useContext, type ReactNode } from "react";
import { CommunityPrivateMediaImage } from "@/components/media/CommunityPrivateMediaImage";

type ArticleMarkdownMediaContextValue = {
  /** 仅编辑器草稿预览：对同源私有媒体走认证 fetch，绝不在 URL 上挂 satoken。 */
  authenticatePrivateMedia: boolean;
};

const ArticleMarkdownMediaContext = createContext<ArticleMarkdownMediaContextValue>({
  authenticatePrivateMedia: false,
});

export function ArticleMarkdownMediaProvider({
  authenticatePrivateMedia,
  children,
}: {
  authenticatePrivateMedia: boolean;
  children: ReactNode;
}) {
  return (
    <ArticleMarkdownMediaContext.Provider value={{ authenticatePrivateMedia }}>
      {children}
    </ArticleMarkdownMediaContext.Provider>
  );
}

export function ArticleMarkdownImg({ src, alt }: { src?: string | null; alt?: string | null }) {
  const { authenticatePrivateMedia } = useContext(ArticleMarkdownMediaContext);
  const resolved = src ?? "";

  if (authenticatePrivateMedia) {
    return <CommunityPrivateMediaImage url={resolved} alt={alt ?? ""} loading="lazy" />;
  }

  return <img src={resolved} alt={alt ?? ""} loading="lazy" />;
}
