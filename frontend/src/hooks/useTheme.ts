import { useEffect, useState } from "react";

const THEME_KEY = "irb-theme";

export const useTheme = () => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      return stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch (_error) {
      return false;
    }
  });

  useEffect(() => {
    // Keep the candidate resume editor theme scoped to the editor instead of
    // changing the shared Recruiter/Candidate workspace chrome.
    document.documentElement.classList.remove("dark");
    try {
      localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
    } catch (_error) {
      // Ignore storage failures.
    }
  }, [isDark]);

  return { isDark, toggle: () => setIsDark((value) => !value) };
};
