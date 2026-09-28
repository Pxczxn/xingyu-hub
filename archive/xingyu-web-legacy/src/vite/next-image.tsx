import type { ImgHTMLAttributes } from "react";

type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src: string; fill?: boolean; priority?: boolean };

export default function Image({ fill, priority: _priority, style, className, ...props }: ImageProps) {
  return <img {...props} className={className} style={fill ? { position: "absolute", inset: 0, width: "100%", height: "100%", ...style } : style} />;
}
