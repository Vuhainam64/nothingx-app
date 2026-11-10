import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Theme = 'light' | 'dark';
export type VisualStyle = 'premium' | 'liquid' | 'aurora' | 'shapes';
export type UiStyle = VisualStyle;

export const VISUAL_STYLES: { id: VisualStyle }[] = [
  { id: 'premium' },
  { id: 'liquid' },
  { id: 'aurora' },
  { id: 'shapes' },
];

export const UI_STYLES: readonly UiStyle[] = ['premium', 'liquid', 'aurora', 'shapes'];
export const DEFAULT_UI_STYLE: UiStyle = 'premium';

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (t: Theme) => void;
  style: VisualStyle;
  setStyle: (s: VisualStyle) => void;
  uiStyle: UiStyle;
  setUiStyle: (s: UiStyle) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'nothingx.theme';
const STYLE_KEY = 'nothingx.style';

function readStored(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'dark';
  } catch {
    return 'dark';
  }
}

function readStoredStyle(): VisualStyle {
  try {
    const v = localStorage.getItem(STYLE_KEY);
    return (UI_STYLES as readonly string[]).includes(v ?? '')
      ? (v as VisualStyle)
      : DEFAULT_UI_STYLE;
  } catch {
    return DEFAULT_UI_STYLE;
  }
}

export function applyStoredAppearance(): void {
  const root = document.documentElement;
  const theme = readStored();
  const dark = theme === 'dark';
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  root.dataset.style = readStoredStyle();
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStored);
  const [style, setStyleState] = useState<VisualStyle>(readStoredStyle);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.style = style;
  }, [style]);

  const setStyle = useCallback((s: VisualStyle) => {
    try {
      localStorage.setItem(STYLE_KEY, s);
    } catch {
      // ignore
    }
    setStyleState(s);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // ignore
    }
    setThemeState(t);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme: theme,
      setTheme,
      style,
      setStyle,
      uiStyle: style,
      setUiStyle: setStyle,
    }),
    [theme, setTheme, style, setStyle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
