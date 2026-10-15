import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ThemeContext = createContext(null);

// index.html ka script pehle hi data-theme set kar chuka hota hai
const initialTheme = () =>
  document.documentElement.dataset.theme === "dark" ? "dark" : "light";

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem("theme", next);
      } catch {
        /* storage blocked, ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext);