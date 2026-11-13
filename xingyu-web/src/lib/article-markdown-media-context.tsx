import { createContext, useContext, useState, type ReactNode } from "react";
import { CommunityPrivateMediaImage } from "@/components/media/CommunityPrivateMediaImage";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

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

function ArticlePicture({
  src,
  alt,
  authenticatePrivateMedia,
  className,
}: {
  src: string;
  alt: string;
  authenticatePrivateMedia: boolean;
  className?: string;
}) {
  if (authenticatePrivateMedia) {
    return <CommunityPrivateMediaImage url={src} alt={alt} className={className} loading="lazy" />;
  }
  return <img src={src} alt={alt} className={className} loading="lazy" />;
}

export function ArticleMarkdownImg({ src, alt }: { src?: string | null; alt?: string | null }) {
  const { authenticatePrivateMedia } = useContext(ArticleMarkdownMediaContext);
  const [open, setOpen] = useState(false);
  const resolved = src ?? "";
  const label = alt?.trim() ? alt.trim() : "图片";

  if (!resolved) return null;

  return (
    <>
      <button
        type="button"
        className="article-image-zoom focus-ring"
        aria-label={`放大查看：${label}`}
        onClick={() => setOpen(true)}
      >
        <ArticlePicture
          src={resolved}
          alt={label}
          authenticatePrivateMedia={authenticatePrivateMedia}
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(92vw,72rem)] gap-0 border-border/70 bg-card p-3">
          <DialogTitle className="sr-only">{label}</DialogTitle>
          <DialogDescription className="sr-only">放大后的图片</DialogDescription>
          <ArticlePicture
            src={resolved}
            alt={label}
            authenticatePrivateMedia={authenticatePrivateMedia}
            className="mx-auto block max-h-[80vh] w-auto max-w-full rounded-lg"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
