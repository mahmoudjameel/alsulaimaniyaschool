/**
 * School font themes — Arabic-first pairs suitable for a K–12 school OS.
 * Applied via `document.documentElement[data-font]`.
 */

export const FONT_STORAGE_KEY = 'alsula-font-theme';
export const DEFAULT_FONT_THEME = 'classic';

/** @typedef {{ id: string, labelAr: string, hintAr: string, heading: string, body: string, sample: string }} FontTheme */

/** @type {FontTheme[]} */
export const FONT_THEMES = [
  {
    id: 'classic',
    labelAr: 'كلاسيكي',
    hintAr: 'خط تقليدي للمدرسة — عناوين أنيقة ونص واضح',
    heading: '"Amiri", serif',
    body: '"Noto Naskh Arabic", serif',
    sample: 'مدرسة السليمانية — مرحباً بالطالب',
  },
  {
    id: 'clear',
    labelAr: 'واضح',
    hintAr: 'خط عصري سهل القراءة على الشاشات والهواتف',
    heading: '"Cairo", sans-serif',
    body: '"Cairo", sans-serif',
    sample: 'مدرسة السليمانية — مرحباً بالطالب',
  },
  {
    id: 'school',
    labelAr: 'تعليمي',
    hintAr: 'ودود ومناسب للطلاب والأطفال',
    heading: '"Tajawal", sans-serif',
    body: '"Tajawal", sans-serif',
    sample: 'مدرسة السليمانية — مرحباً بالطالب',
  },
  {
    id: 'formal',
    labelAr: 'رسمي',
    hintAr: 'لمستندات وكشوف العلامات والعروض الرسمية',
    heading: '"Scheherazade New", serif',
    body: '"Noto Sans Arabic", sans-serif',
    sample: 'مدرسة السليمانية — مرحباً بالطالب',
  },
];

export function getFontTheme(id) {
  return FONT_THEMES.find((t) => t.id === id) || FONT_THEMES[0];
}

export function isValidFontTheme(id) {
  return FONT_THEMES.some((t) => t.id === id);
}

export function readPersonalFontTheme() {
  try {
    const v = localStorage.getItem(FONT_STORAGE_KEY);
    return isValidFontTheme(v) ? v : null;
  } catch {
    return null;
  }
}

export function writePersonalFontTheme(id) {
  try {
    if (!id || id === 'school-default') {
      localStorage.removeItem(FONT_STORAGE_KEY);
      return null;
    }
    if (!isValidFontTheme(id)) return readPersonalFontTheme();
    localStorage.setItem(FONT_STORAGE_KEY, id);
    return id;
  } catch {
    return null;
  }
}

export function applyFontThemeToDocument(id) {
  const theme = getFontTheme(id);
  const root = document.documentElement;
  root.setAttribute('data-font', theme.id);
  root.style.setProperty('--font-heading', theme.heading);
  root.style.setProperty('--font-body', theme.body);
}
