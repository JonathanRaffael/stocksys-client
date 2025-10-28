import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(
    document.documentElement.classList.contains("dark") ? "dark" : "light"
  )

  useEffect(() => {
    // sinkronkan color-scheme CSS
    document.documentElement.style.colorScheme = theme
  }, [theme])

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light"
    setTheme(next)
    localStorage.setItem("theme", next)
    document.documentElement.classList.toggle("dark", next === "dark")
    document.documentElement.style.colorScheme = next
  }

  return (
    <button
      onClick={toggleTheme}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
    >
      {theme === "light" ? (<><Moon className="w-4 h-4" /> Dark</>) : (<><Sun className="w-4 h-4" /> Light</>)}
    </button>
  )
}
