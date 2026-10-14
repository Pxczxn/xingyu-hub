import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// Brand palette + semantic tokens are sourced from docs/design-system/MASTER.md.
// All colors are semanticized in src/styles/tokens.css; components reference the
// semantic CSS variables (--background, --foreground, --primary, --accent, ...),
// never raw hex values.
//
// 2026-10-03 additions, all backed by tokens.css:
//   accent.strong  gold as TEXT (4.72:1 on cream — the raw accent measures 2.01:1
//                  and is therefore fill-only: buttons, badges, active nav pills)
//   accent.soft    gold wash for panels and active states
//   accent.line    gold hairline borders
//   surface-sunken one step below --card: chips, inset blocks, table headers
//   foreground-soft secondary headings that must not compete with navy
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			'foreground-soft': 'hsl(var(--foreground-soft))',
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
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
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		fontFamily: {
  			sans: [
  				'ui-sans-serif',
  				'system-ui',
  				'-apple-system',
  				'Segoe UI',
  				'PingFang SC',
  				'Hiragino Sans GB',
  				'Microsoft YaHei UI',
  				'Microsoft YaHei',
  				'Source Han Sans SC',
  				'Noto Sans SC',
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
  			lift: '0 4px 12px -2px hsl(var(--foreground) / 0.08)'
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
  			}
  		},
  		animation: {
  			'sheet-in': 'sheet-in 140ms ease-out',
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'fade-in': 'fade-in 220ms ease-out backwards',
  			'rise-in': 'rise-in 260ms ease-out backwards',
  			'page-enter': 'page-enter 280ms ease-out backwards'
  		}
  	}
  },
  plugins: [animate],
} satisfies Config;
