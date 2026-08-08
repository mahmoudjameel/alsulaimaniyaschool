import { createContext, useContext, useEffect, useMemo } from 'react';
import { useSchoolSite } from '../hooks/useSchoolSite';
import {
  DEFAULT_FONT_THEME,
  FONT_THEMES,
  applyFontThemeToDocument,
  getFontTheme,
  isValidFontTheme,
} from '../lib/fonts';
import {
  COLOR_THEMES,
  DEFAULT_COLOR_THEME,
  applyColorThemeToDocument,
  getColorTheme,
  isValidColorTheme,
} from '../lib/colorThemes';

/**
 * School-wide appearance only — controlled from admin /admin/appearance.
 * No per-device overrides on the public launcher.
 */
const AppearanceContext = createContext({
  fontThemes: FONT_THEMES,
  fontActiveId: DEFAULT_FONT_THEME,
  fontActive: getFontTheme(DEFAULT_FONT_THEME),
  fontSchoolDefaultId: DEFAULT_FONT_THEME,
  colorThemes: COLOR_THEMES,
  colorActiveId: DEFAULT_COLOR_THEME,
  colorActive: getColorTheme(DEFAULT_COLOR_THEME),
  colorSchoolDefaultId: DEFAULT_COLOR_THEME,
});

export function AppearanceProvider({ children }) {
  const { site } = useSchoolSite();

  const fontSchoolDefaultId = isValidFontTheme(site?.fontTheme)
    ? site.fontTheme
    : DEFAULT_FONT_THEME;
  const colorSchoolDefaultId = isValidColorTheme(site?.colorTheme)
    ? site.colorTheme
    : DEFAULT_COLOR_THEME;

  const fontActive = useMemo(() => getFontTheme(fontSchoolDefaultId), [fontSchoolDefaultId]);
  const colorActive = useMemo(() => getColorTheme(colorSchoolDefaultId), [colorSchoolDefaultId]);

  useEffect(() => {
    applyFontThemeToDocument(fontSchoolDefaultId);
  }, [fontSchoolDefaultId]);

  useEffect(() => {
    applyColorThemeToDocument(colorSchoolDefaultId);
  }, [colorSchoolDefaultId]);

  // Drop any old personal overrides left in localStorage
  useEffect(() => {
    try {
      localStorage.removeItem('alsula-font-theme');
      localStorage.removeItem('alsula-color-theme');
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({
    fontThemes: FONT_THEMES,
    fontActiveId: fontSchoolDefaultId,
    fontActive,
    fontSchoolDefaultId,
    colorThemes: COLOR_THEMES,
    colorActiveId: colorSchoolDefaultId,
    colorActive,
    colorSchoolDefaultId,
  }), [fontSchoolDefaultId, fontActive, colorSchoolDefaultId, colorActive]);

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function FontThemeProvider({ children }) {
  return <AppearanceProvider>{children}</AppearanceProvider>;
}

export function useAppearance() {
  return useContext(AppearanceContext);
}

export function useFontTheme() {
  const a = useContext(AppearanceContext);
  return {
    themes: a.fontThemes,
    activeId: a.fontActiveId,
    active: a.fontActive,
    schoolDefaultId: a.fontSchoolDefaultId,
    personalId: null,
    setPersonalTheme: () => {},
    clearPersonalTheme: () => {},
  };
}

export function useColorTheme() {
  const a = useContext(AppearanceContext);
  return {
    themes: a.colorThemes,
    activeId: a.colorActiveId,
    active: a.colorActive,
    schoolDefaultId: a.colorSchoolDefaultId,
    personalId: null,
    setPersonalTheme: () => {},
    clearPersonalTheme: () => {},
  };
}
