import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// Brand palette + semantic tokens are sourced from docs/design-system/MASTER.md.
// All colors are semanticized in src/styles/tokens.css; components reference the
// semantic CSS variables (--background, --foreground, --primary, --accent, ...),
// never raw hex values.
//
// 2026-11-10 palette switch (白 + 干净). The mapping was chosen from MEASURED call
// site counts, so that no component needs editing:
//   primary          #111827 near-black — 213 `text-primary` headings + 41
//                    `bg-primary` primary buttons both want ink
//   accent           #111827 near-black — 121 `bg-accent` CTAs / badges /
//                    active blocks; this is why the accent stopped being blue
//   accent.strong    #2563EB — THE one blue text outlet (links, eyebrows,
//                    highlights, 5.17:1 on white). Together with --ring and
//                    --accent-line it is the only blue in the system.
//   primary.soft     neutral wash #F4F6F8 — it is NOT blue any more
//   tint-*           all eight domain families now resolve to #F7F7F8 /
//                    #111827 ink. Keys are kept because `bg-tint-*` call sites
//                    already exist (BleedBand.tsx).
//   foreground-muted / foreground-subtle / foreground-disabled
//                    text ladder: body / decoration-or-disabled / disabled-only
//   success / warning / danger
//                    status pairs: `-soft` wash + the base colour as text.
//   boxShadow        card / hover / floating (plus legacy e0/e1)
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
  	extend: {
  		colors: {
  			border: {
  				DEFAULT: 'hsl(var(--border))',
  				strong: 'hsl(var(--border-strong))'
  			},
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			'foreground-soft': 'hsl(var(--foreground-soft))',
  			/*
  			 * Text ladder. `foreground-soft` is the READABLE auxiliary step
  			 * (#6B7280, 4.83:1); `foreground-subtle` (#9CA3AF) is decoration/disabled
  			 * only and must never carry reading.
  			 */
  			'foreground-muted': 'hsl(var(--foreground-muted))',
  			'foreground-subtle': 'hsl(var(--foreground-subtle))',
  			'foreground-disabled': 'hsl(var(--foreground-disabled))',
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			/*
  			 * Primary — near-black #111827, because it carries BOTH `text-primary`
  			 * (213 heading sites) and `bg-primary` (41 primary buttons). White on it
  			 * measures 17.74:1; hover goes to #000000 (21.00:1). `soft` is the neutral
  			 * #F4F6F8 wash — it is NOT a blue tint any more.
  			 */
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))',
  				hover: 'hsl(var(--primary-hover))',
  				soft: 'hsl(var(--primary-soft))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))',
  				strong: 'hsl(var(--accent-strong))',
  				soft: 'hsl(var(--accent-soft))',
  				line: 'hsl(var(--accent-line))'
  			},
  			'surface-sunken': 'hsl(var(--surface-sunken))',
  			/*
  			 * Domain tints. Eight families, each with three roles:
  			 *   DEFAULT  the wash      -> bg-tint-topics
  			 *   ink      text on wash  -> text-tint-topics-ink (>=4.5:1 by measurement)
  			 *   line     hairline      -> border-tint-topics-line
  			 * `-line` is a COMPLETE colour (color-mix with alpha), so Tailwind's
  			 * opacity modifier (`border-tint-topics-line/50`) does not apply to it;
  			 * the alpha already lives in the token.
  			 *
  			 * 2026-11-10 palette switch: every family now resolves to the same neutral
  			 * #F7F7F8 wash + #111827 ink (tokens.css §4). The KEYS stay: `bg-tint-*`
  			 * call sites already exist (BleedBand.tsx), and a deleted key is a class
  			 * that silently stops generating.
  			 */
  			'tint-home': {
  				DEFAULT: 'hsl(var(--tint-home))',
  				ink: 'hsl(var(--tint-home-ink))',
  				line: 'var(--tint-home-line)'
  			},
  			'tint-discover': {
  				DEFAULT: 'hsl(var(--tint-discover))',
  				ink: 'hsl(var(--tint-discover-ink))',
  				line: 'var(--tint-discover-line)'
  			},
  			'tint-topics': {
  				DEFAULT: 'hsl(var(--tint-topics))',
  				ink: 'hsl(var(--tint-topics-ink))',
  				line: 'var(--tint-topics-line)'
  			},
  			'tint-series': {
  				DEFAULT: 'hsl(var(--tint-series))',
  				ink: 'hsl(var(--tint-series-ink))',
  				line: 'var(--tint-series-line)'
  			},
  			'tint-galaxies': {
  				DEFAULT: 'hsl(var(--tint-galaxies))',
  				ink: 'hsl(var(--tint-galaxies-ink))',
  				line: 'var(--tint-galaxies-line)'
  			},
  			'tint-moments': {
  				DEFAULT: 'hsl(var(--tint-moments))',
  				ink: 'hsl(var(--tint-moments-ink))',
  				line: 'var(--tint-moments-line)'
  			},
  			'tint-guide': {
  				DEFAULT: 'hsl(var(--tint-guide))',
  				ink: 'hsl(var(--tint-guide-ink))',
  				line: 'var(--tint-guide-line)'
  			},
  			'tint-studio': {
  				DEFAULT: 'hsl(var(--tint-studio))',
  				ink: 'hsl(var(--tint-studio-ink))',
  				line: 'var(--tint-studio-line)'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			/*
  			 * Status pairs. `-soft` is the wash; the base key is the TEXT-safe colour
  			 * measured against that wash and against white (>=4.5:1); `-foreground` is
  			 * the label colour for a solid fill of the same hue.
  			 */
  			success: {
  				DEFAULT: 'hsl(var(--success))',
  				foreground: 'hsl(var(--success-foreground))',
  				soft: 'hsl(var(--success-soft))'
  			},
  			warning: {
  				DEFAULT: 'hsl(var(--warning))',
  				foreground: 'hsl(var(--warning-foreground))',
  				soft: 'hsl(var(--warning-soft))'
  			},
  			danger: {
  				DEFAULT: 'hsl(var(--danger))',
  				foreground: 'hsl(var(--danger-foreground))',
  				soft: 'hsl(var(--danger-soft))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)',
  			/*
  			 * Named scale: chip 8 / control 12 / card 16 / hero 24 / pill 999.
  			 * Values live in tokens.css (`--radius-sm/md/lg/xl/pill`); this file only
  			 * names them, so a call site writes `rounded-card` and gets 16px.
  			 * 24px (`rounded-hero`) is for LARGE display cards only — prefer 16.
  			 * Legacy `sm`/`md`/`lg`/`xl` are untouched: re-pointing them would resize
  			 * every existing rounded surface (~106 card sites plus every button).
  			 */
  			chip: 'var(--radius-sm)',
  			control: 'var(--radius-md)',
  			card: 'var(--radius-lg)',
  			hero: 'var(--radius-xl)',
  			pill: 'var(--radius-pill)'
  		},
  		fontFamily: {
  			/*
  			 * 2026-11-10: Inter first, then the platform UI face, then the CJK faces.
  			 * Inter is used when the machine already has it — nothing is downloaded, so
  			 * a machine without it falls straight through to the system stack: no extra
  			 * request, no FOUT, and CJK still resolves to PingFang/YaHei.
  			 */
  			sans: [
  				'Inter',
  				'-apple-system',
  				'BlinkMacSystemFont',
  				'Segoe UI',
  				'PingFang SC',
  				'Microsoft YaHei',
  				'sans-serif'
  			]
  		},
  		fontSize: {
  			display: [
  				'var(--text-display)',
  				{
  					lineHeight: '1.25',
  					letterSpacing: '-0.022em'
  				}
  			],
  			title: [
  				'var(--text-title)',
  				{
  					lineHeight: '1.4',
  					letterSpacing: '-0.012em'
  				}
  			],
  			card: [
  				'var(--text-card)',
  				{
  					lineHeight: '1.45'
  				}
  			],
  			meta: [
  				'var(--text-meta)',
  				{
  					lineHeight: '1.5'
  				}
  			],
  			/*
  			 * Phase 2 (2026-11-10) — the B §1 ladder.
  			 *
  			 * The four legacy keys above are kept exactly as they were, because
  			 * 316 `text-meta`, 45 `text-card`, 8 `text-display` and 73
  			 * `.section-heading` call sites depend on their current values. The
  			 * new keys are additive; phase 3 migrates call sites onto them.
  			 *
  			 * `display-lg` carries the 44px step under that name rather than
  			 * `display` because `text-display` currently means 28px (the new h1)
  			 * on 8 pages that this batch must not touch. Once those pages move to
  			 * `text-h1`, `display` can be repointed at `--type-display`.
  			 *
  			 * The B §1 `meta` row (weight 500, tracking 0.01em) is NOT applied to
  			 * the legacy `meta` key: a weight bump there would re-set 316 pieces
  			 * of secondary text in one token edit, which is a page-level visual
  			 * change, not infrastructure. It lands with the phase 3 migration.
  			 */
  			'display-lg': [
  				'var(--type-display)',
  				{
  					lineHeight: 'var(--type-display-leading)',
  					letterSpacing: 'var(--type-display-tracking)',
  					fontWeight: '700'
  				}
  			],
  			h1: [
  				'var(--type-h1)',
  				{
  					lineHeight: '1.3',
  					/* B §1: CJK floor is -0.01em (the table's -0.022em is Latin-only). */
  					letterSpacing: '-0.01em',
  					fontWeight: '600'
  				}
  			],
  			h2: [
  				'var(--type-h2)',
  				{
  					lineHeight: '1.4',
  					letterSpacing: '-0.012em',
  					fontWeight: '600'
  				}
  			],
  			h3: [
  				'var(--type-h3)',
  				{
  					lineHeight: '1.4',
  					letterSpacing: '-0.008em',
  					fontWeight: '600'
  				}
  			],
  			body: [
  				'var(--type-body)',
  				{
  					lineHeight: '1.6',
  					letterSpacing: '0',
  					fontWeight: '400'
  				}
  			],
  			reading: [
  				'var(--type-reading)',
  				{
  					lineHeight: '1.85',
  					letterSpacing: '0',
  					fontWeight: '400'
  				}
  			],
  			caption: [
  				'var(--type-caption)',
  				{
  					lineHeight: '1.33',
  					letterSpacing: '0.02em',
  					fontWeight: '400'
  				}
  			],
  			/* Dashboard numbers: hero-sized digits at weight 700. */
  			metric: [
  				'var(--type-metric)',
  				{
  					lineHeight: '1.15',
  					letterSpacing: '-0.01em',
  					fontWeight: '700'
  				}
  			]
  		},
  		maxWidth: {
  			shell: 'var(--shell-max-width)'
  		},
  		/*
  		 * Enhanced shadow system for visual depth hierarchy.
  		 *
  		 * All shadows are tinted with --foreground rather than black. A
  		 * pure-black shadow over cream goes grey; the navy tint keeps the
  		 * surface reading as the same material it sits on.
  		 *
  		 * - sm: subtle depth for static cards
  		 * - DEFAULT (md): standard card elevation
  		 * - lg: prominent surfaces (modals, dropdowns)
  		 * - xl: maximum elevation (toasts, notifications)
  		 * - lift: interactive hover state
  		 */
  		boxShadow: {
  			sm: '0 1px 3px 0 hsl(var(--foreground) / 0.05)',
  			DEFAULT: '0 2px 6px -1px hsl(var(--foreground) / 0.06)',
  			md: '0 2px 6px -1px hsl(var(--foreground) / 0.06)',
  			lg: '0 8px 16px -4px hsl(var(--foreground) / 0.08)',
  			xl: '0 12px 24px -6px hsl(var(--foreground) / 0.10)',
  			lift: '0 4px 12px -2px hsl(var(--foreground) / 0.08)',
  			/*
  			 * B §3 elevation, added as `e0`/`e1` rather than by re-valuing the
  			 * scale above (same reasoning as borderRadius).
  			 *   e0  border-only — the DEFAULT for any card in the document flow
  			 *   e1  the single soft shadow — ONLY for elements outside the flow
  			 *       (sticky header, popover, dropdown, modal, drawer, toast) and
  			 *       for whole-card hover. Never on inputs, tables, buttons or
  			 *       inline chips; never stacked with a second ring.
  			 */
  			e0: 'none',
  			e1: 'var(--shadow-e1)',
  			/*
  			 * 2026-11-10 白 + 干净 elevation set. Shadows are almost invisible on
  			 * purpose: the 1px #EAEAEA border does the separating, and every value is
  			 * tinted with the brand ink rgba(17,24,39,·), never pure black.
  			 *   card      a card at rest
  			 *   hover     whole-card hover only (never inputs/buttons/chips)
  			 *   floating  anything out of the flow: header, popover, modal, drawer, toast
  			 */
  			card: 'var(--shadow-card)',
  			hover: 'var(--shadow-hover)',
  			floating: 'var(--shadow-floating)'
  		},
  		/*
  		 * z-index semantic layers (B/A do not fix numbers; the order is
  		 * rail < header < menu < popover < modal < drawer < toast). Values live
  		 * in tokens.css as --z-* so CSS and utilities cannot drift.
  		 * Components must use `z-rail` / `z-header` / ... and never a literal
  		 * `z-50`, which is how the pre-batch code ended up with ten numbers.
  		 */
  		zIndex: {
  			rail: 'var(--z-rail)',
  			header: 'var(--z-header)',
  			menu: 'var(--z-menu)',
  			popover: 'var(--z-popover)',
  			modal: 'var(--z-modal)',
  			drawer: 'var(--z-drawer)',
  			toast: 'var(--z-toast)'
  		},
  		/*
  		 * B §5 motion tokens as utilities, so a call site writes
  		 * `duration-micro ease-standard` instead of an arbitrary value.
  		 * Both are additive: Tailwind's own duration/easing scales stay.
  		 */
  		/*
  		 * Three canonical durations: 150 / 200 / 300ms. The numeric keys are
  		 * restated so `duration-150/200/300` can never drift from the tokens, while
  		 * 75/100/500/700 stay because ui/sheet.tsx already uses duration-500.
  		 * The semantic names are aliases of the same three values.
  		 */
  		transitionDuration: {
  			fast: 'var(--dur-fast)',
  			base: 'var(--dur-base)',
  			slow: 'var(--dur-slow)',
  			micro: 'var(--dur-micro)',
  			enter: 'var(--dur-enter)',
  			exit: 'var(--dur-exit)',
  			expand: 'var(--dur-expand)',
  			drawer: 'var(--dur-drawer)',
  			page: 'var(--dur-page)',
  			spring: 'var(--dur-spring)',
  			'75': '75ms',
  			'100': '100ms',
  			'150': '150ms',
  			'200': '200ms',
  			'300': '300ms',
  			'500': '500ms',
  			'700': '700ms'
  		},
  		transitionTimingFunction: {
  			default: 'var(--ease-standard)',
  			standard: 'var(--ease-standard)',
  			enter: 'var(--ease-enter)',
  			exit: 'var(--ease-exit)',
  			spring: 'var(--ease-spring)'
  		},
  		/*
  		 * Motion vocabulary (see docs/design-system/前端Layout设计方案.md §6.2).
  		 *
  		 * Four rules these follow: only express a state change; only animate
  		 * opacity + transform; stay under 400ms; and inherit the global
  		 * `prefers-reduced-motion` clamp already in globals.css, which drops every
  		 * animation to 0.01ms — so none of them need their own reduced-motion case.
  		 *
  		 * `backwards` fill-mode, NOT `both`. A retained `transform` — and
  		 * `translateY(0)` is still a transform — makes the element a containing
  		 * block for every `position: fixed` descendant, permanently, which would
  		 * break in-tree fixed layers (the editor workspace has two). `backwards`
  		 * applies the first frame during any delay and releases the element once
  		 * the animation ends; since the last frame equals the element's own style,
  		 * nothing moves. It is also what makes a staggered item invisible until
  		 * its delay elapses — without it, the item paints, blinks out, then fades in.
  		 *
  		 * Delays for staggered lists are set inline (`animationDelay`), not here —
  		 * a utility class cannot beat Tailwind's own `animation` shorthand, which
  		 * resets `animation-delay` whenever both land on one element.
  		 */
  		keyframes: {
  			'sheet-in': {
  				from: {
  					opacity: '0',
  					transform: 'translateY(-4px)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  		'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'fade-in': {
  				from: {
  					opacity: '0'
  				},
  				to: {
  					opacity: '1'
  				}
  			},
  			'rise-in': {
  				from: {
  					opacity: '0',
  					transform: 'translateY(8px)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			'page-enter': {
  				from: {
  					opacity: '0',
  					transform: 'translateY(6px)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			/*
  			 * B §5 — these two were already REFERENCED by `animation` below but
  			 * had no keyframes, so `animate-heart-pop` / `animate-count-bounce`
  			 * were empty animations (a documented gap: ":154-209 无定义"). Last
  			 * frame equals the natural style and neither uses `forwards`, so
  			 * nothing is revealed by the animation and no element keeps a
  			 * transform (which would trap `position: fixed` descendants).
  			 */
  			'heart-pop': {
  				'0%': {
  					transform: 'scale(1)'
  				},
  				'28%': {
  					transform: 'scale(1.28)'
  				},
  				'48%': {
  					transform: 'scale(0.92)'
  				},
  				'72%': {
  					transform: 'scale(1.06)'
  				},
  				'100%': {
  					transform: 'scale(1)'
  				}
  			},
  			'count-bounce': {
  				'0%': {
  					transform: 'translateY(0)'
  				},
  				'35%': {
  					transform: 'translateY(-3px)'
  				},
  				'70%': {
  					transform: 'translateY(1px)'
  				},
  				'100%': {
  					transform: 'translateY(0)'
  				}
  			}
  		},
  		animation: {
  			'sheet-in': 'sheet-in 140ms ease-out',
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'fade-in': 'fade-in 220ms ease-out backwards',
  			'rise-in': 'rise-in 260ms ease-out backwards',
  			'page-enter': 'page-enter 280ms ease-out backwards',
  			'heart-pop': 'heart-pop 600ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  			'count-bounce': 'count-bounce 400ms cubic-bezier(0.34, 1.56, 0.64, 1)'
  		}
  	}
  },
  plugins: [animate],
} satisfies Config;
