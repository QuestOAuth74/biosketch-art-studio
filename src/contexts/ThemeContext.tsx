import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'purple' | 'blue' | 'fall';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  darkMode: boolean;
  setDarkMode: (darkMode: boolean) => void;
  toggleDarkMode: () => void;
  canvasMode: boolean;
  setCanvasMode: (mode: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme-color-scheme');
    return (stored === 'blue' || stored === 'purple' || stored === 'fall') ? stored : 'purple';
  });

  // Clear stale dark-mode state from earlier experiment, always start light.
  const [darkMode, setDarkModeState] = useState<boolean>(() => {
    localStorage.removeItem('theme-dark-mode');
    return false;
  });

  const [canvasMode, setCanvasModeState] = useState<boolean>(false);

  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all theme classes first
    root.classList.remove('theme-purple', 'theme-blue', 'theme-fall');
    
    // Add the selected theme class
    root.classList.add(`theme-${theme}`);
    
    // Store preference
    localStorage.setItem('theme-color-scheme', theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    
    // Toggle dark mode class
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Store preference
    localStorage.setItem('theme-dark-mode', darkMode.toString());
  }, [darkMode]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const setDarkMode = (newDarkMode: boolean) => {
    setDarkModeState(newDarkMode);
  };

  const toggleDarkMode = () => {
    setDarkModeState(prev => !prev);
  };

  const setCanvasMode = (mode: boolean) => {
    setCanvasModeState(mode);
    const root = document.documentElement;
    if (mode) {
      root.classList.add('canvas-workspace');
    } else {
      root.classList.remove('canvas-workspace');
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, darkMode, setDarkMode, toggleDarkMode, canvasMode, setCanvasMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
