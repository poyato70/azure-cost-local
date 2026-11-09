import { useEffect, useState } from "react";
export function ThemeControl() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("tesseract-theme") || "dark",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("tesseract-theme", theme);
  }, [theme]);
  return (
    <button
      className="theme-control"
      aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? "◐ Claro" : "◑ Escuro"}
    </button>
  );
}
