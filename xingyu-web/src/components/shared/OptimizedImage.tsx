import { useState, useEffect, ImgHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/*
 * OptimizedImage — 优化的图片组件
 *
 * 功能：
 * 1. WebP 格式支持 + 自动降级
 * 2. 占位符（防止布局偏移）
 * 3. 懒加载
 * 4. 加载状态和错误处理
 * 5. 响应式图片（可选）
 */

interface OptimizedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onLoad' | 'onError'> {
  src: string;
  alt: string;
  /** 是否支持 WebP，默认 true */
  webp?: boolean;
  /** 占位符类型 */
  placeholder?: "blur" | "shimmer" | "none";
  /** 占位符背景色 */
  placeholderColor?: string;
  /** 错误时的降级内容 */
  fallback?: React.ReactNode;
}

/**
 * 将图片 URL 转换为 WebP 格式
 * 实际项目中应该由后端 CDN 或图床服务处理
 * 这里只是示例逻辑
 */
function toWebP(url: string): string {
  // 如果已经是 WebP，直接返回
  if (url.endsWith('.webp')) return url;
  
  // 如果有查询参数，添加 format=webp
  if (url.includes('?')) {
    return `${url}&format=webp`;
  }
  
  // 简单替换扩展名（实际应该由服务端处理）
  return url.replace(/\.(jpg|jpeg|png)$/i, '.webp');
}

/**
 * 检测浏览器是否支持 WebP
 */
function checkWebPSupport(): Promise<boolean> {
  return new Promise((resolve) => {
    const webP = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
    const img = new Image();
    img.onload = () => resolve(img.width > 0 && img.height > 0);
    img.onerror = () => resolve(false);
    img.src = webP;
  });
}

export function OptimizedImage({
  src,
  alt,
  webp = true,
  placeholder = "shimmer",
  placeholderColor = "hsl(var(--muted))",
  fallback,
  className,
  ...props
}: OptimizedImageProps) {
  const [imageSrc, setImageSrc] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [supportsWebP, setSupportsWebP] = useState(false);

  // 检测 WebP 支持
  useEffect(() => {
    if (webp) {
      checkWebPSupport().then(setSupportsWebP);
    }
  }, [webp]);

  // 设置图片源
  useEffect(() => {
    if (!src) {
      setHasError(true);
      return;
    }

    // 如果支持 WebP 且启用了 WebP 优化，使用 WebP 版本
    const finalSrc = webp && supportsWebP ? toWebP(src) : src;
    setImageSrc(finalSrc);
  }, [src, webp, supportsWebP]);

  // 处理图片加载完成
  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  // 处理图片加载失败
  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    
    // 如果 WebP 加载失败，尝试回退到原始格式
    if (webp && supportsWebP && imageSrc.includes('webp')) {
      setImageSrc(src);
    }
  };

  // 错误降级
  if (hasError && fallback) {
    return <>{fallback}</>;
  }

  if (hasError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          className,
        )}
        aria-label="图片加载失败"
      >
        <svg
          className="h-1/3 w-1/3 opacity-50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* 占位符 */}
      {isLoading && placeholder !== "none" && (
        <div
          className={cn(
            "absolute inset-0",
            placeholder === "shimmer" && "animate-pulse",
          )}
          style={{ backgroundColor: placeholderColor }}
          aria-hidden
        >
          {placeholder === "shimmer" && (
            <div className="shimmer-effect h-full w-full" />
          )}
        </div>
      )}

      {/* 实际图片 */}
      {imageSrc && (
        <img
          {...props}
          src={imageSrc}
          alt={alt}
          loading="lazy"
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            "transition-opacity duration-300",
            isLoading ? "opacity-0" : "opacity-100",
            className,
          )}
        />
      )}
    </div>
  );
}

/**
 * 专门用于内容封面的优化图片组件
 */
export function ContentCoverImage({
  src,
  alt,
  className,
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-gradient-to-br from-accent/10 to-accent/5",
          className,
        )}
        aria-hidden
      >
        <svg
          className="h-1/2 w-1/2 text-accent/30"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  return (
    <OptimizedImage
      src={src}
      alt={alt}
      className={cn("h-full w-full object-cover", className)}
      placeholder="shimmer"
      fallback={
        <div
          className={cn(
            "flex items-center justify-center bg-muted",
            className,
          )}
          aria-label="封面图片"
        />
      }
    />
  );
}
