import { cn } from "@/lib/cn";
import heroArtwork from "@/assets/home-hero-generated.webp";

/*
 * Decorative hero artwork for the home banner.
 *
 * Generated artwork kept local to the bundle: there is no remote dependency and
 * it remains available when the page is opened offline. It is `aria-hidden` at
 * the call site — it carries no information for a screen reader.
 *
 * The palette is deliberately warm (cream sky, amber moon, dusk-blue hills) to
 * match the banner's gold tone rather than the navy/gold UI chrome: this is
 * artwork, so it does not resolve through the semantic tokens.
 */
export function HomeHeroArt({ className }: { className?: string }) {
  return <img data-testid="home-hero-art" src={heroArtwork} alt="" aria-hidden="true" className={cn("h-32 w-auto rounded-xl object-cover md:h-36 lg:h-40", className)} />;
}
