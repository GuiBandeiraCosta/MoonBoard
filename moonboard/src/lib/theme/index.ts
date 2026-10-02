import { useColorScheme } from 'react-native';

/**
 * Design tokens. Dark-first: a board session usually happens in a dim gym
 * or garage. Role colors follow what climbers already know from the
 * official app: green start, blue hand, red finish.
 */
export const role = {
  start: '#22C55E',
  middle: '#3B82F6',
  finish: '#EF4444',
  foot: '#F59E0B',
} as const;

const dark = {
  bg: '#0B1020',
  surface: '#141A2E',
  surfaceRaised: '#1C2440',
  border: '#28304F',
  text: '#F1F5F9',
  textMuted: '#8B93B0',
  textFaint: '#5B6382',
  accent: '#A78BFA',
  accentSoft: '#2A2550',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  boardBg: '#101629',
  boardGrid: '#232B48',
  holdIdle: '#2E3759',
  tabBar: '#0E1428',
};

const light: typeof dark = {
  bg: '#F6F7FB',
  surface: '#FFFFFF',
  surfaceRaised: '#F1F3F9',
  border: '#E2E6F0',
  text: '#0F172A',
  textMuted: '#5B6478',
  textFaint: '#9AA3B8',
  accent: '#7C3AED',
  accentSoft: '#EDE9FE',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  boardBg: '#FFFFFF',
  boardGrid: '#E6E9F2',
  holdIdle: '#D5DAE6',
  tabBar: '#FFFFFF',
};

export type Palette = typeof dark;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

export const type = {
  title: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.3 },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, fontWeight: '600' as const },
  small: { fontSize: 13, fontWeight: '400' as const },
  smallStrong: { fontSize: 13, fontWeight: '600' as const },
  mono: { fontSize: 14, fontFamily: 'monospace' as const },
};

export function useTheme() {
  const scheme = useColorScheme();
  const colors = scheme === 'light' ? light : dark;
  return { colors, isDark: scheme !== 'light', role, space, radius, type };
}
