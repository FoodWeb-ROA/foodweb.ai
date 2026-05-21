export type Theme = 'dark' | 'light';

const KEY = 'roa-theme';

export function readStoredTheme(): Theme | null {
  if (typeof localStorage === 'undefined') return null;
  const v = localStorage.getItem(KEY);
  return v === 'dark' || v === 'light' ? v : null;
}

export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem(KEY, t); } catch {}
}
