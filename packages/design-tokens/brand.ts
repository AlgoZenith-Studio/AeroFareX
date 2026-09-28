/**
 * AeroFareX brand colours — TypeScript mirror of ./brand.css.
 * Use in code that cannot read CSS variables (canvas, chart libraries, emails,
 * OG images). In components, prefer the CSS variables: `var(--sky-500)`.
 * Keep in sync with brand.css; the raw palette values are the only literals.
 */

export const palette = {
  sky100: '#f5fdff',
  sky150: '#dceff4',
  sky200: '#d6f7ff',
  sky300: '#a8eeff',
  sky400: '#6ce2ff',
  sky500: '#00ccff',
  sky600: '#0096c7',
  sky800: '#00607a',
  sky900: '#002b38',
  black: '#000000',
  blackSoft: '#1a1a1a',
  grey600: '#5c5c5c',
  white: '#ffffff',
  ink: '#05080c',
} as const;

/** Semantic roles for the default (light) theme. */
export const light = {
  page: palette.white,
  surface: palette.white,
  surfaceAlt: palette.sky100,
  surfaceTint: palette.sky200,
  surfaceBand: palette.sky400,
  text1: palette.black,
  text2: 'rgba(0, 0, 0, 0.72)',
  text3: 'rgba(0, 0, 0, 0.6)',
  textDeep: palette.sky900,
  accent: palette.sky500,
  onAccent: palette.black,
} as const;

/** Semantic roles inside `.theme-dark` blocks (hero, header). */
export const dark = {
  text1: palette.white,
  text2: 'rgba(229, 246, 255, 0.8)',
  text3: 'rgba(229, 246, 255, 0.62)',
  line: 'rgba(255, 255, 255, 0.12)',
  glass: 'rgba(5, 8, 12, 0.6)',
} as const;

/** Chart / data-mark order. Fills only — never use for text. */
export const marks = [palette.sky300, palette.black, palette.sky500, palette.grey600, palette.sky400] as const;

export type PaletteKey = keyof typeof palette;
