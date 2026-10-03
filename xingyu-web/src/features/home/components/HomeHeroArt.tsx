import { cn } from "@/lib/cn";

/*
 * Decorative hero artwork for the home banner.
 *
 * Pure SVG, no raster asset and no network request, so it renders instantly and
 * scales with the card. It is `aria-hidden` at the call site — it carries no
 * information, and a screen reader announcing "night sky" would be noise.
 *
 * The palette is deliberately warm (cream sky, amber moon, dusk-blue hills) to
 * match the banner's gold tone rather than the navy/gold UI chrome: this is
 * artwork, so it does not resolve through the semantic tokens.
 */
export function HomeHeroArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 190"
      aria-hidden
      focusable="false"
      className={cn("h-32 w-auto md:h-36 lg:h-40", className)}
    >
      <defs>
        <linearGradient id="home-hero-sky" x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0%" stopColor="#FDF8EC" />
          <stop offset="55%" stopColor="#F8E9CD" />
          <stop offset="100%" stopColor="#F0DBB6" />
        </linearGradient>
        <radialGradient id="home-hero-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="home-hero-hill-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#517192" />
          <stop offset="100%" stopColor="#31506E" />
        </linearGradient>
        <linearGradient id="home-hero-hill-near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2C4459" />
          <stop offset="100%" stopColor="#1A2B3D" />
        </linearGradient>
      </defs>

      <rect width="320" height="190" rx="16" fill="url(#home-hero-sky)" />

      {/* Moon: a wide soft glow under a solid disc, with two craters. */}
      <circle cx="236" cy="60" r="52" fill="url(#home-hero-glow)" />
      <circle cx="236" cy="60" r="30" fill="#F7EAD1" />
      <circle cx="226" cy="52" r="5" fill="#E8D5B1" />
      <circle cx="246" cy="70" r="3.5" fill="#E8D5B1" opacity="0.85" />

      <g fill="#FFFFFF">
        <circle cx="52" cy="38" r="1.8" />
        <circle cx="96" cy="24" r="1.2" opacity="0.8" />
        <circle cx="140" cy="46" r="1.6" />
        <circle cx="176" cy="28" r="1.1" opacity="0.75" />
        <circle cx="286" cy="34" r="1.5" />
        <circle cx="300" cy="76" r="1.2" opacity="0.7" />
        <circle cx="70" cy="76" r="1.3" opacity="0.7" />
      </g>

      {/* Layered hills — the far ridge sits higher, the near one anchors the card. */}
      <path
        d="M0 132 C 48 108, 92 126, 138 118 C 186 110, 232 130, 320 112 L320 190 L0 190 Z"
        fill="url(#home-hero-hill-far)"
      />
      <path
        d="M0 160 C 62 138, 120 168, 186 152 C 240 139, 286 156, 320 146 L320 190 L0 190 Z"
        fill="url(#home-hero-hill-near)"
      />
    </svg>
  );
}
