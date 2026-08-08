/**
 * School color themes — full token sets applied to :root.
 * `--gold` stays as the primary brand accent alias used across the UI.
 */

export const COLOR_STORAGE_KEY = 'alsula-color-theme';
export const DEFAULT_COLOR_THEME = 'gold';

/**
 * @typedef {{
 *   id: string,
 *   labelAr: string,
 *   hintAr: string,
 *   swatches: string[],
 *   vars: Record<string, string>,
 * }} ColorTheme
 */

/** @type {ColorTheme[]} */
export const COLOR_THEMES = [
  {
    id: 'gold',
    labelAr: 'ذهبي',
    hintAr: 'الألوان الحالية للمدرسة — دافئة ورسمية',
    swatches: ['#b68235', '#fff3e4', '#f3f2f2', '#201f1d'],
    vars: {
      '--color-bg': '#f3f2f2',
      '--color-surface': '#eae9e9',
      '--color-text': '#201f1d',
      '--color-accent': '#b68235',
      '--color-accent-2': '#ac803e',
      '--color-divider': 'color-mix(in srgb, #201f1d 16%, transparent)',
      '--color-neutral-100': '#f8f4f4',
      '--color-neutral-200': '#eae7e7',
      '--color-neutral-300': '#d7d3d3',
      '--color-neutral-400': '#bab6b6',
      '--color-neutral-500': '#9b9797',
      '--color-neutral-600': '#7d7979',
      '--color-neutral-700': '#605d5d',
      '--color-neutral-800': '#444141',
      '--color-neutral-900': '#2d2b2b',
      '--color-accent-100': '#fff3e4',
      '--color-accent-200': '#ffe3bf',
      '--color-accent-300': '#facb8d',
      '--color-accent-400': '#e1ad66',
      '--color-accent-500': '#c28d41',
      '--color-accent-600': '#a06f24',
      '--color-accent-700': '#7d5411',
      '--color-accent-800': '#5a3b0a',
      '--color-accent-900': '#3a270d',
      '--color-accent-2-100': '#fff3e4',
      '--color-accent-2-200': '#ffe3be',
      '--color-accent-2-300': '#f5cd96',
      '--color-accent-2-400': '#dbaf70',
      '--color-accent-2-500': '#bc8f4e',
      '--color-accent-2-600': '#9b7232',
      '--color-accent-2-700': '#79561f',
      '--color-accent-2-800': '#573d14',
      '--color-accent-2-900': '#382810',
    },
  },
  {
    id: 'blue',
    labelAr: 'أزرق وأبيض',
    hintAr: 'خلفية بيضاء ونقاط زرقاء واضحة للبوابات والشاشات',
    swatches: ['#1d4ed8', '#eff6ff', '#ffffff', '#0f172a'],
    vars: {
      '--color-bg': '#f4f7fb',
      '--color-surface': '#e8eef6',
      '--color-text': '#0f172a',
      '--color-accent': '#1d4ed8',
      '--color-accent-2': '#c2410c',
      '--color-divider': 'color-mix(in srgb, #0f172a 14%, transparent)',
      '--color-neutral-100': '#ffffff',
      '--color-neutral-200': '#eef2f7',
      '--color-neutral-300': '#d7dee8',
      '--color-neutral-400': '#b0bac8',
      '--color-neutral-500': '#8793a5',
      '--color-neutral-600': '#64748b',
      '--color-neutral-700': '#475569',
      '--color-neutral-800': '#334155',
      '--color-neutral-900': '#0f172a',
      '--color-accent-100': '#eff6ff',
      '--color-accent-200': '#dbeafe',
      '--color-accent-300': '#93c5fd',
      '--color-accent-400': '#60a5fa',
      '--color-accent-500': '#3b82f6',
      '--color-accent-600': '#2563eb',
      '--color-accent-700': '#1d4ed8',
      '--color-accent-800': '#1e3a8a',
      '--color-accent-900': '#172554',
      '--color-accent-2-100': '#fff7ed',
      '--color-accent-2-200': '#ffedd5',
      '--color-accent-2-300': '#fdba74',
      '--color-accent-2-400': '#fb923c',
      '--color-accent-2-500': '#f97316',
      '--color-accent-2-600': '#ea580c',
      '--color-accent-2-700': '#c2410c',
      '--color-accent-2-800': '#9a3412',
      '--color-accent-2-900': '#7c2d12',
    },
  },
  {
    id: 'green',
    labelAr: 'أخضر مدرسي',
    hintAr: 'أخضر هادئ مناسب للبيئة التعليمية',
    swatches: ['#1f6b4a', '#e8f5ef', '#f3f6f4', '#14241c'],
    vars: {
      '--color-bg': '#f3f6f4',
      '--color-surface': '#e6ede9',
      '--color-text': '#14241c',
      '--color-accent': '#1f6b4a',
      '--color-accent-2': '#b45309',
      '--color-divider': 'color-mix(in srgb, #14241c 15%, transparent)',
      '--color-neutral-100': '#f7faf8',
      '--color-neutral-200': '#e8eeea',
      '--color-neutral-300': '#cfd9d3',
      '--color-neutral-400': '#a8b5ae',
      '--color-neutral-500': '#84948c',
      '--color-neutral-600': '#67766e',
      '--color-neutral-700': '#4d5b54',
      '--color-neutral-800': '#35403b',
      '--color-neutral-900': '#1c2621',
      '--color-accent-100': '#e8f5ef',
      '--color-accent-200': '#c9e8d8',
      '--color-accent-300': '#8fcbb0',
      '--color-accent-400': '#57a884',
      '--color-accent-500': '#2f8a62',
      '--color-accent-600': '#1f6b4a',
      '--color-accent-700': '#17553b',
      '--color-accent-800': '#113d2b',
      '--color-accent-900': '#0b291d',
      '--color-accent-2-100': '#fff7ed',
      '--color-accent-2-200': '#ffedd5',
      '--color-accent-2-300': '#fdba74',
      '--color-accent-2-400': '#fb923c',
      '--color-accent-2-500': '#f59e0b',
      '--color-accent-2-600': '#d97706',
      '--color-accent-2-700': '#b45309',
      '--color-accent-2-800': '#92400e',
      '--color-accent-2-900': '#78350f',
    },
  },
];

export function getColorTheme(id) {
  return COLOR_THEMES.find((t) => t.id === id) || COLOR_THEMES[0];
}

export function isValidColorTheme(id) {
  return COLOR_THEMES.some((t) => t.id === id);
}

export function readPersonalColorTheme() {
  try {
    const v = localStorage.getItem(COLOR_STORAGE_KEY);
    return isValidColorTheme(v) ? v : null;
  } catch {
    return null;
  }
}

export function writePersonalColorTheme(id) {
  try {
    if (!id || id === 'school-default') {
      localStorage.removeItem(COLOR_STORAGE_KEY);
      return null;
    }
    if (!isValidColorTheme(id)) return readPersonalColorTheme();
    localStorage.setItem(COLOR_STORAGE_KEY, id);
    return id;
  } catch {
    return null;
  }
}

export function applyColorThemeToDocument(id) {
  const theme = getColorTheme(id);
  const root = document.documentElement;
  root.setAttribute('data-color', theme.id);
  Object.entries(theme.vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  // Keep legacy aliases in sync
  root.style.setProperty('--ink', 'var(--color-text)');
  root.style.setProperty('--paper', 'var(--color-bg)');
  root.style.setProperty('--gold', 'var(--color-accent)');
  root.style.setProperty('--line', 'var(--color-divider)');
}
