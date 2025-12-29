import { useEffect } from "react";

export function useDarkMode() {
  useEffect(() => {
    const applyTheme = (matches: boolean) => {
      if (matches) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    // Apply initial theme
    applyTheme(mediaQuery.matches);

    // Listen for changes
    const handleChange = (e: MediaQueryListEvent) => applyTheme(e.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);
}
